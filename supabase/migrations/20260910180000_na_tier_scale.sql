-- Rankle -- Migration 6: correct the default tier scale to S/A/B/C/F/N/A
--
-- Depends on migrations 1-5.
--
-- Pre-Milestone-4 product-model correction (not a Milestone 4 feature): the
-- canonical scale changes from S/A/B/C/D to S/A/B/C/F/N/A.
--
--   * S/A/B/C/F are opinion tiers.
--   * "N/A" means "I haven't tried or experienced this" -- an intentional,
--     submittable, immutable-once-submitted placement, but NOT an opinion.
--     It is explicitly NOT the same thing as Unranked (which blocks
--     submission and does not count as a decision at all).
--
-- What this migration changes and why:
--
--   1. `tierlists.tier_config` DEFAULT becomes the 6-entry scale. Existing
--      generic validation (submit_ranking already derives valid tiers from
--      each game's own tier_config) needed no change: "N/A" becomes a valid
--      submittable tier the moment it appears in a game's tier_config, same
--      as any other custom label.
--
--   2. `submit_ranking`'s aggregate-update step is the ONE place that DOES
--      need a change. `private.tier_weight` is purely positional (first
--      tier_config entry = highest weight, last = 1) and, before this
--      migration, submit_ranking fed every submitted tier through it into
--      tierlist_item_stats.sum_weight / total_submissions -- unconditionally,
--      at submission time. Appending "N/A" as tier_config's last entry would
--      have given it a weight of 1, one point BELOW F's weight of 2, and
--      total_submissions (avg_weight's denominator) would count every N/A
--      placement too -- silently scoring "haven't tried" as a worse opinion
--      than F and skewing the opinion average toward it. Both are explicitly
--      disallowed by the product spec.
--
--      The fix: submit_ranking now special-cases the literal tier value
--      "N/A" in its aggregate step. tier_counts (a generic per-tier jsonb
--      object) still gets an "N/A" entry incremented exactly like any other
--      tier, so a future result can report e.g. "18% haven't tried this."
--      total_submissions and sum_weight -- the only fields that feed
--      avg_weight / consensus / hottest-take math -- simply skip N/A rows
--      entirely, so avg_weight stays a pure average over S/A/B/C/F opinions
--      and N/A cannot be numerically "worse than F" or distort it.
--
--      private.tier_weight itself is untouched and stays generic/positional
--      (it is still exercised generically, e.g. by any future non-N/A custom
--      scale); the N/A exclusion lives only in submit_ranking, where the
--      distinction is explicit and documented, per product requirements.

------------------------------------------------------------------------
-- 1. tierlists.tier_config: correct the default for newly created games
------------------------------------------------------------------------
alter table public.tierlists
  alter column tier_config set default '["S","A","B","C","F","N/A"]'::jsonb;

------------------------------------------------------------------------
-- 2. submit_ranking: exclude "N/A" from total_submissions / sum_weight
------------------------------------------------------------------------
create or replace function public.submit_ranking(
  p_tierlist_id uuid,
  p_items       jsonb,
  p_guest_id    uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_tl       public.tierlists%rowtype;
  v_tiers    text[];
  v_required integer;
  v_provided integer;
  v_distinct integer;
  v_sub_id   uuid;
begin
  -- identity: exactly one of authenticated user / guest id
  if (v_uid is not null) = (p_guest_id is not null) then
    raise exception 'rankle: exactly one of an authenticated user or a guest id is required'
      using errcode = 'check_violation';
  end if;

  -- payload must be a JSON array
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'rankle: ranking payload must be a JSON array'
      using errcode = 'invalid_parameter_value';
  end if;

  -- load the game
  select * into v_tl from public.tierlists where id = p_tierlist_id;
  if not found then
    raise exception 'rankle: game not found' using errcode = 'no_data_found';
  end if;

  -- release authorization: open + released in the canonical timezone
  if v_tl.status not in ('scheduled', 'live')
     or v_tl.release_date is null
     or v_tl.release_date > private.today() then
    raise exception 'rankle: this game is not open for submissions'
      using errcode = 'restrict_violation';
  end if;

  v_tiers := array(select jsonb_array_elements_text(v_tl.tier_config));

  -- every payload row must reference a known item in THIS game, a valid tier,
  -- and a non-negative position
  if exists (
    select 1
    from jsonb_array_elements(p_items) e
    left join public.tierlist_items ti
      on ti.id = (e ->> 'item_id')::uuid
     and ti.tierlist_id = p_tierlist_id
    where ti.id is null
       or (e ->> 'tier') is null
       or (e ->> 'tier') <> all (v_tiers)
       or (e ->> 'position') is null
       or (e ->> 'position')::integer < 0
  ) then
    raise exception 'rankle: ranking payload contains an unknown item, tier, or position'
      using errcode = 'invalid_parameter_value';
  end if;

  select count(*) into v_required
  from public.tierlist_items
  where tierlist_id = p_tierlist_id;

  select count(*), count(distinct (e ->> 'item_id'))
    into v_provided, v_distinct
  from jsonb_array_elements(p_items) e;

  if v_required = 0 then
    raise exception 'rankle: this game has no items' using errcode = 'restrict_violation';
  end if;

  if v_provided <> v_required or v_distinct <> v_required then
    raise exception 'rankle: every item must be ranked exactly once'
      using errcode = 'invalid_parameter_value';
  end if;

  -- no two items in the same (tier, position) slot
  if exists (
    select 1
    from jsonb_array_elements(p_items) e
    group by (e ->> 'tier'), (e ->> 'position')::integer
    having count(*) > 1
  ) then
    raise exception 'rankle: two items share the same tier and position'
      using errcode = 'invalid_parameter_value';
  end if;

  -- create the official submission (unique indexes enforce one-per-identity/game)
  begin
    insert into public.submissions (tierlist_id, user_id, guest_id)
    values (p_tierlist_id, v_uid, p_guest_id)
    returning id into v_sub_id;
  exception when unique_violation then
    raise exception 'rankle: you have already submitted an official ranking for this game'
      using errcode = 'unique_violation';
  end;

  insert into public.submission_items (submission_id, tierlist_item_id, tier, position)
  select
    v_sub_id,
    (e ->> 'item_id')::uuid,
    (e ->> 'tier'),
    (e ->> 'position')::integer
  from jsonb_array_elements(p_items) e;

  -- ensure an aggregate row exists for each item, then increment atomically
  insert into public.tierlist_item_stats (tierlist_item_id, tierlist_id)
  select si.tierlist_item_id, p_tierlist_id
  from public.submission_items si
  where si.submission_id = v_sub_id
  on conflict (tierlist_item_id) do nothing;

  -- "N/A" is abstention ("haven't tried"), not an opinion: tier_counts still
  -- records it (generic per-tier jsonb -- a future result can read
  -- tier_counts->>'N/A' to report e.g. "18% haven't tried this"), but it must
  -- NEVER feed total_submissions or sum_weight, or it would silently count as
  -- a numeric opinion -- specifically one weighted below F -- and skew
  -- avg_weight (sum_weight / total_submissions) toward it. See migration 6's
  -- header comment.
  update public.tierlist_item_stats s
  set
    tier_counts = jsonb_set(
      s.tier_counts,
      array[si.tier],
      to_jsonb(coalesce((s.tier_counts ->> si.tier)::integer, 0) + 1),
      true
    ),
    total_submissions = s.total_submissions
      + case when si.tier = 'N/A' then 0 else 1 end,
    sum_weight = s.sum_weight
      + case when si.tier = 'N/A' then 0 else private.tier_weight(v_tl.tier_config, si.tier) end,
    updated_at = now()
  from public.submission_items si
  where si.submission_id = v_sub_id
    and s.tierlist_item_id = si.tierlist_item_id;

  return v_sub_id;
end;
$$;

revoke all on function public.submit_ranking(uuid, jsonb, uuid) from public;
grant execute on function public.submit_ranking(uuid, jsonb, uuid) to anon, authenticated;
