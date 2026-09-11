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

insert into public.tierlists (id, slug, title, status, release_date, tier_config, created_by)
values
  ('11111111-1111-1111-1111-111111111111', 'live-game', 'Live Game', 'live',
   private.today(), '["S","A","B","C","D"]'::jsonb, 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('22222222-2222-2222-2222-222222222222', 'future-game', 'Future Game', 'scheduled',
   private.today() + 30, '["S","A","B","C","D"]'::jsonb, 'aaaaaaaa-0000-0000-0000-000000000001'),
  ('33333333-3333-3333-3333-333333333333', 'teardown-game', 'Teardown Game', 'live',
   private.today() - 1, '["S","A","B","C","D"]'::jsonb, 'aaaaaaaa-0000-0000-0000-000000000001');

insert into public.tierlist_items (id, tierlist_id, label, sort_order) values
  ('10000000-0000-0000-0000-0000000000a1', '11111111-1111-1111-1111-111111111111', 'Item A', 0),
  ('10000000-0000-0000-0000-0000000000b1', '11111111-1111-1111-1111-111111111111', 'Item B', 1),
  ('10000000-0000-0000-0000-0000000000c1', '11111111-1111-1111-1111-111111111111', 'Item C', 2),
  ('20000000-0000-0000-0000-0000000000a2', '22222222-2222-2222-2222-222222222222', 'Future Item', 0),
  ('30000000-0000-0000-0000-0000000000a3', '33333333-3333-3333-3333-333333333333', 'Teardown Item', 0);

-- =====================================================================
-- 1. private helpers behave; direct client calls are blocked
-- =====================================================================
do $$
begin
  perform pg_temp.rec('tier_weight S/D/Z = 5/1/0',
    private.tier_weight('["S","A","B","C","D"]'::jsonb, 'S') = 5
    and private.tier_weight('["S","A","B","C","D"]'::jsonb, 'D') = 1
    and private.tier_weight('["S","A","B","C","D"]'::jsonb, 'Z') = 0);
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

-- authenticated profile reads: allowed, but is_admin column is not
do $$
begin
  perform pg_temp.rec('authed CAN read safe profile columns',
    (pg_temp.eval_as('authenticated', 'cccccccc-0000-0000-0000-000000000003',
      'select to_jsonb(count(*)) from public.profiles')) = '3'::jsonb);
end;
$$;
select pg_temp.expect_err('authed cannot read profiles.is_admin column', 'authenticated', 'cccccccc-0000-0000-0000-000000000003', 'select is_admin from public.profiles limit 1', '42501');

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
        {"item_id":"10000000-0000-0000-0000-0000000000c1","tier":"D","position":0}]''::jsonb,
     ''0f000000-0000-0000-0000-000000000001'')');

do $$
begin
  perform pg_temp.rec('aggregate after 1 submission: A={S:1} total=1 weight=5',
    (select tier_counts = '{"S": 1}'::jsonb and total_submissions = 1 and sum_weight = 5
     from public.tierlist_item_stats where tierlist_item_id = '10000000-0000-0000-0000-0000000000a1'));
end;
$$;

-- duplicate guest submission blocked
select pg_temp.expect_err('guest cannot submit twice', 'anon', null,
  'select public.submit_ranking(''11111111-1111-1111-1111-111111111111'',
     ''[{"item_id":"10000000-0000-0000-0000-0000000000a1","tier":"S","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000b1","tier":"A","position":0},
        {"item_id":"10000000-0000-0000-0000-0000000000c1","tier":"D","position":0}]''::jsonb,
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
    (select tier_counts = '{"S": 1}'::jsonb and total_submissions = 1 and sum_weight = 5
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
  perform pg_temp.rec('aggregate after 2 submissions: A={S:2} total=2 weight=10',
    (select tier_counts = '{"S": 2}'::jsonb and total_submissions = 2 and sum_weight = 10
     from public.tierlist_item_stats where tierlist_item_id = '10000000-0000-0000-0000-0000000000a1'));
  perform pg_temp.rec('aggregate C = {D:1,B:1} total=2 weight=4',
    (select tier_counts = '{"B": 1, "D": 1}'::jsonb and total_submissions = 2 and sum_weight = 4
     from public.tierlist_item_stats where tierlist_item_id = '10000000-0000-0000-0000-0000000000c1'));
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

-- game teardown still cascades (UPDATE-only trigger, not DELETE)
do $$
declare got text;
begin
  perform set_config('request.jwt.claims', NULL, true);  -- ensure guest path
  perform public.submit_ranking('33333333-3333-3333-3333-333333333333',
    '[{"item_id":"30000000-0000-0000-0000-0000000000a3","tier":"S","position":0}]'::jsonb,
    '0f000000-0000-0000-0000-000000000003');
  begin
    delete from public.tierlists where id = '33333333-3333-3333-3333-333333333333';
    got := 'ok';
  exception when others then got := sqlstate;
  end;
  perform pg_temp.rec('game teardown cascades despite immutability trigger', got = 'ok', 'got ' || got);
  perform pg_temp.rec('teardown removed its submissions',
    (select count(*) = 0 from public.submissions where tierlist_id = '33333333-3333-3333-3333-333333333333'));
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
-- results
-- =====================================================================
select id, status, name, detail from _t order by id;

select
  count(*) filter (where status = 'PASS') as passed,
  count(*) filter (where status = 'FAIL') as failed,
  count(*) as total
from _t;

rollback;
