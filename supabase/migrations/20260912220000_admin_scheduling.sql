-- Rankle -- Milestone 8: admin & scheduling
--
-- Depends on migrations 1-11 (core schema through the friend-RPC grant
-- hardening). Adds the operational tooling required to run Rankle every day
-- without manually editing the database.
--
-- Sections:
--   1. Lifecycle constraints (draft <-> release_date nullability)
--   2. private.current_daily_game_id() -- the ONE authoritative "what game is
--      current" resolver, caller-independent (admin/authenticated/anon alike)
--   3. public.get_daily_game() -- player-facing reader built on #2
--   4. submit_ranking() -- tightened to require the *current* game, not just
--      "any released, non-archived game"
--   5. Historical-lock triggers on tierlists / tierlist_items
--   6. Admin RPCs: schedule_tierlist, unschedule_tierlist, duplicate_tierlist,
--      set_tierlist_items
--   7. Grants: narrow tierlists/tierlist_items client privileges now that the
--      RPCs above are the sole write path for scheduling/items; explicit
--      per-role revokes on every new function (see the M6/M7 "remote default
--      ACL" lessons -- this migration is written hardened from the start
--      rather than needing a follow-up correction migration).

------------------------------------------------------------------------
-- 1. Lifecycle constraints
--
-- draft            => release_date IS NULL (a draft never reserves a date)
-- scheduled/live/archived => release_date IS NOT NULL (already implied by
--   product behavior; made explicit so the two states can never be confused)
-- disabled         => unconstrained (legacy/reserved, unused by any code path)
--
-- Every place that transitions status also sets release_date in the SAME
-- UPDATE/INSERT statement (schedule_tierlist, unschedule_tierlist, the plain
-- create-draft insert), so there is never a transient row that violates
-- these checks mid-transaction.
------------------------------------------------------------------------
alter table public.tierlists
  add constraint tierlists_draft_release_date_null
    check (status <> 'draft' or release_date is null);

alter table public.tierlists
  add constraint tierlists_released_requires_release_date
    check (status not in ('scheduled', 'live', 'archived') or release_date is not null);

------------------------------------------------------------------------
-- 2. private.current_daily_game_id()
--
-- The single authoritative "what is today's game" resolver. Caller-
-- independent by construction: SECURITY DEFINER, reads the base table
-- directly (no RLS involved), so an admin, a non-admin authenticated user,
-- and an anonymous visitor all resolve the identical id.
--
-- 'live' is accepted for backward/forward compatibility with the existing
-- status check constraint, but no code path in this migration ever writes
-- it -- "current" is entirely derived from 'scheduled' + release_date.
--
-- Deliberately preserves pre-M8 behavior: the most recently released game
-- remains current until a newer one is released (NOT release_date = today).
-- A scheduling gap does not blank out the current game.
------------------------------------------------------------------------
create or replace function private.current_daily_game_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select t.id
  from public.tierlists t
  where t.status in ('scheduled', 'live')
    and t.release_date is not null
    and t.release_date <= private.today()
  order by t.release_date desc, t.id desc
  limit 1;
$$;
revoke all on function private.current_daily_game_id() from public, anon, authenticated;

------------------------------------------------------------------------
-- 3. public.get_daily_game()
--
-- Player-facing reader, replacing the raw `tierlists` query getDailyGame()
-- used to run under RLS. Returns the same shape the app's existing
-- DAILY_GAME_SELECT / mapDailyGame() already expect (including the
-- `tierlist_items` key name), so the only application change is the call
-- site, not the schema. Returns SQL NULL when no game is current.
------------------------------------------------------------------------
create or replace function public.get_daily_game()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', t.id,
    'slug', t.slug,
    'title', t.title,
    'prompt', t.prompt,
    'release_date', t.release_date,
    'tier_config', t.tier_config,
    'tierlist_items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', ti.id,
            'label', ti.label,
            'image_url', ti.image_url,
            'sort_order', ti.sort_order
          )
          order by ti.sort_order
        )
        from public.tierlist_items ti
        where ti.tierlist_id = t.id
      ),
      '[]'::jsonb
    )
  )
  from public.tierlists t
  where t.id = private.current_daily_game_id();
$$;

revoke all on function public.get_daily_game() from public;
grant execute on function public.get_daily_game() to anon, authenticated;

------------------------------------------------------------------------
-- public.is_admin_user(): thin wrapper so the admin UI can gate itself
-- server-side without ever reading profiles.is_admin directly (that column
-- has no client SELECT grant at all, by design -- migration 1). Reveals
-- nothing beyond the caller's own admin status; mirrors the
-- has_submitted_ranking wrapper already used for private.has_submitted.
------------------------------------------------------------------------
create or replace function public.is_admin_user()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_admin();
$$;

revoke all on function public.is_admin_user() from public, anon;
grant execute on function public.is_admin_user() to authenticated;

------------------------------------------------------------------------
-- 4. submit_ranking(): require the CURRENT game, not just "any released,
--    non-archived game". This is the fix for the audited mismatch: without
--    it, a superseded 'scheduled' game with a past release_date remained
--    submittable forever. `is distinct from` is required here (not <>) so
--    that "no current game exists" (NULL) correctly rejects every
--    submission attempt instead of silently passing a NULL comparison.
--
-- Identity handling (v_uid / p_guest_id), payload validation, and the
-- aggregate-update step are all unchanged from migration 6 (na_tier_scale).
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

  -- Milestone 6: a claimed guest submission for this game counts as this
  -- user's own. The unique index on (tierlist_id, user_id) cannot catch this
  -- case on its own -- a claimed row still has user_id IS NULL -- so this is
  -- an explicit pre-check, raising the SAME errcode the index raises below
  -- for an ordinary duplicate (unchanged from migration 8).
  if v_uid is not null and exists (
    select 1
    from public.claimed_guest_submissions c
    join public.submissions s on s.id = c.submission_id
    where c.user_id = v_uid and s.tierlist_id = p_tierlist_id
  ) then
    raise exception 'rankle: you have already submitted an official ranking for this game'
      using errcode = 'unique_violation';
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

  -- release authorization: must be THE current daily game (single source of
  -- truth shared with get_daily_game()) -- not merely "released and not
  -- archived". `is distinct from` treats "no current game" (NULL) as a
  -- rejection rather than a no-op comparison.
  if p_tierlist_id is distinct from private.current_daily_game_id() then
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
  -- records it, but it must NEVER feed total_submissions or sum_weight.
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

revoke all on function public.submit_ranking(uuid, jsonb, uuid) from public, anon, authenticated;
grant execute on function public.submit_ranking(uuid, jsonb, uuid) to anon, authenticated;

------------------------------------------------------------------------
-- 5. Historical-lock triggers
--
-- Once ANY official submission exists for a tierlist, freeze it and its
-- items completely: no field changes, no item insert/update/delete, no
-- deletion of the tierlist itself. Enforced at the database level so no
-- client role -- not even a bug in the admin RPCs below -- can bypass it.
--
-- These are BEFORE ROW triggers, same family as `tg_block_update` (used for
-- submissions/submission_items immutability); this one is conditional on
-- "does this tierlist have a submission" rather than unconditional. Firing
-- BEFORE the pre-existing `tierlists_set_updated_at` touch trigger doesn't
-- matter: if this trigger raises, the whole UPDATE aborts before any change
-- (including updated_at) is written, so there is no path where a "harmless"
-- updated_at bump sneaks through on a locked row.
--
-- A BEFORE DELETE trigger on tierlists blocks deletion outright once
-- submissions exist, which also prevents ON DELETE CASCADE from ever
-- reaching a real submissions row -- cascade deletes of children happen
-- only as a consequence of a parent delete that already succeeded, and this
-- trigger stops that delete before it starts.
------------------------------------------------------------------------
create or replace function private.tg_block_tierlist_edit_if_submitted()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid := coalesce(new.id, old.id);
begin
  if exists (select 1 from public.submissions where tierlist_id = v_id) then
    raise exception 'rankle: % on tierlists is not allowed once a Rankle has official submissions',
      tg_op
      using errcode = 'restrict_violation';
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function private.tg_block_tierlist_edit_if_submitted() from public, anon, authenticated;

create trigger tierlists_block_edit_if_submitted
  before update or delete on public.tierlists
  for each row execute function private.tg_block_tierlist_edit_if_submitted();

create or replace function private.tg_block_item_edit_if_submitted()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_tierlist_id uuid := coalesce(new.tierlist_id, old.tierlist_id);
begin
  if exists (select 1 from public.submissions where tierlist_id = v_tierlist_id) then
    raise exception 'rankle: % on tierlist_items is not allowed once a Rankle has official submissions',
      tg_op
      using errcode = 'restrict_violation';
  end if;
  return coalesce(new, old);
end;
$$;
revoke all on function private.tg_block_item_edit_if_submitted() from public, anon, authenticated;

create trigger tierlist_items_block_edit_if_submitted
  before insert or update or delete on public.tierlist_items
  for each row execute function private.tg_block_item_edit_if_submitted();

------------------------------------------------------------------------
-- 6. Admin RPCs
------------------------------------------------------------------------

-- schedule_tierlist: draft|scheduled -> scheduled, atomically setting
-- status + release_date in one UPDATE. Past dates rejected; date conflicts
-- surface the pre-existing tierlists_release_date_key unique index as a
-- friendly domain error rather than a raw 23505.
create or replace function public.schedule_tierlist(
  p_tierlist_id  uuid,
  p_release_date date
)
returns public.tierlists
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tierlists%rowtype;
begin
  if not private.is_admin() then
    raise exception 'rankle: admin access required' using errcode = 'insufficient_privilege';
  end if;

  if p_release_date is null then
    raise exception 'rankle: a release date is required' using errcode = 'invalid_parameter_value';
  end if;

  if p_release_date < private.today() then
    raise exception 'rankle: cannot schedule a Rankle in the past'
      using errcode = 'invalid_parameter_value';
  end if;

  if exists (select 1 from public.submissions where tierlist_id = p_tierlist_id) then
    raise exception 'rankle: this Rankle already has official submissions and can no longer be rescheduled'
      using errcode = 'restrict_violation';
  end if;

  begin
    update public.tierlists
    set status = 'scheduled', release_date = p_release_date
    where id = p_tierlist_id
      and status in ('draft', 'scheduled')
    returning * into v_row;
  exception when unique_violation then
    raise exception 'rankle: another Rankle is already scheduled for that date'
      using errcode = 'unique_violation';
  end;

  if not found then
    raise exception 'rankle: Rankle not found, or not in a schedulable state'
      using errcode = 'no_data_found';
  end if;

  return v_row;
end;
$$;

revoke all on function public.schedule_tierlist(uuid, date) from public, anon, authenticated;
grant execute on function public.schedule_tierlist(uuid, date) to authenticated;

-- unschedule_tierlist: scheduled (future only) -> draft, atomically clearing
-- release_date in the same UPDATE. "Future only" (release_date > today)
-- already implies zero submissions, since submit_ranking requires the
-- target to be the *current* game, which by definition never has a future
-- release_date -- no separate submission count check is needed here.
create or replace function public.unschedule_tierlist(
  p_tierlist_id uuid
)
returns public.tierlists
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.tierlists%rowtype;
begin
  if not private.is_admin() then
    raise exception 'rankle: admin access required' using errcode = 'insufficient_privilege';
  end if;

  update public.tierlists
  set status = 'draft', release_date = null
  where id = p_tierlist_id
    and status = 'scheduled'
    and release_date > private.today()
  returning * into v_row;

  if not found then
    raise exception 'rankle: Rankle not found, or not a future scheduled Rankle'
      using errcode = 'no_data_found';
  end if;

  return v_row;
end;
$$;

revoke all on function public.unschedule_tierlist(uuid) from public, anon, authenticated;
grant execute on function public.unschedule_tierlist(uuid) to authenticated;

-- duplicate_tierlist: any source status -> a brand-new draft with fresh
-- tierlist + item ids. Never copies release_date/status/submissions/
-- submission_items/tierlist_item_stats/shares.
create or replace function public.duplicate_tierlist(
  p_source_id uuid,
  p_new_slug  text
)
returns public.tierlists
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source public.tierlists%rowtype;
  v_new    public.tierlists%rowtype;
begin
  if not private.is_admin() then
    raise exception 'rankle: admin access required' using errcode = 'insufficient_privilege';
  end if;

  select * into v_source from public.tierlists where id = p_source_id;
  if not found then
    raise exception 'rankle: source Rankle not found' using errcode = 'no_data_found';
  end if;

  begin
    insert into public.tierlists (slug, title, prompt, tier_config, status, created_by)
    values (p_new_slug, v_source.title, v_source.prompt, v_source.tier_config, 'draft', (select auth.uid()))
    returning * into v_new;
  exception when unique_violation then
    raise exception 'rankle: that slug is already in use' using errcode = 'unique_violation';
  end;

  insert into public.tierlist_items (tierlist_id, label, image_url, sort_order)
  select v_new.id, ti.label, ti.image_url, ti.sort_order
  from public.tierlist_items ti
  where ti.tierlist_id = p_source_id
  order by ti.sort_order;

  return v_new;
end;
$$;

revoke all on function public.duplicate_tierlist(uuid, text) from public, anon, authenticated;
grant execute on function public.duplicate_tierlist(uuid, text) to authenticated;

-- set_tierlist_items: atomic full replace (add/remove/rename/reorder/image
-- in one transaction). Blocked once submissions exist -- the pre-check below
-- gives a friendly error; the trigger in section 5 is the actual DB-level
-- authority regardless.
--
-- p_items shape: [{ "label": text, "image_url": text|null, "sort_order": int }, ...]
-- Item ids are never accepted from the client: this is a full replace, not a
-- merge, and there are no submissions yet to preserve continuity for.
create or replace function public.set_tierlist_items(
  p_tierlist_id uuid,
  p_items       jsonb
)
returns setof public.tierlist_items
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if not private.is_admin() then
    raise exception 'rankle: admin access required' using errcode = 'insufficient_privilege';
  end if;

  if not exists (select 1 from public.tierlists where id = p_tierlist_id) then
    raise exception 'rankle: Rankle not found' using errcode = 'no_data_found';
  end if;

  if exists (select 1 from public.submissions where tierlist_id = p_tierlist_id) then
    raise exception 'rankle: this Rankle already has official submissions and its items can no longer be edited'
      using errcode = 'restrict_violation';
  end if;

  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception 'rankle: items payload must be a JSON array'
      using errcode = 'invalid_parameter_value';
  end if;

  select count(*) into v_count from jsonb_array_elements(p_items);
  if v_count = 0 then
    raise exception 'rankle: a Rankle needs at least one item'
      using errcode = 'invalid_parameter_value';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) e
    where (e ->> 'label') is null
       or char_length(trim(e ->> 'label')) < 1
       or char_length(e ->> 'label') > 120
       or (e ->> 'sort_order') is null
       or (e ->> 'sort_order')::integer < 0
       or ((e ->> 'image_url') is not null and (e ->> 'image_url') !~ '^https://')
  ) then
    raise exception 'rankle: items payload contains an invalid label, sort order, or image url'
      using errcode = 'invalid_parameter_value';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(p_items) e
    group by (e ->> 'sort_order')::integer
    having count(*) > 1
  ) then
    raise exception 'rankle: two items share the same sort order'
      using errcode = 'invalid_parameter_value';
  end if;

  delete from public.tierlist_items where tierlist_id = p_tierlist_id;

  insert into public.tierlist_items (tierlist_id, label, image_url, sort_order)
  select
    p_tierlist_id,
    trim(e ->> 'label'),
    e ->> 'image_url',
    (e ->> 'sort_order')::integer
  from jsonb_array_elements(p_items) e;

  return query
    select * from public.tierlist_items where tierlist_id = p_tierlist_id order by sort_order;
end;
$$;

revoke all on function public.set_tierlist_items(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.set_tierlist_items(uuid, jsonb) to authenticated;

------------------------------------------------------------------------
-- 7. Grants: narrow tierlists/tierlist_items client privileges
--
-- tierlists: status/release_date/tier_config now change ONLY through the
-- RPCs above (which run SECURITY DEFINER and bypass table grants entirely).
-- Direct client access is narrowed to plain draft metadata (create with
-- title/prompt/slug; edit title/prompt/slug; delete), matching the approved
-- "simple metadata CRUD may use RLS-gated table ops, protected independently
-- by the historical-lock trigger" principle. status/release_date/tier_config
-- get their column defaults ('draft', null, the canonical scale) on insert
-- and are otherwise admin-RPC-only.
--
-- tierlist_items: ALL client table access removed. Every item mutation goes
-- through set_tierlist_items(); reads remain via the existing RLS SELECT
-- policy (unchanged).
------------------------------------------------------------------------
revoke insert, update on public.tierlists from authenticated;
grant insert (slug, title, prompt, created_by) on public.tierlists to authenticated;
grant update (title, prompt, slug) on public.tierlists to authenticated;
-- delete stays table-level (unchanged from migration 4); the historical-lock
-- trigger is the actual authority once submissions exist.

revoke insert, update, delete on public.tierlist_items from authenticated;
-- select stays table-level (unchanged from migration 4).
