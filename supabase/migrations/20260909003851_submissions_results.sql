-- Rankle MVP -- Migration 2/4: submissions, aggregate stats, submit + results RPCs
--
-- Depends on migration 1 (profiles, tierlists, tierlist_items, private helpers).
--
-- Creates:
--   * submissions           (append-only; one official ranking per identity/game)
--   * submission_items       (append-only; the tier/position of each item)
--   * tierlist_item_stats    (per-item aggregate counts; the spoiler-gated table)
--   * private.has_submitted  (eligibility helper -- depends on submissions)
--   * public.submit_ranking  (SECURITY DEFINER RPC: validate + write + aggregate)
--   * public.get_results     (SECURITY DEFINER RPC: results, gated by eligibility)

------------------------------------------------------------------------
-- 1. submissions
------------------------------------------------------------------------
create table public.submissions (
  id           uuid primary key default gen_random_uuid(),
  tierlist_id  uuid not null references public.tierlists (id) on delete cascade,
  user_id      uuid references public.profiles (id) on delete cascade,
  guest_id     uuid,
  submitted_at timestamptz not null default now(),
  constraint submissions_one_identity
    check ((user_id is not null) <> (guest_id is not null))
);

-- one official submission per registered user per game.
-- NULLs are distinct in a unique index, so guests are unaffected by this one.
create unique index submissions_user_game_key
  on public.submissions (tierlist_id, user_id)
  where user_id is not null;

-- best-effort one submission per guest identity per game
create unique index submissions_guest_game_key
  on public.submissions (tierlist_id, guest_id)
  where guest_id is not null;

create index submissions_tierlist_id_idx
  on public.submissions (tierlist_id);

create index submissions_user_recent_idx
  on public.submissions (user_id, submitted_at desc)
  where user_id is not null;

------------------------------------------------------------------------
-- 2. submission_items
------------------------------------------------------------------------
create table public.submission_items (
  submission_id    uuid not null references public.submissions (id) on delete cascade,
  tierlist_item_id uuid not null references public.tierlist_items (id) on delete cascade,
  tier             text not null,
  position         integer not null,
  primary key (submission_id, tierlist_item_id),
  constraint submission_items_position_nonneg check (position >= 0)
);

create unique index submission_items_slot_key
  on public.submission_items (submission_id, tier, position);

create index submission_items_item_idx
  on public.submission_items (tierlist_item_id);

------------------------------------------------------------------------
-- 3. immutability: submitted rows may never be UPDATEd
--    (DELETE is blocked for all client roles in migration 4 via absence of
--     grants/policies; ON DELETE CASCADE from a game teardown is still allowed)
------------------------------------------------------------------------
create or replace function private.tg_block_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'rankle: % on % is not allowed; submitted rankings are immutable',
    tg_op, tg_table_name
    using errcode = 'restrict_violation';
end;
$$;
revoke all on function private.tg_block_update() from public, anon, authenticated;

create trigger submissions_no_update
  before update on public.submissions
  for each row execute function private.tg_block_update();

create trigger submission_items_no_update
  before update on public.submission_items
  for each row execute function private.tg_block_update();

------------------------------------------------------------------------
-- 4. tierlist_item_stats  (community aggregate; spoiler-gated in migration 4)
------------------------------------------------------------------------
create table public.tierlist_item_stats (
  tierlist_item_id  uuid primary key
                    references public.tierlist_items (id) on delete cascade,
  -- denormalized for a cheap spoiler-gate policy (has_submitted(tierlist_id))
  tierlist_id       uuid not null references public.tierlists (id) on delete cascade,
  tier_counts       jsonb   not null default '{}'::jsonb,
  total_submissions integer not null default 0,
  sum_weight        bigint  not null default 0,
  updated_at        timestamptz not null default now(),
  constraint tierlist_item_stats_counts_obj
    check (jsonb_typeof(tier_counts) = 'object'),
  constraint tierlist_item_stats_total_nonneg
    check (total_submissions >= 0)
);

create index tierlist_item_stats_tierlist_id_idx
  on public.tierlist_item_stats (tierlist_id);

------------------------------------------------------------------------
-- 5. eligibility helper -- depends on submissions
------------------------------------------------------------------------
create or replace function private.has_submitted(p_tierlist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.submissions s
    where s.tierlist_id = p_tierlist_id
      and s.user_id = (select auth.uid())
  );
$$;
-- Referenced by the tierlist_item_stats RLS policy -> the invoking role must be
-- able to execute it. Returns only a boolean about the caller's own submission.
revoke all on function private.has_submitted(uuid) from public;
grant execute on function private.has_submitted(uuid) to anon, authenticated;

------------------------------------------------------------------------
-- 6. submit_ranking RPC
--    Sole write path for submissions / submission_items / tierlist_item_stats.
--    Validates the payload server-side, inserts the official submission, and
--    updates aggregates in the same transaction. Idempotent: a duplicate
--    submission aborts the whole function before any aggregate change.
--
--    p_items shape: [{ "item_id": <uuid>, "tier": <text>, "position": <int> }, ...]
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

  update public.tierlist_item_stats s
  set
    tier_counts = jsonb_set(
      s.tier_counts,
      array[si.tier],
      to_jsonb(coalesce((s.tier_counts ->> si.tier)::integer, 0) + 1),
      true
    ),
    total_submissions = s.total_submissions + 1,
    sum_weight = s.sum_weight + private.tier_weight(v_tl.tier_config, si.tier),
    updated_at = now()
  from public.submission_items si
  where si.submission_id = v_sub_id
    and s.tierlist_item_id = si.tierlist_item_id;

  return v_sub_id;
end;
$$;

revoke all on function public.submit_ranking(uuid, jsonb, uuid) from public;
grant execute on function public.submit_ranking(uuid, jsonb, uuid) to anon, authenticated;

------------------------------------------------------------------------
-- 7. get_results RPC
--    Returns community distributions + the caller's own ranking, but only
--    after the caller has an official submission for this game (spoiler gate).
--    Derived scores (consensus / controversy / hottest take) are intentionally
--    computed in the application layer, near their unit tests (MANUAL sec 10).
------------------------------------------------------------------------
create or replace function public.get_results(
  p_tierlist_id uuid,
  p_guest_id    uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid      uuid := (select auth.uid());
  v_eligible boolean := false;
  v_result   jsonb;
begin
  if v_uid is not null then
    v_eligible := private.has_submitted(p_tierlist_id);
  elsif p_guest_id is not null then
    v_eligible := exists (
      select 1
      from public.submissions s
      where s.tierlist_id = p_tierlist_id
        and s.guest_id = p_guest_id
    );
  end if;

  if not v_eligible then
    raise exception 'rankle: submit your ranking before viewing results'
      using errcode = 'insufficient_privilege';
  end if;

  select jsonb_build_object(
    'tierlist', (
      select jsonb_build_object(
        'id', t.id,
        'slug', t.slug,
        'title', t.title,
        'prompt', t.prompt,
        'tier_config', t.tier_config
      )
      from public.tierlists t
      where t.id = p_tierlist_id
    ),
    'total_submissions', (
      select count(*)
      from public.submissions s
      where s.tierlist_id = p_tierlist_id
    ),
    'items', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'item_id', ti.id,
            'label', ti.label,
            'image_url', ti.image_url,
            'sort_order', ti.sort_order,
            'tier_counts', coalesce(st.tier_counts, '{}'::jsonb),
            'n', coalesce(st.total_submissions, 0),
            'sum_weight', coalesce(st.sum_weight, 0),
            'avg_weight', case
              when coalesce(st.total_submissions, 0) > 0
              then round(st.sum_weight::numeric / st.total_submissions, 3)
              else null
            end
          )
          order by ti.sort_order
        ),
        '[]'::jsonb
      )
      from public.tierlist_items ti
      left join public.tierlist_item_stats st on st.tierlist_item_id = ti.id
      where ti.tierlist_id = p_tierlist_id
    ),
    'my_ranking', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'item_id', si.tierlist_item_id,
            'tier', si.tier,
            'position', si.position
          )
          order by si.tier, si.position
        ),
        '[]'::jsonb
      )
      from public.submission_items si
      join public.submissions s on s.id = si.submission_id
      where s.tierlist_id = p_tierlist_id
        and (
          (v_uid is not null and s.user_id = v_uid)
          or (v_uid is null and s.guest_id = p_guest_id)
        )
    )
  )
  into v_result;

  return v_result;
end;
$$;

revoke all on function public.get_results(uuid, uuid) from public;
grant execute on function public.get_results(uuid, uuid) to anon, authenticated;
