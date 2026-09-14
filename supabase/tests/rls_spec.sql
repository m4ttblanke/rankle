-- Rankle -- RLS / security behavioural checks (pure SQL, no psql meta-commands).
--
-- Standalone use (migrations already applied to a LOCAL stack):
--   psql "<local db url>" -f supabase/tests/rls_spec.sql
--
-- The script wraps itself in BEGIN ... ROLLBACK: fixtures never persist. It
-- also drives the pre-apply dry-run (migrations + this body inside one aborted
-- transaction). Results are collected into a temp table and printed at the end;
-- every assertion records PASS or FAIL and execution continues.

begin;

-- =====================================================================
-- harness
-- =====================================================================
create temporary table _t (
  id      serial primary key,
  name    text not null,
  status  text not null,
  detail  text not null default ''
) on commit drop;

create or replace function pg_temp.rec(p_name text, p_ok boolean, p_detail text default '')
returns void language plpgsql as $$
begin
  insert into _t(name, status, detail)
  values (p_name, case when p_ok then 'PASS' else 'FAIL' end, coalesce(p_detail, ''));
end;
$$;

-- run p_sql as p_role (with optional jwt sub); return NULL on success, else SQLSTATE.
-- Always restores role AND clears request.jwt.claims so nothing leaks to the next step.
create or replace function pg_temp.run_as(p_role text, p_sub uuid, p_sql text)
returns text language plpgsql as $$
begin
  if p_sub is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', p_sub, 'role', p_role)::text, true);
  else
    perform set_config('request.jwt.claims', NULL, true);
  end if;
  execute 'set local role ' || quote_ident(p_role);
  begin
    execute p_sql;
    execute 'reset role';
    perform set_config('request.jwt.claims', NULL, true);
    return NULL;
  exception when others then
    execute 'reset role';
    perform set_config('request.jwt.claims', NULL, true);
    return sqlstate;
  end;
end;
$$;

-- same, but capture a single jsonb value from p_sql
create or replace function pg_temp.eval_as(p_role text, p_sub uuid, p_sql text)
returns jsonb language plpgsql as $$
declare v jsonb;
begin
  if p_sub is not null then
    perform set_config('request.jwt.claims',
      json_build_object('sub', p_sub, 'role', p_role)::text, true);
  else
    perform set_config('request.jwt.claims', NULL, true);
  end if;
  execute 'set local role ' || quote_ident(p_role);
  begin
    execute p_sql into v;
    execute 'reset role';
    perform set_config('request.jwt.claims', NULL, true);
    return v;
  exception when others then
    execute 'reset role';
    perform set_config('request.jwt.claims', NULL, true);
    return jsonb_build_object('__error__', sqlstate, 'msg', sqlerrm);
  end;
end;
$$;

-- assert that running p_sql as p_role raises p_expect (SQLSTATE)
create or replace function pg_temp.expect_err(p_name text, p_role text, p_sub uuid, p_sql text, p_expect text)
returns void language plpgsql as $$
declare got text;
begin
  got := pg_temp.run_as(p_role, p_sub, p_sql);
  if got is null then
    perform pg_temp.rec(p_name, false, 'expected SQLSTATE ' || p_expect || ' but statement succeeded');
  elsif got = p_expect then
    perform pg_temp.rec(p_name, true, 'SQLSTATE ' || got);
  else
    perform pg_temp.rec(p_name, false, 'expected ' || p_expect || ' got ' || got);
  end if;
end;
$$;

create or replace function pg_temp.expect_ok(p_name text, p_role text, p_sub uuid, p_sql text)
returns void language plpgsql as $$
declare got text;
begin
  got := pg_temp.run_as(p_role, p_sub, p_sql);
  if got is null then
    perform pg_temp.rec(p_name, true);
  else
    perform pg_temp.rec(p_name, false, 'unexpected SQLSTATE ' || got);
  end if;
end;
$$;

-- M8 fixture helper: mirrors submit_ranking's write path (insert submission +
-- items, update tierlist_item_stats with the same N/A-exclusion rule) but
-- skips the "must be the CURRENT game" gate. Runs as the file owner (bypasses
-- RLS, same convention as every other fixture in this file).
--
-- Needed because na-game / teardown-game are deliberately dated in the past
-- to represent "yesterday's Rankle" fixtures for claim/teardown/aggregate
-- tests below. Under M8's tightened submit_ranking (section 11), a game with
-- an older release_date than the current live-game can no longer accept a
-- new official submission through the real RPC -- by design, that is exactly
-- what M8 fixes. These fixtures still need real submission + aggregate rows
-- to exercise the OTHER features built on top of them, so they're created
-- directly rather than through the now-appropriately-narrower RPC.
create or replace function pg_temp.fixture_submit(
  p_tierlist_id uuid,
  p_user_id     uuid,
  p_guest_id    uuid,
  p_items       jsonb
)
returns uuid
language plpgsql as $$
declare
  v_tl     public.tierlists%rowtype;
  v_sub_id uuid;
begin
  select * into v_tl from public.tierlists where id = p_tierlist_id;

  insert into public.submissions (tierlist_id, user_id, guest_id)
  values (p_tierlist_id, p_user_id, p_guest_id)
  returning id into v_sub_id;

  insert into public.submission_items (submission_id, tierlist_item_id, tier, position)
  select v_sub_id, (e ->> 'item_id')::uuid, (e ->> 'tier'), (e ->> 'position')::integer
  from jsonb_array_elements(p_items) e;

  insert into public.tierlist_item_stats (tierlist_item_id, tierlist_id)
  select si.tierlist_item_id, p_tierlist_id
  from public.submission_items si
  where si.submission_id = v_sub_id
  on conflict (tierlist_item_id) do nothing;

  update public.tierlist_item_stats s
  set
    tier_counts = jsonb_set(
      s.tier_counts, array[si.tier],
      to_jsonb(coalesce((s.tier_counts ->> si.tier)::integer, 0) + 1), true
    ),
    total_submissions = s.total_submissions + case when si.tier = 'N/A' then 0 else 1 end,
    sum_weight = s.sum_weight
      + case when si.tier = 'N/A' then 0 else private.tier_weight(v_tl.tier_config, si.tier) end,
    updated_at = now()
  from public.submission_items si
  where si.submission_id = v_sub_id
    and s.tierlist_item_id = si.tierlist_item_id;

  return v_sub_id;
end;
$$;

-- harness sanity: SET ROLE must actually work, or role-scoped tests are meaningless
do $$
begin
  perform pg_temp.rec('harness: can SET ROLE anon',          pg_temp.run_as('anon', null, 'select 1') is null);
  perform pg_temp.rec('harness: can SET ROLE authenticated', pg_temp.run_as('authenticated', null, 'select 1') is null);
end;
$$;

-- =====================================================================
-- fixtures (run as owner; bypasses RLS)
-- =====================================================================
-- Start from a known-empty state regardless of any local dev seed
-- (supabase/seed.sql inserts demo games, one released today, which would
-- collide with the fixtures below). Everything here is inside the
-- BEGIN ... ROLLBACK wrapper, so nothing is actually removed.
truncate table public.tierlists cascade;
delete from auth.users;

insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'alice@rankle.test', now(), now(), now()),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'bob@rankle.test',   now(), now(), now()),
  ('cccccccc-0000-0000-0000-000000000003', 'authenticated', 'authenticated', 'carol@rankle.test', now(), now(), now());

-- handle_new_user trigger should have created 3 profiles
do $$
begin
  perform pg_temp.rec('handle_new_user: 3 profiles created',
    (select count(*) = 3 from public.profiles),
    'count=' || (select count(*)::text from public.profiles));
  perform pg_temp.rec('handle_new_user: usernames match format',
    (select bool_and(username ~ '^[a-z0-9_]{3,20}$') from public.profiles));
end;
$$;

update public.profiles set is_admin = true where id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Friendly, literal usernames (auto-generated `user_<hex>` otherwise) so the
-- Milestone 7 search_profiles/list_friend_requests assertions below can
-- assert on human-readable prefixes instead of derived hex fragments.
update public.profiles set username = 'alice' where id = 'aaaaaaaa-0000-0000-0000-000000000001';
update public.profiles set username = 'bob'   where id = 'bbbbbbbb-0000-0000-0000-000000000002';
update public.profiles set username = 'carol' where id = 'cccccccc-0000-0000-0000-000000000003';

-- =====================================================================
-- M8: day-rollover demonstration for current_daily_game_id() / get_daily_game()
--     / the tightened submit_ranking(). Deliberately run FIRST and on an
--     otherwise-empty tierlists table (before the main fixture block below),
--     because current_daily_game_id() always resolves the GLOBAL
--     most-recently-released game -- proving "A is current, B releases, A is
--     superseded, B becomes current" honestly requires A and B to be the
--     only candidates at each check, not competing with live-game's
--     always-wins today() date. The scratch rows are truncated away
--     immediately after so they cannot interfere with any later section.
-- =====================================================================
do $$
declare
  day_a  uuid := '0a000000-0000-0000-0000-0000000000a1';
  day_b  uuid := '0a000000-0000-0000-0000-0000000000b1';
  item_a uuid := '0a000000-0000-0000-0000-0000000000a2';
  item_b uuid := '0a000000-0000-0000-0000-0000000000b2';
begin
  insert into public.tierlists (id, slug, title, status, release_date, tier_config)
  values (day_a, 'm8-day-a', 'M8 Day A', 'scheduled', private.today() - 3,
    '["S","A","B","C","F","N/A"]'::jsonb);
  insert into public.tierlist_items (id, tierlist_id, label, sort_order)
  values (item_a, day_a, 'Only Item', 0);

  perform pg_temp.rec('day-rollover: A is current while it is the only released game',
    (pg_temp.eval_as('anon', null, 'select public.get_daily_game()') ->> 'slug') = 'm8-day-a');

  perform pg_temp.rec('day-rollover: A accepts a submission while it is current',
    pg_temp.run_as('anon', null, format(
      'select public.submit_ranking(%L, %L::jsonb, %L)', day_a,
      '[{"item_id":"' || item_a || '","tier":"S","position":0}]',
      '0a000000-0000-0000-0000-0000000000e1')) is null);

  -- game B releases (its release_date is more recent than A's, but still
  -- <= today -- an already-released historical date, not a future one)
  insert into public.tierlists (id, slug, title, status, release_date, tier_config)
  values (day_b, 'm8-day-b', 'M8 Day B', 'scheduled', private.today() - 1,
    '["S","A","B","C","F","N/A"]'::jsonb);
  insert into public.tierlist_items (id, tierlist_id, label, sort_order)
  values (item_b, day_b, 'Only Item', 0);

  perform pg_temp.rec('day-rollover: B becomes current the moment it releases',
    (pg_temp.eval_as('anon', null, 'select public.get_daily_game()') ->> 'slug') = 'm8-day-b');
  perform pg_temp.rec('day-rollover: admin (alice) resolves the SAME current game as anon',
    (pg_temp.eval_as('authenticated', 'aaaaaaaa-0000-0000-0000-000000000001',
      'select public.get_daily_game()') ->> 'slug') = 'm8-day-b');
  perform pg_temp.rec('day-rollover: a non-admin authenticated user (bob) also resolves the SAME current game',
    (pg_temp.eval_as('authenticated', 'bbbbbbbb-0000-0000-0000-000000000002',
      'select public.get_daily_game()') ->> 'slug') = 'm8-day-b');

  perform pg_temp.rec('day-rollover: A can no longer accept a NEW official submission once B is current (23001)',
    pg_temp.run_as('anon', null, format(
      'select public.submit_ranking(%L, %L::jsonb, %L)', day_a,
      '[{"item_id":"' || item_a || '","tier":"A","position":0}]',
      '0a000000-0000-0000-0000-0000000000e2')) = '23001');

  perform pg_temp.rec('day-rollover: B (now the most recent) accepts a submission',
    pg_temp.run_as('anon', null, format(
      'select public.submit_ranking(%L, %L::jsonb, %L)', day_b,
      '[{"item_id":"' || item_b || '","tier":"S","position":0}]',
      '0a000000-0000-0000-0000-0000000000e3')) is null);
end;
$$;

-- clear the day-rollover scratch rows (cascades submissions/items too) so the
-- main fixture block below starts from a clean slate.
truncate table public.tierlists cascade;

insert into public.tierlists (id, slug, title, status, release_date, tier_config, created_by)
values
  ('11111111-1111-1111-1111-111111111111', 'live-game', 'Live Game', 'live',
   private.today(), '["S","A","B","C","F","N/A"]'::jsonb, 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('22222222-2222-2222-2222-222222222222', 'future-game', 'Future Game', 'scheduled',
   private.today() + 30, '["S","A","B","C","F","N/A"]'::jsonb, 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('33333333-3333-3333-3333-333333333333', 'teardown-game', 'Teardown Game', 'live',
   private.today() - 1, '["S","A","B","C","F","N/A"]'::jsonb, 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('44444444-4444-4444-4444-444444444444', 'na-game', 'NA Game', 'live',
   private.today() - 2, '["S","A","B","C","F","N/A"]'::jsonb, 'aaaaaaaa-0000-0000-0000-000000000001');

insert into public.tierlist_items (id, tierlist_id, label, sort_order) values
  ('10000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'Item A', 0),
  ('10000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111', 'Item B', 1),
  ('10000000-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'Item C', 2),
  ('20000000-0000-0000-0000-0000000000a2', '22222222-2222-2222-2222-222222222222', 'Future Item', 0),
  ('30000000-0000-0000-0000-0000000000a3', '33333333-3333-3333-3333-333333333333', 'Teardown Item', 0),
  ('40000000-0000-0000-0000-0000000000a4', '44444444-4444-4444-4444-444444444444', 'NA Item A', 0),
  ('40000000-0000-0000-0000-0000000000b4', '44444444-4444-4444-4444-444444444444', 'NA Item B', 1);

-- =====================================================================
-- 1. private helpers behave; direct client calls are blocked
-- =====================================================================
do $$
begin
  perform pg_temp.rec('tier_weight S/F/Z = 6/2/0',
    private.tier_weight('["S","A","B","C","F","N/A"]'::jsonb, 'S') = 6
    and private.tier_weight('["S","A","B","C","F","N/A"]'::jsonb, 'F') = 2
    and private.tier_weight('["S","A","B","C","F","N/A"]'::jsonb, 'Z') = 0);
  -- tier_weight itself is purely positional and does NOT know "N/A" is
  -- special (it would return 1 here, one below F's 2) -- the exclusion from
  -- sum_weight/total_submissions happens in submit_ranking, not here. See
  -- section 4c below for the behavior that actually matters.
  perform pg_temp.rec('tier_weight is positional-only; N/A exclusion is submit_ranking''s job, not tier_weight''s',
    private.tier_weight('["S","A","B","C","F","N/A"]'::jsonb, 'N/A') = 1);
  perform pg_temp.rec('is_tierlist_public: live=true future=false',
    private.is_tierlist_public('11111111-1111-1111-1111-111111111111')
    and not private.is_tierlist_public('22222222-2222-2222-2222-222222222222'));
end;
$$;

select pg_temp.expect_err('anon cannot call private.today()', 'anon', null, 'select private.today()', '42501');

-- private.is_admin() / private.has_submitted() are INTENTIONALLY EXECUTE-granted
-- to anon/authenticated (migrations 1-2): Postgres requires the querying role
-- to hold EXECUTE on any SECURITY DEFINER function named inside an RLS policy
-- expression, or every anon/authenticated read gated by that policy fails
-- outright (see migration 1's comment above `grant execute on function
-- private.is_admin()`). This is a SQL-level grant only -- it does NOT imply
-- HTTP/API exposure: PostgREST only serves functions from its exposed
-- schema(s) (`public`), never `private`, so these are not reachable as RPC
-- endpoints regardless of this grant. That boundary is verified separately in
-- lib/supabase/private-schema-exposure.integration.test.ts (local Supabase).
select pg_temp.expect_ok('authed CAN call private.is_admin() (required for RLS policy evaluation; not API-reachable)',
  'authenticated', 'bbbbbbbb-0000-0000-0000-000000000002', 'select private.is_admin()');
select pg_temp.expect_ok('authed CAN call private.has_submitted() (required for RLS policy evaluation; not API-reachable)',
  'authenticated', 'bbbbbbbb-0000-0000-0000-000000000002',
  'select private.has_submitted(''11111111-1111-1111-1111-111111111111'')');

-- public.rls_auto_enable() is a remote-only, pre-existing Supabase platform
-- event-trigger function (see migration 4's portability-guard comment) -- not
-- created by any migration here, so a clean local database never has it.
-- Only assert the revoke where the exact zero-argument, event_trigger-
-- returning function actually exists (mirrors the migration-4 guard's own
-- identity check, so a same-named-but-different overload can't satisfy it).
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'rls_auto_enable'
      and p.pronargs = 0
      and p.prorettype = 'pg_catalog.event_trigger'::regtype
  ) then
    perform pg_temp.expect_err('authed cannot call rls_auto_enable() (remote platform object)',
      'authenticated', 'bbbbbbbb-0000-0000-0000-000000000002', 'select public.rls_auto_enable()', '42501');
  else
    perform pg_temp.rec(
      'rls_auto_enable() check: function absent on this database (expected on a clean local stack)',
      true,
      'not applicable outside the remote platform project'
    );
  end if;
end;
$$;

-- =====================================================================
-- 2. visibility / spoiler gate on base tables
-- =====================================================================
do $$
begin
  perform pg_temp.rec('anon sees live game',
    (pg_temp.eval_as('anon', null,
      'select to_jsonb(count(*)) from public.tierlists where id = ''11111111-1111-1111-1111-111111111111''')) = '1'::jsonb);
  perform pg_temp.rec('anon does NOT see future game',
    (pg_temp.eval_as('anon', null,
      'select to_jsonb(count(*)) from public.tierlists where id = ''22222222-2222-2222-2222-222222222222''')) = '0'::jsonb);
  perform pg_temp.rec('anon does NOT see future game items',
    (pg_temp.eval_as('anon', null,
      'select to_jsonb(count(*)) from public.tierlist_items where tierlist_id = ''22222222-2222-2222-2222-222222222222''')) = '0'::jsonb);
end;
$$;

select pg_temp.expect_err('anon has no SELECT on tierlist_item_stats', 'anon', null, 'select 1 from public.tierlist_item_stats', '42501');
select pg_temp.expect_err('anon has no SELECT on submissions',         'anon', null, 'select 1 from public.submissions', '42501');
select pg_temp.expect_err('anon has no SELECT on submission_items',    'anon', null, 'select 1 from public.submission_items', '42501');
select pg_temp.expect_err('anon has no SELECT on shares',              'anon', null, 'select 1 from public.shares', '42501');
select pg_temp.expect_err('anon has no SELECT on profiles (profile change)', 'anon', null, 'select 1 from public.profiles', '42501');

-- authenticated profile reads: is_admin column is never selectable, and
-- (Milestone 7) direct table reads are narrowed to self / accepted friend /
-- admin -- NOT "any authenticated user, any row" as before M7. Full-graph
-- discovery is search_profiles()'s job now (section 9 below); this proves the
-- raw table can no longer be used to enumerate every account.
do $$
begin
  perform pg_temp.rec('authed with no relationships sees only their OWN profile row (M7 narrowing)',
    (pg_temp.eval_as('authenticated', 'cccccccc-0000-0000-0000-000000000003',
      'select to_jsonb(count(*)) from public.profiles')) = '1'::jsonb);
  perform pg_temp.rec('admin still sees every profile row directly',
    (pg_temp.eval_as('authenticated', 'aaaaaaaa-0000-0000-0000-000000000001',
      'select to_jsonb(count(*)) from public.profiles')) = '3'::jsonb);
end;
$$;
select pg_temp.expect_err('authed cannot read profiles.is_admin column', 'authenticated', 'cccccccc-0000-0000-0000-000000000003', 'select is_admin from public.profiles limit 1', '42501');
select pg_temp.expect_err('anon still has no SELECT on profiles at all (unchanged by M7)', 'anon', null, 'select 1 from public.profiles', '42501');

-- =====================================================================
-- 3. admin authorization on official content
-- =====================================================================
select pg_temp.expect_ok ('admin CAN insert a tierlist',      'authenticated', 'aaaaaaaa-0000-0000-0000-000000000001',
  'insert into public.tierlists (slug, title) values (''admin-made'', ''Admin Made'')');
select pg_temp.expect_err('non-admin CANNOT insert a tierlist','authenticated', 'bbbbbbbb-0000-0000-0000-000000000002',
  'insert into public.tierlists (slug, title) values (''sneaky'', ''Sneaky'')', '42501');
select pg_temp.expect_err('non-admin CANNOT insert a tierlist_item','authenticated', 'bbbbbbbb-0000-0000-0000-000000000002',
  'insert into public.tierlist_items (tierlist_id, label, sort_order) values (''11111111-1111-1111-1111-111111111111'', ''X'', 9)', '42501');
do $$
begin
  -- non-admin UPDATE: RLS USING is false -> 0 rows, no error, title unchanged
  perform pg_temp.run_as('authenticated', 'bbbbbbbb-0000-0000-0000-000000000002',
    'update public.tierlists set title = ''hacked'' where id = ''11111111-1111-1111-1111-111111111111''');
  perform pg_temp.rec('non-admin UPDATE of tierlist affects nothing',
    (select title = 'Live Game' from public.tierlists where id = '11111111-1111-1111-1111-111111111111'));
end;
$$;

-- =====================================================================
-- 4. submit_ranking: happy paths + payload validation + idempotent aggregates
-- =====================================================================
-- guest 1 submits a valid ranking
select pg_temp.expect_ok('guest submit (valid)', 'anon', null,
  'select public.submit_ranking(''11111111-1111-1111-1111-111111111111'',
     ''[{"item_id":"10000000-0000-0000-0000-0000000000a1","tier":"S","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000b1","tier":"A","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000c1","tier":"F","position":0}]''::jsonb,
     ''0f000000-0000-0000-0000-000000000001'')');

do $$
begin
  perform pg_temp.rec('aggregate after 1 submission: A={S:1} total=1 weight=6',
    (select tier_counts = '{"S": 1}'::jsonb and total_submissions = 1 and sum_weight = 6
     from public.tierlist_item_stats where tierlist_item_id = '10000000-0000-0000-0000-0000000000a1'));
end;
$$;

-- duplicate guest submission blocked
select pg_temp.expect_err('guest cannot submit twice', 'anon', null,
  'select public.submit_ranking(''11111111-1111-1111-1111-111111111111'',
     ''[{"item_id":"10000000-0000-0000-0000-0000000000a1","tier":"S","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000b1","tier":"A","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000c1","tier":"F","position":0}]''::jsonb,
     ''0f000000-0000-0000-0000-000000000001'')', '23505');

-- payload validation (all as a fresh guest 2 so identity is fine)
select pg_temp.expect_err('reject: partial ranking', 'anon', null,
  'select public.submit_ranking(''11111111-1111-1111-1111-111111111111'',
     ''[{"item_id":"10000000-0000-0000-0000-0000000000a1","tier":"S","position":0}]''::jsonb,
     ''0f000000-0000-0000-0000-000000000002'')', '22023');
select pg_temp.expect_err('reject: unknown tier', 'anon', null,
  'select public.submit_ranking(''11111111-1111-1111-1111-111111111111'',
     ''[{"item_id":"10000000-0000-0000-0000-0000000000a1","tier":"Z","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000b1","tier":"A","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000c1","tier":"B","position":0}]''::jsonb,
     ''0f000000-0000-0000-0000-000000000002'')', '22023');
select pg_temp.expect_err('reject: unknown item id', 'anon', null,
  'select public.submit_ranking(''11111111-1111-1111-1111-111111111111'',
     ''[{"item_id":"99999999-9999-9999-9999-999999999999","tier":"S","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000b1","tier":"A","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000c1","tier":"B","position":0}]''::jsonb,
     ''0f000000-0000-0000-0000-000000000002'')', '22023');
select pg_temp.expect_err('reject: item from a different game', 'anon', null,
  'select public.submit_ranking(''11111111-1111-1111-1111-111111111111'',
     ''[{"item_id":"20000000-0000-0000-0000-0000000000a2","tier":"S","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000b1","tier":"A","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000c1","tier":"B","position":0}]''::jsonb,
     ''0f000000-0000-0000-0000-000000000002'')', '22023');
select pg_temp.expect_err('reject: duplicate (tier,position) slot', 'anon', null,
  'select public.submit_ranking(''11111111-1111-1111-1111-111111111111'',
     ''[{"item_id":"10000000-0000-0000-0000-0000000000a1","tier":"S","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000b1","tier":"S","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000c1","tier":"B","position":0}]''::jsonb,
     ''0f000000-0000-0000-0000-000000000002'')', '22023');
select pg_temp.expect_err('reject: payload not a JSON array', 'anon', null,
  'select public.submit_ranking(''11111111-1111-1111-1111-111111111111'', ''{}''::jsonb,
     ''0f000000-0000-0000-0000-000000000002'')', '22023');
select pg_temp.expect_err('reject: submit to future game', 'anon', null,
  'select public.submit_ranking(''22222222-2222-2222-2222-222222222222'',
     ''[{"item_id":"20000000-0000-0000-0000-0000000000a2","tier":"S","position":0}]''::jsonb,
     ''0f000000-0000-0000-0000-000000000002'')', '23001');
select pg_temp.expect_err('reject: two identities (user + guest)', 'authenticated', 'bbbbbbbb-0000-0000-0000-000000000002',
  'select public.submit_ranking(''11111111-1111-1111-1111-111111111111'',
     ''[{"item_id":"10000000-0000-0000-0000-0000000000a1","tier":"S","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000b1","tier":"A","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000c1","tier":"B","position":0}]''::jsonb,
     ''0f000000-0000-0000-0000-000000000002'')', '23514');
select pg_temp.expect_err('reject: no identity (anon + null guest)', 'anon', null,
  'select public.submit_ranking(''11111111-1111-1111-1111-111111111111'',
     ''[{"item_id":"10000000-0000-0000-0000-0000000000a1","tier":"S","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000b1","tier":"A","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000c1","tier":"B","position":0}]''::jsonb,
     null)', '23514');

do $$
begin
  perform pg_temp.rec('transactional: failed submissions did NOT change aggregates',
    (select tier_counts = '{"S": 1}'::jsonb and total_submissions = 1 and sum_weight = 6
     from public.tierlist_item_stats where tierlist_item_id = '10000000-0000-0000-0000-0000000000a1'));
  perform pg_temp.rec('transactional: no partial submission rows for guest 2',
    (select count(*) = 0 from public.submissions where guest_id = '0f000000-0000-0000-0000-000000000002'));
end;
$$;

-- registered user submits
select pg_temp.expect_ok('registered user submit (valid)', 'authenticated', 'bbbbbbbb-0000-0000-0000-000000000002',
  'select public.submit_ranking(''11111111-1111-1111-1111-111111111111'',
     ''[{"item_id":"10000000-0000-0000-0000-0000000000a1","tier":"S","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000b1","tier":"A","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000c1","tier":"B","position":0}]''::jsonb,
     null)');
select pg_temp.expect_err('registered user cannot submit twice', 'authenticated', 'bbbbbbbb-0000-0000-0000-000000000002',
  'select public.submit_ranking(''11111111-1111-1111-1111-111111111111'',
     ''[{"item_id":"10000000-0000-0000-0000-0000000000a1","tier":"A","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000b1","tier":"A","position":1},
        {"item_id":"10000000-0000-0000-0000-0000000000c1","tier":"A","position":2}]''::jsonb,
     null)', '23505');

do $$
begin
  perform pg_temp.rec('aggregate after 2 submissions: A={S:2} total=2 weight=12',
    (select tier_counts = '{"S": 2}'::jsonb and total_submissions = 2 and sum_weight = 12
     from public.tierlist_item_stats where tierlist_item_id = '10000000-0000-0000-0000-0000000000a1'));
  perform pg_temp.rec('aggregate C = {F:1,B:1} total=2 weight=6',
    (select tier_counts = '{"B": 1, "F": 1}'::jsonb and total_submissions = 2 and sum_weight = 6
     from public.tierlist_item_stats where tierlist_item_id = '10000000-0000-0000-0000-0000000000c1'));
end;
$$;

-- =====================================================================
-- 4c. "N/A" tier: valid, complete, and excluded from the numeric aggregate
--     (isolated on its own game so it never perturbs live-game's
--     total_submissions counts, which sections 4b/6 rely on).
-- =====================================================================
-- na-game predates live-game (see M8 section 11), so it's no longer the
-- CURRENT game -- fixture_submit() sets up the same submission + aggregate
-- state submit_ranking would have produced, without going through the now
-- current-game-gated RPC (see the helper's own comment above).
do $$
begin
  perform pg_temp.rec('N/A submit (valid, complete)',
    pg_temp.fixture_submit(
      '44444444-4444-4444-4444-444444444444', null, '0f000000-0000-0000-0000-000000000005',
      '[{"item_id":"40000000-0000-0000-0000-0000000000a4","tier":"N/A","position":0},
        {"item_id":"40000000-0000-0000-0000-0000000000b4","tier":"S","position":0}]'::jsonb
    ) is not null);
end;
$$;

do $$
begin
  perform pg_temp.rec('N/A placement: tier_counts records it, but total_submissions/sum_weight stay 0',
    (select tier_counts = '{"N/A": 1}'::jsonb and total_submissions = 0 and sum_weight = 0
     from public.tierlist_item_stats where tierlist_item_id = '40000000-0000-0000-0000-0000000000a4'));
  perform pg_temp.rec('an S placement in the same submission still counts normally (weight=6)',
    (select tier_counts = '{"S": 1}'::jsonb and total_submissions = 1 and sum_weight = 6
     from public.tierlist_item_stats where tierlist_item_id = '40000000-0000-0000-0000-0000000000b4'));
end;
$$;

-- a second submission stacks the N/A count without ever touching
-- total_submissions/sum_weight -- proves it is not a one-off skip but a
-- standing exclusion.
do $$
begin
  perform pg_temp.rec('second N/A submit (different guest)',
    pg_temp.fixture_submit(
      '44444444-4444-4444-4444-444444444444', null, '0f000000-0000-0000-0000-000000000006',
      '[{"item_id":"40000000-0000-0000-0000-0000000000a4","tier":"N/A","position":0},
        {"item_id":"40000000-0000-0000-0000-0000000000b4","tier":"F","position":0}]'::jsonb
    ) is not null);
end;
$$;

do $$
begin
  perform pg_temp.rec('N/A count accumulates across submissions; total/weight stay 0 (never worse than F)',
    (select tier_counts = '{"N/A": 2}'::jsonb and total_submissions = 0 and sum_weight = 0
     from public.tierlist_item_stats where tierlist_item_id = '40000000-0000-0000-0000-0000000000a4'));
  perform pg_temp.rec('opinion tiers on the other item accumulate normally: S,F total=2 weight=8',
    (select tier_counts = '{"S": 1, "F": 1}'::jsonb and total_submissions = 2 and sum_weight = 8
     from public.tierlist_item_stats where tierlist_item_id = '40000000-0000-0000-0000-0000000000b4'));
end;
$$;

-- =====================================================================
-- 4b. has_submitted_ranking: spoiler-safe submission-state check (M3)
--     State so far: guest 0f..01 and registered user bob (bb..02) have each
--     submitted to live-game (11..11); carol (cc..03) has not; nobody has
--     submitted to future-game (22..22).
-- =====================================================================
do $$
begin
  perform pg_temp.rec('has_submitted_ranking: submitting guest -> true',
    pg_temp.eval_as('anon', null,
      'select to_jsonb(public.has_submitted_ranking(''11111111-1111-1111-1111-111111111111'',
        ''0f000000-0000-0000-0000-000000000001''))') = 'true'::jsonb);

  perform pg_temp.rec('has_submitted_ranking: different guest id -> false',
    pg_temp.eval_as('anon', null,
      'select to_jsonb(public.has_submitted_ranking(''11111111-1111-1111-1111-111111111111'',
        ''0f000000-0000-0000-0000-0000000000ff''))') = 'false'::jsonb);

  perform pg_temp.rec('has_submitted_ranking: anon + null guest -> false',
    pg_temp.eval_as('anon', null,
      'select to_jsonb(public.has_submitted_ranking(''11111111-1111-1111-1111-111111111111'', null))')
      = 'false'::jsonb);

  perform pg_temp.rec('has_submitted_ranking: guest has no submission for other game -> false',
    pg_temp.eval_as('anon', null,
      'select to_jsonb(public.has_submitted_ranking(''22222222-2222-2222-2222-222222222222'',
        ''0f000000-0000-0000-0000-000000000001''))') = 'false'::jsonb);

  perform pg_temp.rec('has_submitted_ranking: submitting user (bob), null guest -> true',
    pg_temp.eval_as('authenticated', 'bbbbbbbb-0000-0000-0000-000000000002',
      'select to_jsonb(public.has_submitted_ranking(''11111111-1111-1111-1111-111111111111'', null))')
      = 'true'::jsonb);

  perform pg_temp.rec('has_submitted_ranking: non-submitting user (carol) -> false',
    pg_temp.eval_as('authenticated', 'cccccccc-0000-0000-0000-000000000003',
      'select to_jsonb(public.has_submitted_ranking(''11111111-1111-1111-1111-111111111111'', null))')
      = 'false'::jsonb);

  -- an authenticated caller cannot read another identity's state by passing a guest id
  perform pg_temp.rec('has_submitted_ranking: authed caller + someone else''s guest id -> false',
    pg_temp.eval_as('authenticated', 'cccccccc-0000-0000-0000-000000000003',
      'select to_jsonb(public.has_submitted_ranking(''11111111-1111-1111-1111-111111111111'',
        ''0f000000-0000-0000-0000-000000000001''))') = 'false'::jsonb);
end;
$$;

-- =====================================================================
-- 5. submission immutability
-- =====================================================================
do $$
declare got text;
begin
  begin
    update public.submissions set submitted_at = now()
      where tierlist_id = '11111111-1111-1111-1111-111111111111';
    got := 'no-error';
  exception when others then got := sqlstate;
  end;
  perform pg_temp.rec('submissions UPDATE is blocked (SQLSTATE 23001)', got = '23001', 'got ' || got);

  begin
    update public.submission_items set tier = 'S';
    got := 'no-error';
  exception when others then got := sqlstate;
  end;
  perform pg_temp.rec('submission_items UPDATE is blocked (SQLSTATE 23001)', got = '23001', 'got ' || got);
end;
$$;
select pg_temp.expect_err('authed user has no DELETE on submissions', 'authenticated', 'bbbbbbbb-0000-0000-0000-000000000002',
  'delete from public.submissions where user_id = ''bbbbbbbb-0000-0000-0000-000000000002''', '42501');

-- M8 changes this: pre-M8, tierlists had an UPDATE-only immutability
-- posture and DELETE cascaded freely once submissions existed. M8's
-- historical-lock trigger (section 12) now blocks DELETE too, so a
-- submitted tierlist's data can never be cascade-deleted. teardown-game
-- predates live-game, so its fixture submission goes through
-- fixture_submit() rather than the real RPC (see that helper's comment /
-- section 11) -- this block is about deletion, not submission eligibility.
do $$
declare got text;
begin
  perform pg_temp.fixture_submit('33333333-3333-3333-3333-333333333333', null,
    '0f000000-0000-0000-0000-000000000003',
    '[{"item_id":"30000000-0000-0000-0000-0000000000a3","tier":"S","position":0}]'::jsonb);

  begin
    delete from public.tierlists where id = '33333333-3333-3333-3333-333333333333';
    got := 'ok';
  exception when others then got := sqlstate;
  end;
  perform pg_temp.rec('M8: tierlist DELETE is now blocked once it has official submissions (23001)',
    got = '23001', 'got ' || got);
  perform pg_temp.rec('M8: the blocked deletion left the submission intact (no cascade into real data)',
    (select count(*) = 1 from public.submissions where tierlist_id = '33333333-3333-3333-3333-333333333333'));
end;
$$;

-- =====================================================================
-- 6. get_results: spoiler gate
-- =====================================================================
do $$
declare r jsonb;
begin
  r := pg_temp.eval_as('anon', null,
    'select public.get_results(''11111111-1111-1111-1111-111111111111'', ''0f000000-0000-0000-0000-000000000001'')');
  perform pg_temp.rec('get_results: submitted guest gets data (total=2, 3 items, own ranking)',
    (r ->> 'total_submissions') = '2'
    and jsonb_array_length(r -> 'items') = 3
    and jsonb_array_length(r -> 'my_ranking') = 3, coalesce(r::text, 'null'));

  r := pg_temp.eval_as('authenticated', 'bbbbbbbb-0000-0000-0000-000000000002',
    'select public.get_results(''11111111-1111-1111-1111-111111111111'', null)');
  perform pg_temp.rec('get_results: submitted user gets data',
    (r ->> 'total_submissions') = '2' and jsonb_array_length(r -> 'my_ranking') = 3, coalesce(r::text,'null'));
end;
$$;
select pg_temp.expect_err('get_results: non-submitting guest refused', 'anon', null,
  'select public.get_results(''11111111-1111-1111-1111-111111111111'', ''0f000000-0000-0000-0000-000000000099'')', '42501');
select pg_temp.expect_err('get_results: guest with null id refused', 'anon', null,
  'select public.get_results(''11111111-1111-1111-1111-111111111111'', null)', '42501');
select pg_temp.expect_err('get_results: authed non-submitter (carol) refused', 'authenticated', 'cccccccc-0000-0000-0000-000000000003',
  'select public.get_results(''11111111-1111-1111-1111-111111111111'', null)', '42501');

do $$
begin
  -- RLS on the stats table itself
  perform pg_temp.rec('stats RLS: carol (no submission) sees 0 stat rows',
    (pg_temp.eval_as('authenticated', 'cccccccc-0000-0000-0000-000000000003',
      'select to_jsonb(count(*)) from public.tierlist_item_stats where tierlist_id = ''11111111-1111-1111-1111-111111111111''')) = '0'::jsonb);
  perform pg_temp.rec('stats RLS: bob (submitted) sees 3 stat rows',
    (pg_temp.eval_as('authenticated', 'bbbbbbbb-0000-0000-0000-000000000002',
      'select to_jsonb(count(*)) from public.tierlist_item_stats where tierlist_id = ''11111111-1111-1111-1111-111111111111''')) = '3'::jsonb);
  perform pg_temp.rec('submissions RLS: carol sees only her own (0)',
    (pg_temp.eval_as('authenticated', 'cccccccc-0000-0000-0000-000000000003',
      'select to_jsonb(count(*)) from public.submissions')) = '0'::jsonb);
  perform pg_temp.rec('submissions RLS: bob sees only his own (1)',
    (pg_temp.eval_as('authenticated', 'bbbbbbbb-0000-0000-0000-000000000002',
      'select to_jsonb(count(*)) from public.submissions')) = '1'::jsonb);
  perform pg_temp.rec('submission_items RLS: bob sees only his own (3)',
    (pg_temp.eval_as('authenticated', 'bbbbbbbb-0000-0000-0000-000000000002',
      'select to_jsonb(count(*)) from public.submission_items')) = '3'::jsonb);
end;
$$;

-- =====================================================================
-- 7. sharing authorization
-- =====================================================================
do $$
declare tok1 jsonb; tok2 jsonb; gtok jsonb; sub_bob uuid; sub_guest uuid; r jsonb;
begin
  select id into sub_bob from public.submissions
    where user_id = 'bbbbbbbb-0000-0000-0000-000000000002'
      and tierlist_id = '11111111-1111-1111-1111-111111111111';
  select id into sub_guest from public.submissions
    where guest_id = '0f000000-0000-0000-0000-000000000001';

  tok1 := pg_temp.eval_as('authenticated', 'bbbbbbbb-0000-0000-0000-000000000002',
    format('select to_jsonb(public.create_share(%L))', sub_bob));
  perform pg_temp.rec('create_share: owner gets a 32-hex token',
    (tok1 #>> '{}') ~ '^[0-9a-f]{32}$', tok1::text);

  tok2 := pg_temp.eval_as('authenticated', 'bbbbbbbb-0000-0000-0000-000000000002',
    format('select to_jsonb(public.create_share(%L))', sub_bob));
  perform pg_temp.rec('create_share: idempotent (same token)', tok1 = tok2);

  perform pg_temp.rec('create_share: non-owner refused',
    (pg_temp.eval_as('authenticated', 'cccccccc-0000-0000-0000-000000000003',
      format('select to_jsonb(public.create_share(%L))', sub_bob)) ->> '__error__') = '42501');

  perform pg_temp.rec('create_share: wrong guest id refused',
    (pg_temp.eval_as('anon', null,
      format('select to_jsonb(public.create_share(%L, %L))', sub_guest, 'ffffffff-0000-0000-0000-00000000ffff'::uuid)) ->> '__error__') = '42501');

  gtok := pg_temp.eval_as('anon', null,
    format('select to_jsonb(public.create_share(%L, %L))', sub_guest, '0f000000-0000-0000-0000-000000000001'::uuid));
  perform pg_temp.rec('create_share: guest owner gets a token',
    (gtok #>> '{}') ~ '^[0-9a-f]{32}$', gtok::text);

  -- get_share: anonymous visitor -> teaser only
  r := pg_temp.eval_as('anon', null, format('select public.get_share(%L)', tok1 #>> '{}'));
  perform pg_temp.rec('get_share: anon gets found=true, sender info, but locked and no ranking',
    (r ->> 'found') = 'true'
    and (r #>> '{sender,username}') is not null
    and (r #>> '{tierlist,title}') = 'Live Game'
    and (r ->> 'locked') = 'true'
    and (r -> 'ranking') = 'null'::jsonb, r::text);

  -- get_share: sender sees the ranking
  r := pg_temp.eval_as('authenticated', 'bbbbbbbb-0000-0000-0000-000000000002',
    format('select public.get_share(%L)', tok1 #>> '{}'));
  perform pg_temp.rec('get_share: sender sees ranking (3 rows, unlocked)',
    (r ->> 'locked') = 'false' and jsonb_array_length(r -> 'ranking') = 3, r::text);

  -- get_share: eligible via own submission (guest 1 viewing bob's share)
  r := pg_temp.eval_as('anon', null,
    format('select public.get_share(%L, %L)', tok1 #>> '{}', '0f000000-0000-0000-0000-000000000001'::uuid));
  perform pg_temp.rec('get_share: viewer who submitted this game sees ranking',
    (r ->> 'locked') = 'false' and jsonb_array_length(r -> 'ranking') = 3, r::text);

  -- get_share: authed viewer without a submission stays locked
  r := pg_temp.eval_as('authenticated', 'cccccccc-0000-0000-0000-000000000003',
    format('select public.get_share(%L)', tok1 #>> '{}'));
  perform pg_temp.rec('get_share: non-eligible authed viewer stays locked',
    (r ->> 'locked') = 'true' and (r -> 'ranking') = 'null'::jsonb, r::text);

  -- revoked share
  update public.shares set revoked = true where token = (tok1 #>> '{}');
  r := pg_temp.eval_as('anon', null, format('select public.get_share(%L)', tok1 #>> '{}'));
  perform pg_temp.rec('get_share: revoked -> found=false', (r ->> 'found') = 'false', r::text);
end;
$$;

-- =====================================================================
-- 8. guest -> account claiming (Milestone 6)
-- =====================================================================
insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
values
  ('dddddddd-0000-0000-0000-000000000004', 'authenticated', 'authenticated', 'dave@rankle.test',  now(), now(), now()),
  ('eeeeeeee-0000-0000-0000-000000000005', 'authenticated', 'authenticated', 'erin@rankle.test',  now(), now(), now());

update public.profiles set username = 'dave' where id = 'dddddddd-0000-0000-0000-000000000004';
update public.profiles set username = 'erin' where id = 'eeeeeeee-0000-0000-0000-000000000005';

do $$
declare
  g_dave       uuid := '0f000000-0000-0000-0000-0000000000d1'; -- dave's one guest identity, plays two games
  g_erin_conf  uuid := '0f000000-0000-0000-0000-0000000000e1'; -- a guest who also plays erin's already-submitted game
  dave         uuid := 'dddddddd-0000-0000-0000-000000000004';
  erin         uuid := 'eeeeeeee-0000-0000-0000-000000000005';
  live_game    uuid := '11111111-1111-1111-1111-111111111111';
  na_game      uuid := '44444444-4444-4444-4444-444444444444';
  sub_dave_live uuid;
  sub_dave_na   uuid;
  sub_erin_na   uuid;
  sub_guest_na  uuid;
  claimed_count integer;
  stats_before  jsonb;
  stats_after   jsonb;
  tok           jsonb;
  r             jsonb;
begin
  -- ---- SECURITY: this is not a public RPC at all ----------------------
  -- Regardless of which guest_id is supplied (even a real one), neither
  -- client role can reach this function through PostgREST -- the grant
  -- itself is absent, so this fails before the function body ever runs.
  perform pg_temp.rec('claim_guest_submissions: anon cannot call it at all',
    pg_temp.run_as('anon', null,
      format('select public.claim_guest_submissions(%L, %L)', dave, g_dave)) = '42501');
  perform pg_temp.rec('claim_guest_submissions: authenticated cannot call it at all (not even for a real guest id)',
    pg_temp.run_as('authenticated', erin,
      format('select public.claim_guest_submissions(%L, %L)', erin, g_dave)) = '42501');

  -- ---- A + B + C setup: dave plays as a guest, today's game AND an
  --      older one, then "signs in" ------------------------------------
  perform pg_temp.rec('setup: dave-as-guest submits live-game (today)',
    pg_temp.run_as('anon', null, format(
      'select public.submit_ranking(%L, %L::jsonb, %L)', live_game,
      '[{"item_id":"10000000-0000-0000-0000-0000000000a1","tier":"S","position":0},'
      || '{"item_id":"10000000-0000-0000-0000-0000000000b1","tier":"A","position":0},'
      || '{"item_id":"10000000-0000-0000-0000-0000000000c1","tier":"F","position":0}]',
      g_dave)) is null);

  -- na-game predates live-game, so it is no longer the CURRENT game under
  -- M8's tightened submit_ranking -- this is fixture setup for the claim
  -- mechanics below, not a test of submission eligibility, so it uses
  -- fixture_submit() (see that helper's comment / section 11).
  perform pg_temp.rec('setup: dave-as-guest submits na-game (historical)',
    pg_temp.fixture_submit(na_game, null, g_dave,
      ('[{"item_id":"40000000-0000-0000-0000-0000000000a4","tier":"S","position":0},'
      || '{"item_id":"40000000-0000-0000-0000-0000000000b4","tier":"N/A","position":0}]')::jsonb
    ) is not null);

  select id into sub_dave_live from public.submissions
    where tierlist_id = live_game and guest_id = g_dave;
  select id into sub_dave_na from public.submissions
    where tierlist_id = na_game and guest_id = g_dave;

  -- guest-created share, BEFORE dave ever signs in (requirement G)
  tok := to_jsonb(public.create_share(sub_dave_live, g_dave));

  -- snapshot na-game's aggregate before claiming, to prove claiming never
  -- touches it
  select jsonb_agg(to_jsonb(s) order by s.tierlist_item_id) into stats_before
  from public.tierlist_item_stats s where s.tierlist_id = na_game;

  perform pg_temp.rec('pre-claim: dave (authed, no claim yet) is NOT recognized as having submitted live-game',
    pg_temp.eval_as('authenticated', dave,
      format('select to_jsonb(public.has_submitted_ranking(%L, null))', live_game)) = 'false'::jsonb);

  -- ---- the claim itself (simulates the service-role-only call site) ---
  claimed_count := public.claim_guest_submissions(dave, g_dave);
  perform pg_temp.rec('claim: claims both of dave''s eligible guest submissions',
    claimed_count = 2, 'claimed=' || claimed_count::text);

  -- ---- B: today's game immediately behaves as already-submitted -------
  perform pg_temp.rec('B: has_submitted_ranking(live_game) is now true for dave, authenticated, no guest cookie needed',
    pg_temp.eval_as('authenticated', dave,
      format('select to_jsonb(public.has_submitted_ranking(%L, null))', live_game)) = 'true'::jsonb);

  r := pg_temp.eval_as('authenticated', dave, format('select public.get_results(%L)', live_game));
  perform pg_temp.rec('B: get_results works for dave on the claimed live-game submission',
    (r ->> 'submission_id') = sub_dave_live::text
    and jsonb_array_length(r -> 'my_ranking') = 3,
    r::text);

  perform pg_temp.rec('B: dave cannot submit live-game again as himself (claimed submission blocks it)',
    pg_temp.run_as('authenticated', dave, format(
      'select public.submit_ranking(%L, %L::jsonb, null)', live_game,
      '[{"item_id":"10000000-0000-0000-0000-0000000000a1","tier":"F","position":0},'
      || '{"item_id":"10000000-0000-0000-0000-0000000000b1","tier":"F","position":1},'
      || '{"item_id":"10000000-0000-0000-0000-0000000000c1","tier":"F","position":2}]')) = '23505');

  -- ---- G: the guest-created share still works, and dave can reuse it --
  perform pg_temp.rec('G: dave can re-fetch the guest-created share token for his now-claimed submission',
    pg_temp.eval_as('authenticated', dave,
      format('select to_jsonb(public.create_share(%L))', sub_dave_live)) = tok);

  r := pg_temp.eval_as('anon', null, format('select public.get_share(%L)', tok #>> '{}'));
  perform pg_temp.rec('G: a fresh anonymous viewer of the claimed share still only gets the locked teaser',
    (r ->> 'locked') = 'true' and (r -> 'ranking') = 'null'::jsonb, r::text);

  -- ---- C: the historical (non-today) submission is claimed too --------
  perform pg_temp.rec('C: get_results works for dave on the claimed historical na-game submission',
    (pg_temp.eval_as('authenticated', dave, format('select public.get_results(%L)', na_game))
      ->> 'submission_id') = sub_dave_na::text);

  -- ---- history reader: dave can SELECT the claimed submission ROW ITSELF
  --      directly (not just via get_results) -- /profile and /history/[id]
  --      read submissions/submission_items directly, no RPC -----------
  perform pg_temp.rec('history: dave can SELECT his claimed submission row directly (submissions RLS)',
    pg_temp.eval_as('authenticated', dave,
      format('select to_jsonb((select count(*) from public.submissions where id = %L))', sub_dave_live))
      = '1'::jsonb);
  perform pg_temp.rec('history: dave can SELECT his claimed submission''s items directly (submission_items RLS)',
    pg_temp.eval_as('authenticated', dave,
      format('select to_jsonb((select count(*) from public.submission_items where submission_id = %L))', sub_dave_live))
      = '3'::jsonb);
  perform pg_temp.rec('history: carol CANNOT SELECT dave''s claimed submission row',
    pg_temp.eval_as('authenticated', 'cccccccc-0000-0000-0000-000000000003',
      format('select to_jsonb((select count(*) from public.submissions where id = %L))', sub_dave_live))
      = '0'::jsonb);
  perform pg_temp.rec('history: carol CANNOT SELECT dave''s claimed submission''s items',
    pg_temp.eval_as('authenticated', 'cccccccc-0000-0000-0000-000000000003',
      format('select to_jsonb((select count(*) from public.submission_items where submission_id = %L))', sub_dave_live))
      = '0'::jsonb);

  -- ---- history reader: authenticated SELECT via RLS sees both rows ----
  perform pg_temp.rec('history: dave can read both his claimed rows via RLS-gated SELECT',
    pg_temp.eval_as('authenticated', dave,
      'select to_jsonb((select count(*) from public.claimed_guest_submissions))') = '2'::jsonb,
    pg_temp.eval_as('authenticated', dave,
      'select to_jsonb((select count(*) from public.claimed_guest_submissions))')::text);
  perform pg_temp.rec('history: carol cannot see dave''s claimed rows',
    pg_temp.eval_as('authenticated', 'cccccccc-0000-0000-0000-000000000003',
      'select to_jsonb((select count(*) from public.claimed_guest_submissions))') = '0'::jsonb,
    pg_temp.eval_as('authenticated', 'cccccccc-0000-0000-0000-000000000003',
      'select to_jsonb((select count(*) from public.claimed_guest_submissions))')::text);

  -- ---- aggregates: claiming never touched na-game's stats --------------
  select jsonb_agg(to_jsonb(s) order by s.tierlist_item_id) into stats_after
  from public.tierlist_item_stats s where s.tierlist_id = na_game;
  perform pg_temp.rec('aggregate: claiming did not change na-game''s tierlist_item_stats at all',
    stats_before = stats_after, stats_before::text || ' vs ' || stats_after::text);

  -- ---- E: idempotent repeat claim (e.g. a second sign-in) --------------
  claimed_count := public.claim_guest_submissions(dave, g_dave);
  perform pg_temp.rec('E: repeating the claim call claims nothing new',
    claimed_count = 0);
  perform pg_temp.rec('E: repeating the claim call created no duplicate rows',
    (select count(*) from public.claimed_guest_submissions where user_id = dave) = 2);

  -- ---- D: conflict -- erin already has a DIRECT submission for na-game,
  --        a different guest also submitted na-game; claiming that guest
  --        must NOT touch erin's game -------------------------------------
  perform pg_temp.rec('setup: erin submits na-game directly (authenticated)',
    pg_temp.fixture_submit(na_game, erin, null,
      ('[{"item_id":"40000000-0000-0000-0000-0000000000a4","tier":"A","position":0},'
      || '{"item_id":"40000000-0000-0000-0000-0000000000b4","tier":"N/A","position":0}]')::jsonb
    ) is not null);

  perform pg_temp.rec('setup: a different guest also submits na-game',
    pg_temp.fixture_submit(na_game, null, g_erin_conf,
      ('[{"item_id":"40000000-0000-0000-0000-0000000000a4","tier":"F","position":0},'
      || '{"item_id":"40000000-0000-0000-0000-0000000000b4","tier":"S","position":0}]')::jsonb
    ) is not null);

  select id into sub_erin_na from public.submissions where tierlist_id = na_game and user_id = erin;
  select id into sub_guest_na from public.submissions where tierlist_id = na_game and guest_id = g_erin_conf;

  claimed_count := public.claim_guest_submissions(erin, g_erin_conf);
  perform pg_temp.rec('D: the conflicting guest submission is NOT claimed (direct submission wins)',
    claimed_count = 0);
  perform pg_temp.rec('D: no claimed_guest_submissions row exists for the conflicting guest submission',
    not exists (select 1 from public.claimed_guest_submissions where submission_id = sub_guest_na));
  perform pg_temp.rec('D: erin''s get_results still shows HER OWN direct ranking, not the guest''s',
    (pg_temp.eval_as('authenticated', erin, format('select public.get_results(%L)', na_game))
      ->> 'submission_id') = sub_erin_na::text);
  perform pg_temp.rec('D: the unclaimed guest submission remains guest-owned (still fetchable as that guest)',
    pg_temp.eval_as('anon', null, format(
      'select to_jsonb(public.has_submitted_ranking(%L, %L))',
      na_game, g_erin_conf)) = 'true'::jsonb);

  -- ---- F: an authenticated attacker cannot claim a guest they don't own,
  --        because the RPC is not reachable by their role at all, for ANY
  --        guest id -- already proven above, but repeat with a REAL
  --        (someone else's) guest id for clarity ------------------------
  perform pg_temp.rec('F: erin cannot use the authenticated role to claim dave''s real guest id',
    pg_temp.run_as('authenticated', erin,
      format('select public.claim_guest_submissions(%L, %L)', erin, g_dave)) = '42501');
  perform pg_temp.rec('F: dave''s claimed rows are unaffected by erin''s attempt',
    (select count(*) from public.claimed_guest_submissions where user_id = dave) = 2);
end;
$$;

-- =====================================================================
-- 9. friends (Milestone 7)
-- =====================================================================
do $$
declare
  bob        uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  carol      uuid := 'cccccccc-0000-0000-0000-000000000003';
  dave       uuid := 'dddddddd-0000-0000-0000-000000000004';
  erin       uuid := 'eeeeeeee-0000-0000-0000-000000000005';
  live_game  uuid := '11111111-1111-1111-1111-111111111111';
  na_game    uuid := '44444444-4444-4444-4444-444444444444';
  r          jsonb;
  req_id     uuid;
  bob_dave_req uuid;
  i          int;
  uid        uuid;
begin
  -- ---- self-request blocked ------------------------------------------
  perform pg_temp.rec('send_friend_request: cannot request yourself',
    pg_temp.run_as('authenticated', bob, format('select public.send_friend_request(%L)', bob)) = '23514');

  perform pg_temp.rec('send_friend_request: sign-in required (anon)',
    pg_temp.run_as('anon', null, format('select public.send_friend_request(%L)', bob)) = '42501');

  -- ---- duplicate pending request is idempotent, not an error ----------
  r := pg_temp.eval_as('authenticated', bob, format('select public.send_friend_request(%L)', carol));
  perform pg_temp.rec('send_friend_request: bob -> carol creates a pending request', (r ->> 'status') = 'pending', r::text);

  r := pg_temp.eval_as('authenticated', bob, format('select public.send_friend_request(%L)', carol));
  perform pg_temp.rec('send_friend_request: duplicate bob -> carol is idempotent, no error', (r ->> 'status') = 'already_pending', r::text);

  perform pg_temp.rec('friend_requests: exactly one bob->carol row exists despite the duplicate call',
    (select count(*) from public.friend_requests where sender_id = bob and recipient_id = carol) = 1);

  -- ---- unrelated / wrong-side actions on the pending request -----------
  select id into req_id from public.friend_requests where sender_id = bob and recipient_id = carol;

  perform pg_temp.rec('accept_friend_request: sender (bob) cannot accept their own outgoing request',
    pg_temp.run_as('authenticated', bob, format('select public.accept_friend_request(%L)', req_id)) = '42501');
  perform pg_temp.rec('accept_friend_request: an unrelated user (dave) cannot accept it',
    pg_temp.run_as('authenticated', dave, format('select public.accept_friend_request(%L)', req_id)) = '42501');
  perform pg_temp.rec('decline_friend_request: an unrelated user (dave) cannot decline it',
    pg_temp.run_as('authenticated', dave, format('select public.decline_friend_request(%L)', req_id)) = '42501');
  perform pg_temp.rec('cancel_friend_request: the recipient (carol) cannot cancel it (only the sender can)',
    pg_temp.run_as('authenticated', carol, format('select public.cancel_friend_request(%L)', req_id)) = '42501');
  perform pg_temp.rec('cancel_friend_request: an unrelated user (dave) cannot cancel it',
    pg_temp.run_as('authenticated', dave, format('select public.cancel_friend_request(%L)', req_id)) = '42501');

  -- ---- recipient accepts: creates exactly one friendship, deletes the row
  perform pg_temp.rec('accept_friend_request: recipient (carol) CAN accept',
    pg_temp.eval_as('authenticated', carol, format('select to_jsonb(public.accept_friend_request(%L))', req_id)) = 'true'::jsonb);
  perform pg_temp.rec('accept: the friend_requests row is gone (no retained history)',
    not exists (select 1 from public.friend_requests where id = req_id));
  perform pg_temp.rec('accept: exactly one friendships row now exists for bob/carol',
    (select count(*) from public.friendships where user_id_low = least(bob, carol) and user_id_high = greatest(bob, carol)) = 1);
  perform pg_temp.rec('accept_friend_request: repeating on the same (now-gone) request id is a safe no-op',
    pg_temp.eval_as('authenticated', carol, format('select to_jsonb(public.accept_friend_request(%L))', req_id)) = 'false'::jsonb);
  perform pg_temp.rec('accept: the no-op repeat did not remove the existing friendship',
    (select count(*) from public.friendships where user_id_low = least(bob, carol) and user_id_high = greatest(bob, carol)) = 1);

  -- ---- existing friendship: a new request just reports "friends" -------
  r := pg_temp.eval_as('authenticated', bob, format('select public.send_friend_request(%L)', carol));
  perform pg_temp.rec('send_friend_request: already-friends short-circuits to status=friends, no new pending row',
    (r ->> 'status') = 'friends', r::text);
  perform pg_temp.rec('send_friend_request: still exactly one friendships row (no duplicate)',
    (select count(*) from public.friendships where user_id_low = least(bob, carol) and user_id_high = greatest(bob, carol)) = 1);
  perform pg_temp.rec('send_friend_request: no stray pending row was created by the already-friends call',
    not exists (select 1 from public.friend_requests where (sender_id, recipient_id) in ((bob, carol), (carol, bob))));

  -- ---- friendships: symmetric visibility, no enumeration by outsiders --
  perform pg_temp.rec('friendships: carol (the other participant) can also see the row',
    pg_temp.eval_as('authenticated', carol,
      format('select to_jsonb((select count(*) from public.friendships where user_id_low = %L and user_id_high = %L))',
        least(bob, carol), greatest(bob, carol))) = '1'::jsonb);
  perform pg_temp.rec('friendships: an unrelated user (dave) cannot see the bob/carol row at all',
    pg_temp.eval_as('authenticated', dave,
      format('select to_jsonb((select count(*) from public.friendships where user_id_low = %L and user_id_high = %L))',
        least(bob, carol), greatest(bob, carol))) = '0'::jsonb);
  perform pg_temp.rec('profiles (M7): now that bob/carol are friends, carol can directly read bob''s profile row',
    pg_temp.eval_as('authenticated', carol,
      format('select to_jsonb((select count(*) from public.profiles where id = %L))', bob)) = '1'::jsonb);

  -- ---- either side can remove; removal is symmetric and immediate ------
  perform pg_temp.rec('remove_friend: carol can remove the friendship',
    pg_temp.eval_as('authenticated', carol, format('select to_jsonb(public.remove_friend(%L))', bob)) = 'true'::jsonb);
  perform pg_temp.rec('remove_friend: the friendships row is actually gone',
    not exists (select 1 from public.friendships where user_id_low = least(bob, carol) and user_id_high = greatest(bob, carol)));
  perform pg_temp.rec('remove_friend: repeating removal is a safe idempotent no-op',
    pg_temp.eval_as('authenticated', bob, format('select to_jsonb(public.remove_friend(%L))', carol)) = 'false'::jsonb);
  perform pg_temp.rec('profiles (M7): after unfriending, carol can no longer read bob''s profile row directly',
    pg_temp.eval_as('authenticated', carol,
      format('select to_jsonb((select count(*) from public.profiles where id = %L))', bob)) = '0'::jsonb);

  -- ---- sender can cancel an unresolved outgoing request -----------------
  perform pg_temp.rec('setup: fresh bob -> carol request for the cancel test',
    pg_temp.run_as('authenticated', bob, format('select public.send_friend_request(%L)', carol)) is null);
  select id into req_id from public.friend_requests where sender_id = bob and recipient_id = carol;
  perform pg_temp.rec('cancel_friend_request: sender (bob) can cancel their own pending request',
    pg_temp.eval_as('authenticated', bob, format('select to_jsonb(public.cancel_friend_request(%L))', req_id)) = 'true'::jsonb);
  perform pg_temp.rec('cancel: the request row is gone',
    not exists (select 1 from public.friend_requests where id = req_id));
  perform pg_temp.rec('cancel: no friendship was created by canceling',
    not exists (select 1 from public.friendships where user_id_low = least(bob, carol) and user_id_high = greatest(bob, carol)));

  -- ---- cancel after accept cannot delete an existing friendship ---------
  perform pg_temp.rec('setup: fresh bob -> carol request, this time accepted',
    pg_temp.run_as('authenticated', bob, format('select public.send_friend_request(%L)', carol)) is null);
  select id into req_id from public.friend_requests where sender_id = bob and recipient_id = carol;
  perform pg_temp.rec('setup: carol accepts it',
    pg_temp.eval_as('authenticated', carol, format('select to_jsonb(public.accept_friend_request(%L))', req_id)) = 'true'::jsonb);
  perform pg_temp.rec('cancel_friend_request: calling cancel on the now-accepted (gone) request id is a safe no-op',
    pg_temp.eval_as('authenticated', bob, format('select to_jsonb(public.cancel_friend_request(%L))', req_id)) = 'false'::jsonb);
  perform pg_temp.rec('cancel-after-accept: the friendship this created is untouched',
    (select count(*) from public.friendships where user_id_low = least(bob, carol) and user_id_high = greatest(bob, carol)) = 1);

  -- reset: remove the bob/carol friendship so later sections (search_profiles
  -- relationship labels, list_friend_requests, played-status/results) can
  -- exercise a fresh "not yet friends" pending request between them again.
  perform pg_temp.rec('reset: remove bob/carol friendship before reusing this pair for later sections',
    pg_temp.eval_as('authenticated', carol, format('select to_jsonb(public.remove_friend(%L))', bob)) = 'true'::jsonb);

  -- ---- decline: no friendship is created --------------------------------
  perform pg_temp.rec('setup: dave -> erin request for the decline test',
    pg_temp.run_as('authenticated', dave, format('select public.send_friend_request(%L)', erin)) is null);
  select id into req_id from public.friend_requests where sender_id = dave and recipient_id = erin;
  perform pg_temp.rec('decline_friend_request: recipient (erin) CAN decline',
    pg_temp.eval_as('authenticated', erin, format('select to_jsonb(public.decline_friend_request(%L))', req_id)) = 'true'::jsonb);
  perform pg_temp.rec('decline: the request row is gone (no retained history)',
    not exists (select 1 from public.friend_requests where id = req_id));
  perform pg_temp.rec('decline: no friendship was created',
    not exists (select 1 from public.friendships where user_id_low = least(dave, erin) and user_id_high = greatest(dave, erin)));

  -- ---- mutual/reverse pending request resolves deterministically into
  --      exactly ONE friendship, not two pending rows in each direction ---
  perform pg_temp.rec('setup: dave -> erin request (fresh, after the decline above)',
    pg_temp.run_as('authenticated', dave, format('select public.send_friend_request(%L)', erin)) is null);
  r := pg_temp.eval_as('authenticated', erin, format('select public.send_friend_request(%L)', dave));
  perform pg_temp.rec('send_friend_request: erin -> dave while dave -> erin is pending resolves to ONE friendship',
    (r ->> 'status') = 'friends', r::text);
  perform pg_temp.rec('mutual race: exactly one friendships row for dave/erin',
    (select count(*) from public.friendships where user_id_low = least(dave, erin) and user_id_high = greatest(dave, erin)) = 1);
  perform pg_temp.rec('mutual race: no pending friend_requests rows remain in EITHER direction',
    not exists (select 1 from public.friend_requests where (sender_id, recipient_id) in ((dave, erin), (erin, dave))));

  -- =====================================================================
  -- search_profiles
  -- =====================================================================
  perform pg_temp.rec('search_profiles: anonymous cannot call it at all',
    pg_temp.run_as('anon', null, 'select public.search_profiles(''car'')') = '42501');

  r := pg_temp.eval_as('authenticated', bob, 'select public.search_profiles(''car'')');
  perform pg_temp.rec('search_profiles: prefix match finds carol',
    jsonb_array_length(r -> 'results') = 1 and (r -> 'results' -> 0 ->> 'username') = 'carol', r::text);

  r := pg_temp.eval_as('authenticated', bob, 'select public.search_profiles(''CAR'')');
  perform pg_temp.rec('search_profiles: query is case-normalized',
    jsonb_array_length(r -> 'results') = 1 and (r -> 'results' -> 0 ->> 'username') = 'carol', r::text);

  r := pg_temp.eval_as('authenticated', bob, 'select public.search_profiles(''zzz-does-not-exist'')');
  perform pg_temp.rec('search_profiles: no match -> empty results, not an error',
    (r -> 'results') = '[]'::jsonb, r::text);

  r := pg_temp.eval_as('authenticated', bob, 'select public.search_profiles(''c'')');
  perform pg_temp.rec('search_profiles: below the minimum query length -> empty results',
    (r -> 'results') = '[]'::jsonb, r::text);

  r := pg_temp.eval_as('authenticated', bob, format('select public.search_profiles(%L)', substr(bob::text, 1, 3)));
  perform pg_temp.rec('search_profiles: excludes the caller themselves even on a self-matching prefix',
    not exists (
      select 1 from jsonb_array_elements(r -> 'results') e where (e ->> 'id') = bob::text
    ), r::text);

  r := pg_temp.eval_as('authenticated', bob, 'select public.search_profiles(''carol'')');
  perform pg_temp.rec('search_profiles: returns only safe columns (no is_admin/email/private fields)',
    (r -> 'results' -> 0) ?& array['id','username','display_name','avatar_url','relationship']
    and not ((r -> 'results' -> 0) ? 'is_admin')
    and not ((r -> 'results' -> 0) ? 'email'), r::text);

  -- dave and erin are friends (from the mutual-race resolution above)
  r := pg_temp.eval_as('authenticated', dave, 'select public.search_profiles(''erin'')');
  perform pg_temp.rec('search_profiles: relationship reflects an existing friendship',
    (r -> 'results' -> 0 ->> 'relationship') = 'friends', r::text);

  perform pg_temp.rec('setup: bob -> carol pending request for the relationship-label test',
    pg_temp.run_as('authenticated', bob, format('select public.send_friend_request(%L)', carol)) is null);
  r := pg_temp.eval_as('authenticated', bob, 'select public.search_profiles(''carol'')');
  perform pg_temp.rec('search_profiles: relationship reflects a pending OUTGOING request',
    (r -> 'results' -> 0 ->> 'relationship') = 'pending_outgoing', r::text);
  r := pg_temp.eval_as('authenticated', carol, 'select public.search_profiles(''bob'')');
  perform pg_temp.rec('search_profiles: relationship reflects a pending INCOMING request',
    (r -> 'results' -> 0 ->> 'relationship') = 'pending_incoming', r::text);

  -- ---- result cap: prefix-match more than the cap, get back exactly the cap
  for i in 1..25 loop
    uid := ('f0000000-0000-0000-0000-0000000000' || lpad(i::text, 2, '0'))::uuid;
    insert into auth.users (id, aud, role, email, email_confirmed_at, created_at, updated_at)
    values (uid, 'authenticated', 'authenticated', 'capuser' || i || '@rankle.test', now(), now(), now());
    update public.profiles set username = 'capuser' || lpad(i::text, 2, '0') where id = uid;
  end loop;

  r := pg_temp.eval_as('authenticated', bob, 'select public.search_profiles(''capuser'')');
  perform pg_temp.rec('search_profiles: 25 matches are capped at 20, not an unbounded scan',
    jsonb_array_length(r -> 'results') = 20, 'len=' || jsonb_array_length(r -> 'results')::text);

  -- ---- list_friend_requests: incoming/outgoing, pending-counterpart identity
  select id into bob_dave_req from public.friend_requests where sender_id = bob and recipient_id = carol;

  r := pg_temp.eval_as('authenticated', carol, 'select public.list_friend_requests()');
  perform pg_temp.rec('list_friend_requests: carol sees bob''s request in INCOMING',
    jsonb_array_length(r -> 'incoming') = 1
    and (r -> 'incoming' -> 0 -> 'user' ->> 'username') = 'bob', r::text);
  perform pg_temp.rec('list_friend_requests: carol has nothing OUTGOING',
    (r -> 'outgoing') = '[]'::jsonb, r::text);

  r := pg_temp.eval_as('authenticated', bob, 'select public.list_friend_requests()');
  perform pg_temp.rec('list_friend_requests: bob sees his own request to carol in OUTGOING',
    jsonb_array_length(r -> 'outgoing') = 1
    and (r -> 'outgoing' -> 0 -> 'user' ->> 'username') = 'carol', r::text);

  -- clean up that pending request so it doesn't leak into later assertions
  perform pg_temp.run_as('authenticated', bob, format('select public.cancel_friend_request(%L)', bob_dave_req));

  perform pg_temp.rec('list_friend_requests: sign-in required',
    pg_temp.run_as('anon', null, 'select public.list_friend_requests()') = '42501');

end;
$$;

do $$
declare
  bob        uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  carol      uuid := 'cccccccc-0000-0000-0000-000000000003';
  dave       uuid := 'dddddddd-0000-0000-0000-000000000004';
  erin       uuid := 'eeeeeeee-0000-0000-0000-000000000005';
  live_game  uuid := '11111111-1111-1111-1111-111111111111';
  na_game    uuid := '44444444-4444-4444-4444-444444444444';
  r          jsonb;
  req_id     uuid;
begin
  -- bob & carol: friends again (for played-status + "friend but hasn't
  -- submitted" friend-results coverage below)
  perform pg_temp.rec('setup: bob -> carol request (played-status/results section)',
    pg_temp.run_as('authenticated', bob, format('select public.send_friend_request(%L)', carol)) is null);
  select id into req_id from public.friend_requests where sender_id = bob and recipient_id = carol;
  perform pg_temp.rec('setup: carol accepts',
    pg_temp.eval_as('authenticated', carol, format('select to_jsonb(public.accept_friend_request(%L))', req_id)) = 'true'::jsonb);

  -- bob & dave: friends (dave has a CLAIMED live_game submission, section 8)
  perform pg_temp.rec('setup: bob -> dave request',
    pg_temp.run_as('authenticated', bob, format('select public.send_friend_request(%L)', dave)) is null);
  select id into req_id from public.friend_requests where sender_id = bob and recipient_id = dave;
  perform pg_temp.rec('setup: dave accepts',
    pg_temp.eval_as('authenticated', dave, format('select to_jsonb(public.accept_friend_request(%L))', req_id)) = 'true'::jsonb);

  -- erin submits live_game directly, but is NOT bob's friend -- proves
  -- "both submitted but not friends -> no data" distinctly from mere absence
  perform pg_temp.rec('setup: erin submits live_game directly (not friends with bob)',
    pg_temp.run_as('authenticated', erin, format(
      'select public.submit_ranking(%L, %L::jsonb, null)', live_game,
      '[{"item_id":"10000000-0000-0000-0000-0000000000a1","tier":"A","position":0},'
      || '{"item_id":"10000000-0000-0000-0000-0000000000b1","tier":"B","position":0},'
      || '{"item_id":"10000000-0000-0000-0000-0000000000c1","tier":"C","position":0}]')) is null);

  r := pg_temp.eval_as('authenticated', bob, format('select public.get_friend_played_status(%L)', live_game));
  perform pg_temp.rec('get_friend_played_status: bob''s friend dave (submitted, claimed) shows played=true',
    exists (select 1 from jsonb_array_elements(r -> 'friends') e where (e ->> 'user_id') = dave::text and (e ->> 'played') = 'true'),
    r::text);
  perform pg_temp.rec('get_friend_played_status: bob''s friend carol (not submitted) shows played=false',
    exists (select 1 from jsonb_array_elements(r -> 'friends') e where (e ->> 'user_id') = carol::text and (e ->> 'played') = 'false'),
    r::text);
  perform pg_temp.rec('get_friend_played_status: non-friend erin never appears at all',
    not exists (select 1 from jsonb_array_elements(r -> 'friends') e where (e ->> 'user_id') = erin::text),
    r::text);
  perform pg_temp.rec('get_friend_played_status: boolean-only, no ranking/tier data anywhere in the payload',
    r::text not ilike '%tier%' and r::text not ilike '%position%');
  perform pg_temp.rec('get_friend_played_status: sign-in required',
    pg_temp.run_as('anon', null, format('select public.get_friend_played_status(%L)', live_game)) = '42501');
  -- safe to call BEFORE the caller's own submission (carol hasn't submitted live_game)
  perform pg_temp.rec('get_friend_played_status: callable by carol, who has not submitted live_game herself',
    pg_temp.run_as('authenticated', carol, format('select public.get_friend_played_status(%L)', live_game)) is null);

  -- =====================================================================
  -- get_friend_results -- the spoiler-gated comparison reader
  -- =====================================================================
  perform pg_temp.rec('get_friend_results: caller (carol) who has NOT submitted live_game is refused',
    pg_temp.run_as('authenticated', carol, format('select public.get_friend_results(%L)', live_game)) = '42501');
  perform pg_temp.rec('get_friend_results: sign-in required',
    pg_temp.run_as('anon', null, format('select public.get_friend_results(%L)', live_game)) = '42501');

  r := pg_temp.eval_as('authenticated', bob, format('select public.get_friend_results(%L)', live_game));
  perform pg_temp.rec('get_friend_results: bob (submitted) sees dave''s (claimed submission) ranking',
    exists (
      select 1 from jsonb_array_elements(r -> 'friends') e
      where (e -> 'user' ->> 'id') = dave::text and jsonb_array_length(e -> 'ranking') = 3
    ), r::text);
  perform pg_temp.rec('get_friend_results: friend carol (hasn''t submitted) is OMITTED entirely',
    not exists (select 1 from jsonb_array_elements(r -> 'friends') e where (e -> 'user' ->> 'id') = carol::text),
    r::text);
  perform pg_temp.rec('get_friend_results: erin (submitted, but not a friend) is OMITTED entirely',
    not exists (select 1 from jsonb_array_elements(r -> 'friends') e where (e -> 'user' ->> 'id') = erin::text),
    r::text);

  r := pg_temp.eval_as('authenticated', dave, format('select public.get_friend_results(%L)', live_game));
  perform pg_temp.rec('get_friend_results: dave (claimed submission counts as his own submitting) sees bob''s ranking',
    exists (
      select 1 from jsonb_array_elements(r -> 'friends') e
      where (e -> 'user' ->> 'id') = bob::text and jsonb_array_length(e -> 'ranking') = 3
    ), r::text);

  -- N/A preserved verbatim -- dave & erin are friends (mutual-race section
  -- above) and BOTH have a na_game submission (dave's is claimed, erin's is
  -- direct) that includes an N/A placement.
  r := pg_temp.eval_as('authenticated', dave, format('select public.get_friend_results(%L)', na_game));
  perform pg_temp.rec('get_friend_results: N/A is preserved verbatim in a friend''s ranking, not coerced to a numeric tier',
    exists (
      select 1
      from jsonb_array_elements(r -> 'friends') e,
           jsonb_array_elements(e -> 'ranking') item
      where (e -> 'user' ->> 'id') = erin::text and (item ->> 'tier') = 'N/A'
    ), r::text);

  -- removal takes effect immediately: unfriend bob & dave, dave disappears
  perform pg_temp.rec('setup: bob removes dave as a friend',
    pg_temp.eval_as('authenticated', bob, format('select to_jsonb(public.remove_friend(%L))', dave)) = 'true'::jsonb);
  r := pg_temp.eval_as('authenticated', bob, format('select public.get_friend_results(%L)', live_game));
  perform pg_temp.rec('get_friend_results: after unfriending, the former friend (dave) no longer appears',
    not exists (select 1 from jsonb_array_elements(r -> 'friends') e where (e -> 'user' ->> 'id') = dave::text),
    r::text);
end;
$$;

-- =====================================================================
-- 10. friend RPC privilege catalog check (Milestone 7 correction)
--
-- A STATIC assertion against pg_proc's actual ACL, not a runtime call. A
-- runtime "anon gets 42501" check only proves a function's OWN internal
-- auth.uid() guard works -- it says nothing about whether anon actually holds
-- EXECUTE at the grant level. On this project's remote database, a
-- schema-level default privilege grants EXECUTE on every new `public`
-- function directly to anon/authenticated/service_role at creation time
-- (confirmed via pg_default_acl) -- a clean local stack has no such default,
-- so a runtime-only check can never catch this class of drift locally. This
-- catalog check encodes the intended grant state directly, so it fails
-- immediately (locally) if a future migration ever reintroduces the mistake
-- `20260912210000_harden_friend_rpc_grants.sql` corrected: revoking only from
-- `public` (the pseudo-role) when a named role's default-ACL grant needs an
-- explicit revoke of its own.
-- =====================================================================
do $$
declare
  v_anon_leaks     text;
  v_missing_auth   text;
begin
  select string_agg(routine_name, ', ' order by routine_name)
    into v_anon_leaks
  from information_schema.routine_privileges
  where routine_schema = 'public'
    and grantee = 'anon'
    and routine_name in (
      'search_profiles', 'list_friend_requests', 'send_friend_request',
      'accept_friend_request', 'decline_friend_request', 'cancel_friend_request',
      'remove_friend', 'get_friend_played_status', 'get_friend_results'
    );
  perform pg_temp.rec(
    'privilege catalog: anon has NO EXECUTE on any authenticated-only friend RPC',
    v_anon_leaks is null,
    coalesce('anon can execute: ' || v_anon_leaks, '')
  );

  select string_agg(fn, ', ' order by fn) into v_missing_auth
  from unnest(array[
    'search_profiles', 'list_friend_requests', 'send_friend_request',
    'accept_friend_request', 'decline_friend_request', 'cancel_friend_request',
    'remove_friend', 'get_friend_played_status', 'get_friend_results'
  ]) as fn
  where not exists (
    select 1 from information_schema.routine_privileges
    where routine_schema = 'public' and routine_name = fn and grantee = 'authenticated'
  );
  perform pg_temp.rec(
    'privilege catalog: authenticated HAS EXECUTE on every friend RPC',
    v_missing_auth is null,
    coalesce('missing for: ' || v_missing_auth, '')
  );

  -- private.* helpers remain internal-only: no anon/authenticated grant at all.
  perform pg_temp.rec(
    'privilege catalog: private.has_submitted_by has no anon/authenticated EXECUTE',
    not exists (
      select 1 from information_schema.routine_privileges
      where routine_schema = 'private' and routine_name = 'has_submitted_by'
        and grantee in ('anon', 'authenticated')
    )
  );
  perform pg_temp.rec(
    'privilege catalog: private.lock_friend_pair has no anon/authenticated EXECUTE',
    not exists (
      select 1 from information_schema.routine_privileges
      where routine_schema = 'private' and routine_name = 'lock_friend_pair'
        and grantee in ('anon', 'authenticated')
    )
  );
end;
$$;

-- =====================================================================
-- 11. current_daily_game_id() / get_daily_game() resolver consistency
--     (dynamic day-rollover proof already ran above, right after fixtures
--     were truncated; this section checks resolver consistency against the
--     MAIN fixture set: live-game today, future-game +30d, teardown-game and
--     na-game both dated in the past and both superseded by live-game).
-- =====================================================================
select pg_temp.expect_err('is_admin_user: anon cannot call it at all', 'anon', null,
  'select public.is_admin_user()', '42501');
do $$
begin
  perform pg_temp.rec('is_admin_user: admin (alice) gets true',
    pg_temp.eval_as('authenticated', 'aaaaaaaa-0000-0000-0000-000000000001',
      'select to_jsonb(public.is_admin_user())') = 'true'::jsonb);
  perform pg_temp.rec('is_admin_user: non-admin (bob) gets false',
    pg_temp.eval_as('authenticated', 'bbbbbbbb-0000-0000-0000-000000000002',
      'select to_jsonb(public.is_admin_user())') = 'false'::jsonb);
end;
$$;

do $$
begin
  perform pg_temp.rec('resolver: get_daily_game() returns live-game (the most recent released game)',
    (pg_temp.eval_as('anon', null, 'select public.get_daily_game()') ->> 'slug') = 'live-game');
  perform pg_temp.rec('resolver: admin (alice) resolves the identical current game as anon',
    (pg_temp.eval_as('authenticated', 'aaaaaaaa-0000-0000-0000-000000000001',
      'select public.get_daily_game()') ->> 'slug') = 'live-game');
  perform pg_temp.rec('resolver: non-admin authenticated (bob) also resolves the identical current game',
    (pg_temp.eval_as('authenticated', 'bbbbbbbb-0000-0000-0000-000000000002',
      'select public.get_daily_game()') ->> 'slug') = 'live-game');
  perform pg_temp.rec('resolver: a future scheduled game never becomes current early (get_daily_game != future-game)',
    (pg_temp.eval_as('anon', null, 'select public.get_daily_game()') ->> 'slug') <> 'future-game');
  perform pg_temp.rec(
    'resolver: with no newer game than live-game, live-game remains current despite older na-game/teardown-game existing',
    (pg_temp.eval_as('anon', null, 'select public.get_daily_game()') ->> 'slug') = 'live-game');
end;
$$;

select pg_temp.expect_err('reject: submit to a superseded past game (na-game)', 'anon', null,
  'select public.submit_ranking(''44444444-4444-4444-4444-444444444444'',
     ''[{"item_id":"40000000-0000-0000-0000-0000000000a4","tier":"S","position":0},
        {"item_id":"40000000-0000-0000-0000-0000000000b4","tier":"A","position":0}]''::jsonb,
     ''0f000000-0000-0000-0000-0000000000ee'')', '23001');
select pg_temp.expect_ok('current game (live-game) still accepts a fresh submission', 'anon', null,
  'select public.submit_ranking(''11111111-1111-1111-1111-111111111111'',
     ''[{"item_id":"10000000-0000-0000-0000-0000000000a1","tier":"S","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000b1","tier":"A","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000c1","tier":"B","position":0}]''::jsonb,
     ''0f000000-0000-0000-0000-0000000000ef'')');

-- =====================================================================
-- 12. historical-lock triggers: tierlists / tierlist_items freeze completely
--     once ANY official submission exists. na-game and teardown-game both
--     have submissions by this point (sections 4c / 7 / this file's fixture
--     setup); future-game has zero submissions and serves as the control.
-- =====================================================================
do $$
declare got text;
begin
  -- ---- locked: na-game (has submissions) ------------------------------
  begin
    update public.tierlists set title = 'Hacked NA' where id = '44444444-4444-4444-4444-444444444444';
    got := 'ok';
  exception when others then got := sqlstate;
  end;
  perform pg_temp.rec('locked: UPDATE title on a submitted tierlist is blocked (23001)', got = '23001', 'got ' || got);

  begin
    update public.tierlists set tier_config = '["S","F"]'::jsonb
      where id = '44444444-4444-4444-4444-444444444444';
    got := 'ok';
  exception when others then got := sqlstate;
  end;
  perform pg_temp.rec('locked: UPDATE tier_config on a submitted tierlist is blocked (23001)', got = '23001', 'got ' || got);

  begin
    insert into public.tierlist_items (tierlist_id, label, sort_order)
      values ('44444444-4444-4444-4444-444444444444', 'Sneaky New Item', 99);
    got := 'ok';
  exception when others then got := sqlstate;
  end;
  perform pg_temp.rec('locked: INSERT item into a submitted tierlist is blocked (23001)', got = '23001', 'got ' || got);

  begin
    update public.tierlist_items set label = 'Renamed'
      where id = '40000000-0000-0000-0000-0000000000a4';
    got := 'ok';
  exception when others then got := sqlstate;
  end;
  perform pg_temp.rec('locked: UPDATE (rename) an item on a submitted tierlist is blocked (23001)', got = '23001', 'got ' || got);

  begin
    update public.tierlist_items set sort_order = 5
      where id = '40000000-0000-0000-0000-0000000000a4';
    got := 'ok';
  exception when others then got := sqlstate;
  end;
  perform pg_temp.rec('locked: reorder an item on a submitted tierlist is blocked (23001)', got = '23001', 'got ' || got);

  begin
    delete from public.tierlist_items where id = '40000000-0000-0000-0000-0000000000a4';
    got := 'ok';
  exception when others then got := sqlstate;
  end;
  perform pg_temp.rec('locked: DELETE an item on a submitted tierlist is blocked (23001)', got = '23001', 'got ' || got);

  -- ---- control: future-game (zero submissions) remains fully editable --
  update public.tierlists set title = 'Future Game Renamed'
    where id = '22222222-2222-2222-2222-222222222222';
  perform pg_temp.rec('control: UPDATE title on a zero-submission tierlist succeeds',
    (select title = 'Future Game Renamed' from public.tierlists where id = '22222222-2222-2222-2222-222222222222'));
end;
$$;

-- =====================================================================
-- 13. lifecycle constraints: draft <-> release_date nullability
-- =====================================================================
-- Run as the file owner (bypasses grants entirely) so these isolate the
-- CHECK constraint itself, not the (separately tested, section 15) column
-- grants that would otherwise block release_date/status in an authenticated
-- client's insert column list before the constraint is ever reached.
do $$
declare got text;
begin
  begin
    insert into public.tierlists (slug, title, status, release_date)
      values ('bad-draft', 'Bad Draft', 'draft', private.today() + 1);
    got := 'ok';
  exception when others then got := sqlstate;
  end;
  perform pg_temp.rec('constraint: a draft with a non-null release_date is rejected (23514)',
    got = '23514', 'got ' || got);

  begin
    insert into public.tierlists (slug, title, status) values ('bad-scheduled', 'Bad Scheduled', 'scheduled');
    got := 'ok';
  exception when others then got := sqlstate;
  end;
  perform pg_temp.rec('constraint: a scheduled game with a null release_date is rejected (23514)',
    got = '23514', 'got ' || got);
end;
$$;

-- =====================================================================
-- 14. admin RPCs: schedule / unschedule / duplicate / set_tierlist_items
-- =====================================================================
do $$
declare
  admin_id uuid := 'aaaaaaaa-0000-0000-0000-000000000001';
  bob_id   uuid := 'bbbbbbbb-0000-0000-0000-000000000002';
  draft_id uuid;
  dup_id   uuid;
  r        jsonb;
begin
  insert into public.tierlists (slug, title, status, created_by)
  values ('m8-draft', 'M8 Draft', 'draft', admin_id)
  returning id into draft_id;

  -- ---- authorization -----------------------------------------------
  perform pg_temp.rec('schedule_tierlist: non-admin (bob) cannot call it',
    pg_temp.run_as('authenticated', bob_id,
      format('select public.schedule_tierlist(%L, %L)', draft_id, (private.today() + 5)::text)) = '42501');
  perform pg_temp.rec('schedule_tierlist: anon cannot call it',
    pg_temp.run_as('anon', null,
      format('select public.schedule_tierlist(%L, %L)', draft_id, (private.today() + 5)::text)) = '42501');

  -- ---- validation -----------------------------------------------------
  perform pg_temp.rec('schedule_tierlist: rejects a past date',
    pg_temp.run_as('authenticated', admin_id,
      format('select public.schedule_tierlist(%L, %L)', draft_id, (private.today() - 1)::text)) = '22023');
  perform pg_temp.rec('schedule_tierlist: rejects a date already taken (live-game owns today)',
    pg_temp.run_as('authenticated', admin_id,
      format('select public.schedule_tierlist(%L, %L)', draft_id, private.today()::text)) = '23505');

  -- ---- happy path + reschedule -----------------------------------------
  r := pg_temp.eval_as('authenticated', admin_id,
    format('select to_jsonb(public.schedule_tierlist(%L, %L))', draft_id, (private.today() + 5)::text));
  perform pg_temp.rec('schedule_tierlist: admin schedules a free future date',
    (r ->> 'status') = 'scheduled' and (r ->> 'release_date') = (private.today() + 5)::text, r::text);

  r := pg_temp.eval_as('authenticated', admin_id,
    format('select to_jsonb(public.schedule_tierlist(%L, %L))', draft_id, (private.today() + 6)::text));
  perform pg_temp.rec('schedule_tierlist: reschedule to a different free date works',
    (r ->> 'release_date') = (private.today() + 6)::text, r::text);

  -- ---- unschedule -------------------------------------------------------
  perform pg_temp.rec('unschedule_tierlist: non-admin cannot call it',
    pg_temp.run_as('authenticated', bob_id,
      format('select public.unschedule_tierlist(%L)', draft_id)) = '42501');
  perform pg_temp.rec('unschedule_tierlist: live-game (already current, not future) cannot be unscheduled',
    pg_temp.run_as('authenticated', admin_id,
      'select public.unschedule_tierlist(''11111111-1111-1111-1111-111111111111'')') = 'P0002');

  r := pg_temp.eval_as('authenticated', admin_id, format('select to_jsonb(public.unschedule_tierlist(%L))', draft_id));
  perform pg_temp.rec('unschedule_tierlist: admin unschedules a future draft back to draft/null date',
    (r ->> 'status') = 'draft' and (r ->> 'release_date') is null, r::text);

  perform pg_temp.rec('unschedule_tierlist: calling it again on an already-draft game is rejected',
    pg_temp.run_as('authenticated', admin_id,
      format('select public.unschedule_tierlist(%L)', draft_id)) = 'P0002');

  -- ---- duplicate_tierlist -------------------------------------------------
  perform pg_temp.rec('duplicate_tierlist: non-admin cannot call it',
    pg_temp.run_as('authenticated', bob_id,
      'select public.duplicate_tierlist(''11111111-1111-1111-1111-111111111111'', ''bob-copy'')') = '42501');

  r := pg_temp.eval_as('authenticated', admin_id,
    'select to_jsonb(public.duplicate_tierlist(''11111111-1111-1111-1111-111111111111'', ''live-game-copy''))');
  dup_id := (r ->> 'id')::uuid;
  perform pg_temp.rec('duplicate_tierlist: result is a fresh draft with a new id, no release date',
    dup_id is not null and dup_id <> '11111111-1111-1111-1111-111111111111'
      and (r ->> 'status') = 'draft' and (r ->> 'release_date') is null, r::text);
  perform pg_temp.rec('duplicate_tierlist: items were copied with fresh ids (same count, none overlapping source)',
    (select count(*) from public.tierlist_items where tierlist_id = dup_id) = 3
    and not exists (
      select 1 from public.tierlist_items
      where tierlist_id = dup_id
        and id in (select id from public.tierlist_items where tierlist_id = '11111111-1111-1111-1111-111111111111')
    ));
  perform pg_temp.rec('duplicate_tierlist: no submissions/stats/shares were copied',
    (select count(*) from public.submissions where tierlist_id = dup_id) = 0
    and (select count(*) from public.tierlist_item_stats where tierlist_id = dup_id) = 0
    and (select count(*) from public.shares where tierlist_id = dup_id) = 0);
  perform pg_temp.rec('duplicate_tierlist: a colliding slug is rejected',
    pg_temp.run_as('authenticated', admin_id,
      'select public.duplicate_tierlist(''11111111-1111-1111-1111-111111111111'', ''live-game-copy'')') = '23505');

  -- ---- set_tierlist_items -------------------------------------------------
  perform pg_temp.rec('set_tierlist_items: non-admin cannot call it',
    pg_temp.run_as('authenticated', bob_id,
      format('select public.set_tierlist_items(%L, %L::jsonb)', draft_id,
        '[{"label":"A","sort_order":0}]')) = '42501');

  perform pg_temp.rec('set_tierlist_items: admin sets the initial item set',
    pg_temp.run_as('authenticated', admin_id,
      format('select public.set_tierlist_items(%L, %L::jsonb)', draft_id,
        '[{"label":"Alpha","sort_order":0},{"label":"Beta","image_url":"https://example.com/b.png","sort_order":1}]'))
      is null);
  perform pg_temp.rec('set_tierlist_items: item rows match the payload exactly',
    (select array_agg(label order by sort_order) from public.tierlist_items where tierlist_id = draft_id)
      = array['Alpha','Beta']);

  perform pg_temp.rec('set_tierlist_items: a second call fully replaces the item set (old rows gone)',
    pg_temp.run_as('authenticated', admin_id,
      format('select public.set_tierlist_items(%L, %L::jsonb)', draft_id,
        '[{"label":"Gamma","sort_order":0}]')) is null);
  perform pg_temp.rec('set_tierlist_items: replacement left exactly the new set',
    (select array_agg(label) from public.tierlist_items where tierlist_id = draft_id) = array['Gamma']);

  perform pg_temp.rec('set_tierlist_items: rejects a duplicate sort_order',
    pg_temp.run_as('authenticated', admin_id,
      format('select public.set_tierlist_items(%L, %L::jsonb)', draft_id,
        '[{"label":"X","sort_order":0},{"label":"Y","sort_order":0}]')) = '22023');
  perform pg_temp.rec('set_tierlist_items: rejects a non-https image_url',
    pg_temp.run_as('authenticated', admin_id,
      format('select public.set_tierlist_items(%L, %L::jsonb)', draft_id,
        '[{"label":"X","image_url":"http://insecure.example.com/x.png","sort_order":0}]')) = '22023');

  perform pg_temp.rec('set_tierlist_items: blocked once the tierlist has official submissions (23001)',
    pg_temp.run_as('authenticated', admin_id,
      format('select public.set_tierlist_items(%L, %L::jsonb)', '44444444-4444-4444-4444-444444444444',
        '[{"label":"Nope","sort_order":0}]')) = '23001');

  -- ---- narrowed direct table grants -- tested AS the admin's own
  --      `authenticated` role via run_as/eval_as. This whole do-block
  --      otherwise runs as the file owner (superuser), which bypasses grants
  --      entirely, so these three checks specifically must go through
  --      run_as() rather than a bare statement. --------------------------
  perform pg_temp.rec('grants: admin cannot set status via a direct table UPDATE (column not granted, 42501)',
    pg_temp.run_as('authenticated', admin_id,
      format('update public.tierlists set status = ''live'' where id = %L', draft_id)) = '42501');

  perform pg_temp.run_as('authenticated', admin_id,
    format('update public.tierlists set title = ''M8 Draft Renamed'' where id = %L', draft_id));
  perform pg_temp.rec('grants: admin CAN still update title directly (column retained)',
    (select title = 'M8 Draft Renamed' from public.tierlists where id = draft_id));

  perform pg_temp.rec('grants: direct INSERT into tierlist_items is fully revoked (42501)',
    pg_temp.run_as('authenticated', admin_id,
      format('insert into public.tierlist_items (tierlist_id, label, sort_order) values (%L, ''Direct Insert'', 9)',
        draft_id)) = '42501');
end;
$$;

-- =====================================================================
-- 15. M8 privilege catalog check (same static-ACL rationale as section 10)
-- =====================================================================
do $$
declare v_leak text;
begin
  select string_agg(routine_name, ', ' order by routine_name) into v_leak
  from information_schema.routine_privileges
  where routine_schema = 'public' and grantee = 'anon'
    and routine_name in ('schedule_tierlist', 'unschedule_tierlist', 'duplicate_tierlist', 'set_tierlist_items');
  perform pg_temp.rec('privilege catalog: anon has NO EXECUTE on any M8 admin RPC', v_leak is null,
    coalesce('anon can execute: ' || v_leak, ''));

  select string_agg(fn, ', ' order by fn) into v_leak
  from unnest(array['schedule_tierlist', 'unschedule_tierlist', 'duplicate_tierlist', 'set_tierlist_items']) as fn
  where not exists (
    select 1 from information_schema.routine_privileges
    where routine_schema = 'public' and routine_name = fn and grantee = 'authenticated'
  );
  perform pg_temp.rec('privilege catalog: authenticated HAS EXECUTE on every M8 admin RPC', v_leak is null,
    coalesce('missing for: ' || v_leak, ''));

  perform pg_temp.rec('privilege catalog: anon has NO EXECUTE on is_admin_user',
    not exists (select 1 from information_schema.routine_privileges
      where routine_schema = 'public' and routine_name = 'is_admin_user' and grantee = 'anon'));
  perform pg_temp.rec('privilege catalog: authenticated HAS EXECUTE on is_admin_user',
    exists (select 1 from information_schema.routine_privileges
      where routine_schema = 'public' and routine_name = 'is_admin_user' and grantee = 'authenticated'));

  perform pg_temp.rec('privilege catalog: anon HAS EXECUTE on get_daily_game (player-facing)',
    exists (select 1 from information_schema.routine_privileges
      where routine_schema = 'public' and routine_name = 'get_daily_game' and grantee = 'anon'));
  perform pg_temp.rec('privilege catalog: authenticated HAS EXECUTE on get_daily_game (player-facing)',
    exists (select 1 from information_schema.routine_privileges
      where routine_schema = 'public' and routine_name = 'get_daily_game' and grantee = 'authenticated'));

  perform pg_temp.rec('privilege catalog: private.current_daily_game_id has NO anon/authenticated EXECUTE',
    not exists (select 1 from information_schema.routine_privileges
      where routine_schema = 'private' and routine_name = 'current_daily_game_id'
        and grantee in ('anon', 'authenticated')));

  perform pg_temp.rec('privilege catalog: authenticated has NO table-level INSERT on tierlist_items',
    not exists (select 1 from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'tierlist_items'
        and grantee = 'authenticated' and privilege_type = 'INSERT'));
  perform pg_temp.rec('privilege catalog: authenticated has NO table-level UPDATE on tierlist_items',
    not exists (select 1 from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'tierlist_items'
        and grantee = 'authenticated' and privilege_type = 'UPDATE'));
  perform pg_temp.rec('privilege catalog: authenticated has NO table-level DELETE on tierlist_items',
    not exists (select 1 from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'tierlist_items'
        and grantee = 'authenticated' and privilege_type = 'DELETE'));
  perform pg_temp.rec('privilege catalog: authenticated still has table-level SELECT on tierlist_items',
    exists (select 1 from information_schema.role_table_grants
      where table_schema = 'public' and table_name = 'tierlist_items'
        and grantee = 'authenticated' and privilege_type = 'SELECT'));

  perform pg_temp.rec('privilege catalog: authenticated column-UPDATE on tierlists allows title',
    exists (select 1 from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'tierlists'
        and grantee = 'authenticated' and column_name = 'title' and privilege_type = 'UPDATE'));
  perform pg_temp.rec('privilege catalog: authenticated column-UPDATE on tierlists does NOT allow status',
    not exists (select 1 from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'tierlists'
        and grantee = 'authenticated' and column_name = 'status' and privilege_type = 'UPDATE'));
  perform pg_temp.rec('privilege catalog: authenticated column-UPDATE on tierlists does NOT allow release_date',
    not exists (select 1 from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'tierlists'
        and grantee = 'authenticated' and column_name = 'release_date' and privilege_type = 'UPDATE'));
  perform pg_temp.rec('privilege catalog: authenticated column-UPDATE on tierlists does NOT allow tier_config',
    not exists (select 1 from information_schema.column_privileges
      where table_schema = 'public' and table_name = 'tierlists'
        and grantee = 'authenticated' and column_name = 'tier_config' and privilege_type = 'UPDATE'));
end;
$$;

-- =====================================================================
-- 16. get_next_release_date(): Milestone 9 countdown support
--
-- Exposes ONLY the bare date of the next FUTURE 'scheduled' release, never
-- which game it is. Deliberately the LAST mutating section: its final
-- sub-test deletes the shared 'future-game' fixture (release_date =
-- today()+30, inserted in the main fixture block above) to prove the
-- "nothing scheduled" -> NULL case, which nothing after this point in the
-- file depends on.
-- =====================================================================
do $$
declare
  v_closer   uuid := '0b000000-0000-0000-0000-0000000000c1';
  v_disabled uuid := '0b000000-0000-0000-0000-0000000000c2';
begin
  -- baseline: only the shared 'future-game' fixture (today()+30) is
  -- scheduled and future -- it wins by default.
  perform pg_temp.rec('get_next_release_date: baseline resolves the existing future-game (+30)',
    (pg_temp.eval_as('anon', null, 'select to_jsonb(public.get_next_release_date())') #>> '{}')
      = to_char(private.today() + 30, 'YYYY-MM-DD'));

  insert into public.tierlists (id, slug, title, status, release_date, tier_config)
  values (v_closer, 'm9-closer-game', 'M9 Closer Game', 'scheduled', private.today() + 5,
    '["S","A","B","C","F","N/A"]'::jsonb);

  perform pg_temp.rec('get_next_release_date: a closer scheduled date wins over a farther one (MIN, not any)',
    (pg_temp.eval_as('anon', null, 'select to_jsonb(public.get_next_release_date())') #>> '{}')
      = to_char(private.today() + 5, 'YYYY-MM-DD'));

  insert into public.tierlists (id, slug, title, status, release_date, tier_config)
  values (v_disabled, 'm9-disabled-game', 'M9 Disabled Game', 'disabled', private.today() + 2,
    '["S","A","B","C","F","N/A"]'::jsonb);

  perform pg_temp.rec('get_next_release_date: a non-''scheduled'' status is ignored even with a closer date',
    (pg_temp.eval_as('anon', null, 'select to_jsonb(public.get_next_release_date())') #>> '{}')
      = to_char(private.today() + 5, 'YYYY-MM-DD'));

  perform pg_temp.rec('get_next_release_date: today''s live-game (release_date = today, not future) never wins',
    (pg_temp.eval_as('anon', null, 'select to_jsonb(public.get_next_release_date())') #>> '{}')
      <> to_char(private.today(), 'YYYY-MM-DD'));

  delete from public.tierlists where id in (v_closer, v_disabled, '22222222-2222-2222-2222-222222222222');

  -- to_jsonb(NULL::date) is SQL NULL, not the jsonb 'null' literal -- eval_as
  -- returns that NULL straight through, so the assertion checks IS NULL, not
  -- equality with 'null'::jsonb (which itself evaluates to NULL, never TRUE).
  perform pg_temp.rec('get_next_release_date: NULL when nothing is scheduled in the future',
    (pg_temp.eval_as('anon', null, 'select to_jsonb(public.get_next_release_date())')) is null);

  perform pg_temp.rec('get_next_release_date: authenticated non-admin (bob) sees the SAME result as anon',
    (pg_temp.eval_as('authenticated', 'bbbbbbbb-0000-0000-0000-000000000002',
      'select to_jsonb(public.get_next_release_date())')) is null);

  perform pg_temp.rec('get_next_release_date: admin (alice) sees the SAME result too (caller-independent)',
    (pg_temp.eval_as('authenticated', 'aaaaaaaa-0000-0000-0000-000000000001',
      'select to_jsonb(public.get_next_release_date())')) is null);
end;
$$;

do $$
begin
  perform pg_temp.rec('privilege catalog: anon HAS EXECUTE on get_next_release_date',
    exists (select 1 from information_schema.routine_privileges
      where routine_schema = 'public' and routine_name = 'get_next_release_date' and grantee = 'anon'));
  perform pg_temp.rec('privilege catalog: authenticated HAS EXECUTE on get_next_release_date',
    exists (select 1 from information_schema.routine_privileges
      where routine_schema = 'public' and routine_name = 'get_next_release_date' and grantee = 'authenticated'));
end;
$$;

-- =====================================================================
-- results
-- =====================================================================
select id, status, name, detail from _t order by id;

select
  count(*) filter (where status = 'PASS') as passed,
  count(*) filter (where status = 'FAIL') as failed,
  count(*) as total
from _t;

rollback;
