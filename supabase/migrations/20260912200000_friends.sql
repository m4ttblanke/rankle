-- Rankle -- Milestone 7: friends
--
-- Depends on migrations 1-9 (core schema, submissions/results, sharing, RLS
-- hardening, has_submitted_ranking, N/A tier scale, get_results
-- submission_id, guest account claiming + its grant fix).
--
-- Creates:
--   * friendships              (canonical unordered pair; symmetric by construction)
--   * friend_requests          (pending-only; no status column -- see below)
--   * private.has_submitted_by (claim-aware "has THIS user submitted" -- a
--                                parameterized sibling of private.has_submitted,
--                                reused by get_friend_played_status and
--                                get_friend_results)
--   * private.lock_friend_pair (advisory-lock helper serializing concurrent
--                                mutations between the same two users)
--   * public.search_profiles          (authenticated-only user discovery)
--   * public.list_friend_requests     (incoming + outgoing, with joined profile)
--   * public.send_friend_request
--   * public.accept_friend_request
--   * public.decline_friend_request
--   * public.cancel_friend_request
--   * public.remove_friend
--   * public.get_friend_played_status (boolean-only, safe pre-submission)
--   * public.get_friend_results       (spoiler-gated ranking comparison reader)
--
-- Modifies:
--   * profiles RLS -- narrows `profiles_select_authenticated` (every
--     authenticated user could read every profile's safe columns; unused by
--     any code path, but M7's search feature is the first thing that makes it
--     a live full-enumeration bypass of search_profiles' cap/prefix rules) to
--     `profiles_select_self_or_friend`: a user may directly read their own
--     row, an accepted friend's row, or (as before) any row as admin. A
--     PENDING request's counterpart is deliberately NOT added to this
--     predicate -- that identity is exposed through exactly one audited path,
--     list_friend_requests(), rather than widening raw table access to a
--     relationship that isn't a friendship yet. Nothing in the existing app
--     depended on the broad grant (get_share/search/history all resolve
--     identity via RPC or the caller's own row), so this is a pure narrowing.
--
-- FRIEND REQUEST MODEL -- why there is no status column:
-- A friend_requests row can only ever be observed in one state: pending. The
-- moment it resolves (accept, decline, or cancel), the row is deleted --
-- accept additionally inserts the corresponding friendships row first, in the
-- same statement sequence. No accepted/declined history is retained (CLAUDE.md:
-- "do not retain unnecessary social history just because it's easy"); the
-- friendships table is the sole durable record of an active relationship.
-- This also means the friend_requests table needs no direct client grant at
-- all (mirrors `shares`): every read goes through list_friend_requests(),
-- every write through one of the four request RPCs below, each independently
-- authorizing against auth.uid() before touching a row.
--
-- RACE HANDLING -- mutual/near-simultaneous requests:
-- Every mutating RPC below takes private.lock_friend_pair(a, b) -- a
-- pg_advisory_xact_lock keyed by the sorted pair -- before reading or writing
-- friend_requests/friendships for that pair, serializing concurrent calls
-- between the same two users for the lifetime of the transaction. Within that
-- lock, send_friend_request explicitly checks for an existing REVERSE pending
-- request and, if found, converts it directly into a friendship instead of
-- inserting a second pending row in the opposite direction -- a mutual
-- near-simultaneous request deterministically resolves to exactly one
-- friendship, never two pending rows.
--
-- FRIEND RESULTS ACCESS RULE (docs/MANUAL.md sec 16-19, docs/SECURITY.md sec 24):
-- User U may see friend F's ranking for tierlist T only if (1) U and F are
-- currently friends, (2) U has an official submission for T, and (3) F has an
-- official submission for T -- claimed guest submissions count as either
-- side's own, exactly as Milestone 6 established. get_friend_results()
-- enforces all three itself; get_friend_played_status() enforces only
-- "signed in" and returns booleans only, since MANUAL sec 17 allows a
-- spoiler-safe played/not-played signal before the viewer's own submission.

------------------------------------------------------------------------
-- 1. private helpers
------------------------------------------------------------------------

-- Claim-aware "has p_user_id submitted p_tierlist_id" for an ARBITRARY user
-- id, not just auth.uid() -- private.has_submitted (migration 2/8) stays
-- as-is for its own callers (get_results' eligibility gate, the
-- tierlist_item_stats RLS policy); this is a separate, parameterized sibling
-- so friend-results code needs the same claim-aware logic for a user who is
-- NOT the caller. Internal only -- never referenced in an RLS policy
-- expression, so (unlike has_submitted) it does not need an anon/authenticated
-- EXECUTE grant; only other SECURITY DEFINER function bodies call it.
create or replace function private.has_submitted_by(p_tierlist_id uuid, p_user_id uuid)
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
      and (
        s.user_id = p_user_id
        or exists (
          select 1
          from public.claimed_guest_submissions c
          where c.submission_id = s.id
            and c.user_id = p_user_id
        )
      )
  );
$$;
revoke all on function private.has_submitted_by(uuid, uuid) from public, anon, authenticated;

-- Serializes concurrent friend-relationship mutations between the same two
-- users for the lifetime of the calling transaction. Order-independent (the
-- key is built from the sorted pair), so a(b) and b(a) contend for the same
-- lock regardless of call order.
create or replace function private.lock_friend_pair(p_a uuid, p_b uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  perform pg_advisory_xact_lock(hashtext(least(p_a, p_b)::text || greatest(p_a, p_b)::text)::bigint);
end;
$$;
revoke all on function private.lock_friend_pair(uuid, uuid) from public, anon, authenticated;

------------------------------------------------------------------------
-- 2. friendships -- canonical unordered pair, symmetric by construction
------------------------------------------------------------------------
create table public.friendships (
  user_id_low  uuid not null references public.profiles (id) on delete cascade,
  user_id_high uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (user_id_low, user_id_high),
  constraint friendships_ordered check (user_id_low < user_id_high)
);

create index friendships_high_idx on public.friendships (user_id_high);

comment on table public.friendships is
  'Milestone 7: one row per friend pair, canonically ordered (user_id_low < user_id_high) so the relationship is symmetric by construction -- never directional rows. Written only by send_friend_request (mutual-request race) / accept_friend_request; removed only by remove_friend. All SECURITY DEFINER, bypassing RLS/grants as their owner.';

alter table public.friendships enable row level security;

revoke all on public.friendships from anon, authenticated;
grant select on public.friendships to authenticated;

create policy friendships_select_participant_or_admin
  on public.friendships
  for select
  to authenticated
  using (
    user_id_low = (select auth.uid())
    or user_id_high = (select auth.uid())
    or (select private.is_admin())
  );
-- No insert/update/delete grants to any client role -- writes are RPC-only.

------------------------------------------------------------------------
-- 3. friend_requests -- pending-only, RPC-only (no direct client grants)
------------------------------------------------------------------------
create table public.friend_requests (
  id           uuid primary key default gen_random_uuid(),
  sender_id    uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  constraint friend_requests_not_self check (sender_id <> recipient_id)
);

-- blocks a duplicate pending request in the same direction
create unique index friend_requests_pair_key on public.friend_requests (sender_id, recipient_id);
create index friend_requests_recipient_idx on public.friend_requests (recipient_id);

comment on table public.friend_requests is
  'Milestone 7: a row exists <=> that request is pending -- there is no status column because a persisted row can only ever mean "pending" (accept/decline/cancel all delete the row on resolution; accept additionally creates the friendships row first). No accepted/declined history is retained. No direct client grant at all (mirrors `shares`): every read goes through list_friend_requests(), every write through send_/accept_/decline_/cancel_friend_request().';

alter table public.friend_requests enable row level security;

revoke all on public.friend_requests from anon, authenticated;
-- Intentionally no policies and no grants -- see table comment. RLS is
-- defense in depth here; the absent grants already deny anon/authenticated
-- outright, same as `shares`.

------------------------------------------------------------------------
-- 4. profiles RLS: narrow from "any authenticated user, any row" to
--    "self, an accepted friend, or admin" -- see header comment.
------------------------------------------------------------------------
drop policy profiles_select_authenticated on public.profiles;

create policy profiles_select_self_or_friend
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or (select private.is_admin())
    or exists (
      select 1
      from public.friendships f
      where (f.user_id_low = (select auth.uid()) and f.user_id_high = profiles.id)
         or (f.user_id_high = (select auth.uid()) and f.user_id_low = profiles.id)
    )
  );

------------------------------------------------------------------------
-- 5. search_profiles -- the ONLY arbitrary-user discovery mechanism
------------------------------------------------------------------------
-- authenticated-only, prefix match, capped, excludes the caller, returns only
-- safe columns plus a computed relationship so the UI can render the correct
-- button state without N+1 calls. No fuzzy-search dependency, no leading
-- wildcard (avoids an unbounded scan), no raw-count-of-all-users leak.
create or replace function public.search_profiles(p_query text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := (select auth.uid());
  v_norm text;
begin
  if v_uid is null then
    raise exception 'rankle: sign in required' using errcode = 'insufficient_privilege';
  end if;

  v_norm := lower(trim(coalesce(p_query, '')));
  if char_length(v_norm) < 2 then
    return jsonb_build_object('results', '[]'::jsonb);
  end if;

  return jsonb_build_object(
    'results', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'id', s.id,
            'username', s.username,
            'display_name', s.display_name,
            'avatar_url', s.avatar_url,
            'relationship', s.relationship
          )
        ),
        '[]'::jsonb
      )
      from (
        select
          p.id,
          p.username,
          p.display_name,
          p.avatar_url,
          case
            when exists (
              select 1 from public.friendships f
              where f.user_id_low = least(v_uid, p.id) and f.user_id_high = greatest(v_uid, p.id)
            ) then 'friends'
            when exists (
              select 1 from public.friend_requests r
              where r.sender_id = v_uid and r.recipient_id = p.id
            ) then 'pending_outgoing'
            when exists (
              select 1 from public.friend_requests r
              where r.sender_id = p.id and r.recipient_id = v_uid
            ) then 'pending_incoming'
            else 'none'
          end as relationship
        from public.profiles p
        where p.id <> v_uid
          and lower(p.username) like v_norm || '%'
        order by p.username
        limit 20
      ) s
    )
  );
end;
$$;
revoke all on function public.search_profiles(text) from public;
grant execute on function public.search_profiles(text) to authenticated;

------------------------------------------------------------------------
-- 6. list_friend_requests -- the ONLY reader of pending-request counterpart
--    identity (profiles RLS deliberately does not cover this relationship;
--    see section 4's header comment)
------------------------------------------------------------------------
create or replace function public.list_friend_requests()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'rankle: sign in required' using errcode = 'insufficient_privilege';
  end if;

  return jsonb_build_object(
    'incoming', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'request_id', r.id,
            'user', jsonb_build_object(
              'id', p.id,
              'username', p.username,
              'display_name', p.display_name,
              'avatar_url', p.avatar_url
            ),
            'created_at', r.created_at
          )
          order by r.created_at desc
        ),
        '[]'::jsonb
      )
      from public.friend_requests r
      join public.profiles p on p.id = r.sender_id
      where r.recipient_id = v_uid
    ),
    'outgoing', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'request_id', r.id,
            'user', jsonb_build_object(
              'id', p.id,
              'username', p.username,
              'display_name', p.display_name,
              'avatar_url', p.avatar_url
            ),
            'created_at', r.created_at
          )
          order by r.created_at desc
        ),
        '[]'::jsonb
      )
      from public.friend_requests r
      join public.profiles p on p.id = r.recipient_id
      where r.sender_id = v_uid
    )
  );
end;
$$;
revoke all on function public.list_friend_requests() from public;
grant execute on function public.list_friend_requests() to authenticated;

------------------------------------------------------------------------
-- 7. send_friend_request -- the only way a friend_requests row (or, via the
--    mutual-race path, a friendships row) is ever created from a request
------------------------------------------------------------------------
create or replace function public.send_friend_request(p_recipient_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := (select auth.uid());
  v_low        uuid;
  v_high       uuid;
  v_reverse_id uuid;
begin
  if v_uid is null then
    raise exception 'rankle: sign in required' using errcode = 'insufficient_privilege';
  end if;

  if p_recipient_id = v_uid then
    raise exception 'rankle: you cannot send a friend request to yourself'
      using errcode = 'check_violation';
  end if;

  if not exists (select 1 from public.profiles where id = p_recipient_id) then
    raise exception 'rankle: user not found' using errcode = 'no_data_found';
  end if;

  perform private.lock_friend_pair(v_uid, p_recipient_id);

  v_low  := least(v_uid, p_recipient_id);
  v_high := greatest(v_uid, p_recipient_id);

  if exists (
    select 1 from public.friendships
    where user_id_low = v_low and user_id_high = v_high
  ) then
    return jsonb_build_object('status', 'friends');
  end if;

  if exists (
    select 1 from public.friend_requests
    where sender_id = v_uid and recipient_id = p_recipient_id
  ) then
    return jsonb_build_object('status', 'already_pending');
  end if;

  select id into v_reverse_id
  from public.friend_requests
  where sender_id = p_recipient_id and recipient_id = v_uid;

  if v_reverse_id is not null then
    -- Mutual near-simultaneous request: resolve into exactly one friendship
    -- instead of a second pending row in the opposite direction.
    insert into public.friendships (user_id_low, user_id_high)
    values (v_low, v_high)
    on conflict do nothing;
    delete from public.friend_requests where id = v_reverse_id;
    return jsonb_build_object('status', 'friends');
  end if;

  insert into public.friend_requests (sender_id, recipient_id)
  values (v_uid, p_recipient_id);

  return jsonb_build_object('status', 'pending');
end;
$$;
revoke all on function public.send_friend_request(uuid) from public;
grant execute on function public.send_friend_request(uuid) to authenticated;

------------------------------------------------------------------------
-- 8. accept_friend_request -- recipient-only; the only other place a
--    friendships row is created
------------------------------------------------------------------------
create or replace function public.accept_friend_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_req public.friend_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'rankle: sign in required' using errcode = 'insufficient_privilege';
  end if;

  select * into v_req from public.friend_requests where id = p_request_id;
  if not found then
    return false; -- already resolved (accepted/declined/canceled) -- idempotent
  end if;

  if v_req.recipient_id <> v_uid then
    raise exception 'rankle: only the recipient can accept this request'
      using errcode = 'insufficient_privilege';
  end if;

  perform private.lock_friend_pair(v_req.sender_id, v_req.recipient_id);

  -- re-check after acquiring the lock: a concurrent decline/cancel may have
  -- deleted this row while we waited for it.
  if not exists (select 1 from public.friend_requests where id = p_request_id) then
    return false;
  end if;

  insert into public.friendships (user_id_low, user_id_high)
  values (least(v_req.sender_id, v_req.recipient_id), greatest(v_req.sender_id, v_req.recipient_id))
  on conflict do nothing;

  delete from public.friend_requests where id = p_request_id;

  return true;
end;
$$;
revoke all on function public.accept_friend_request(uuid) from public;
grant execute on function public.accept_friend_request(uuid) to authenticated;

------------------------------------------------------------------------
-- 9. decline_friend_request -- recipient-only
------------------------------------------------------------------------
create or replace function public.decline_friend_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_req public.friend_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'rankle: sign in required' using errcode = 'insufficient_privilege';
  end if;

  select * into v_req from public.friend_requests where id = p_request_id;
  if not found then
    return false; -- idempotent: already resolved
  end if;

  if v_req.recipient_id <> v_uid then
    raise exception 'rankle: only the recipient can decline this request'
      using errcode = 'insufficient_privilege';
  end if;

  delete from public.friend_requests where id = p_request_id;
  return true;
end;
$$;
revoke all on function public.decline_friend_request(uuid) from public;
grant execute on function public.decline_friend_request(uuid) to authenticated;

------------------------------------------------------------------------
-- 10. cancel_friend_request -- sender-only (retract an unresolved outgoing
--     request; distinct from decline, which is recipient-only)
------------------------------------------------------------------------
create or replace function public.cancel_friend_request(p_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_req public.friend_requests%rowtype;
begin
  if v_uid is null then
    raise exception 'rankle: sign in required' using errcode = 'insufficient_privilege';
  end if;

  select * into v_req from public.friend_requests where id = p_request_id;
  if not found then
    return false; -- idempotent: already resolved
  end if;

  if v_req.sender_id <> v_uid then
    raise exception 'rankle: only the sender can cancel this request'
      using errcode = 'insufficient_privilege';
  end if;

  delete from public.friend_requests where id = p_request_id;
  return true;
end;
$$;
revoke all on function public.cancel_friend_request(uuid) from public;
grant execute on function public.cancel_friend_request(uuid) to authenticated;

------------------------------------------------------------------------
-- 11. remove_friend -- either participant; symmetric removal
------------------------------------------------------------------------
create or replace function public.remove_friend(p_user_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_deleted integer;
begin
  if v_uid is null then
    raise exception 'rankle: sign in required' using errcode = 'insufficient_privilege';
  end if;

  if p_user_id = v_uid then
    return false;
  end if;

  perform private.lock_friend_pair(v_uid, p_user_id);

  delete from public.friendships
  where user_id_low = least(v_uid, p_user_id)
    and user_id_high = greatest(v_uid, p_user_id);

  get diagnostics v_deleted = row_count;
  return v_deleted > 0;
end;
$$;
revoke all on function public.remove_friend(uuid) from public;
grant execute on function public.remove_friend(uuid) to authenticated;

------------------------------------------------------------------------
-- 12. get_friend_played_status -- boolean-only, safe to call BEFORE the
--     caller's own submission (docs/MANUAL.md sec 17)
------------------------------------------------------------------------
create or replace function public.get_friend_played_status(p_tierlist_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'rankle: sign in required' using errcode = 'insufficient_privilege';
  end if;

  return jsonb_build_object(
    'friends', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'user_id', f.fid,
            'played', private.has_submitted_by(p_tierlist_id, f.fid)
          )
        ),
        '[]'::jsonb
      )
      from (
        select case when user_id_low = v_uid then user_id_high else user_id_low end as fid
        from public.friendships
        where user_id_low = v_uid or user_id_high = v_uid
      ) f
    )
  );
end;
$$;
revoke all on function public.get_friend_played_status(uuid) from public;
grant execute on function public.get_friend_played_status(uuid) to authenticated;

------------------------------------------------------------------------
-- 13. get_friend_results -- the friend-results reader. Requires the CALLER
--     to have already submitted; returns a ranking only for friends who have
--     ALSO submitted. Claim-aware on both sides. No rows for non-friends (the
--     query only ever iterates the caller's own friendships), no rows for a
--     friend who hasn't submitted (filtered out), empty `friends: []` rather
--     than an error when nobody qualifies.
------------------------------------------------------------------------
create or replace function public.get_friend_results(p_tierlist_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'rankle: sign in required' using errcode = 'insufficient_privilege';
  end if;

  if not private.has_submitted_by(p_tierlist_id, v_uid) then
    raise exception 'rankle: submit your ranking before viewing friend results'
      using errcode = 'insufficient_privilege';
  end if;

  return jsonb_build_object(
    'friends', (
      select coalesce(
        jsonb_agg(
          jsonb_build_object(
            'user', jsonb_build_object(
              'id', p.id,
              'username', p.username,
              'display_name', p.display_name,
              'avatar_url', p.avatar_url
            ),
            'ranking', (
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
              join public.submissions fs on fs.id = si.submission_id
              where fs.tierlist_id = p_tierlist_id
                and (
                  fs.user_id = f.fid
                  or exists (
                    select 1 from public.claimed_guest_submissions c
                    where c.submission_id = fs.id and c.user_id = f.fid
                  )
                )
            )
          )
        ),
        '[]'::jsonb
      )
      from (
        select case when user_id_low = v_uid then user_id_high else user_id_low end as fid
        from public.friendships
        where user_id_low = v_uid or user_id_high = v_uid
      ) f
      join public.profiles p on p.id = f.fid
      where private.has_submitted_by(p_tierlist_id, f.fid)
    )
  );
end;
$$;
revoke all on function public.get_friend_results(uuid) from public;
grant execute on function public.get_friend_results(uuid) to authenticated;
