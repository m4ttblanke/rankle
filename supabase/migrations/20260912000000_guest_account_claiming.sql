-- Rankle -- Milestone 6: guest -> account claiming
--
-- Depends on migrations 1-7 (core schema, submissions/results, sharing, RLS
-- hardening, has_submitted_ranking, N/A tier scale, get_results submission_id).
--
-- Creates:
--   * claimed_guest_submissions (additive link table; never mutates submissions)
--   * public.claim_guest_submissions (the claim operation -- NOT a public RPC,
--     see section 3 below for why)
--
-- Modifies (to make claimed submissions count as the claiming user's own,
-- everywhere identity is already resolved):
--   * private.has_submitted
--   * public.has_submitted_ranking
--   * public.get_results     (my_ranking + submission_id subqueries)
--   * public.create_share    (ownership check)
--   * public.submit_ranking  (explicit duplicate-via-claim guard)
--   * RLS SELECT policies on submissions / submission_items (the claiming
--     user can read a claimed row directly, same as their own direct
--     submissions -- needed for Milestone 6's own /profile and /history/[id]
--     reads, which are plain RLS-gated table reads, not a new RPC)
--
-- Does NOT modify public.get_share -- its eligibility already delegates to
-- private.has_submitted() for the authenticated branch, so it becomes
-- claim-aware transitively, with zero changes of its own (verified by reading
-- its body: `v_eligible := (v_share.created_by = v_uid) or
-- private.has_submitted(v_share.tierlist_id);`).
--
-- Never touches the CONTENTS of submissions, submission_items, or
-- tierlist_item_stats (the aggregate table), or shares. A claimed submission
-- is never rewritten, copied, or deleted, and claiming never recomputes or
-- re-touches any aggregate -- the original submit_ranking() call already
-- counted it exactly once, and nothing here runs that logic again. The RLS
-- policy changes above widen who may SELECT an existing row; they do not
-- change any row's data.

------------------------------------------------------------------------
-- 1. claimed_guest_submissions
------------------------------------------------------------------------
create table public.claimed_guest_submissions (
  submission_id uuid primary key references public.submissions (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  -- Denormalized provenance only (which guest identity this came from) --
  -- never used as an authorization check on its own after this row exists.
  guest_id      uuid not null,
  claimed_at    timestamptz not null default now()
);

create index claimed_guest_submissions_user_idx
  on public.claimed_guest_submissions (user_id);

comment on table public.claimed_guest_submissions is
  'Milestone 6: links a guest-owned submissions row to the authenticated user who claimed it, without ever mutating the original (immutable) submission. Written only by claim_guest_submissions(); see that function for why it is not a public RPC. Read by the owning user directly (RLS) for history.';

alter table public.claimed_guest_submissions enable row level security;

-- No grant to anon at all. authenticated may only ever SELECT their own rows
-- -- the same "read your own rows" pattern as submissions/submission_items.
-- No INSERT/UPDATE/DELETE grant to any client role: the table is written
-- exclusively by claim_guest_submissions(), a SECURITY DEFINER function that
-- bypasses RLS/grants by running as its owner.
grant select on public.claimed_guest_submissions to authenticated;

create policy claimed_guest_submissions_select_own_or_admin
  on public.claimed_guest_submissions
  for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

------------------------------------------------------------------------
-- 2. identity readers: recognize a claimed submission as the claiming
--    user's own, alongside a direct user_id match
------------------------------------------------------------------------

-- private.has_submitted: used by get_results()'s eligibility check AND the
-- tierlist_item_stats RLS policy (stats_select_after_submit_or_admin). Fixing
-- this one function is what makes BOTH of those claim-aware with no further
-- changes to either.
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
      and (
        s.user_id = (select auth.uid())
        or exists (
          select 1
          from public.claimed_guest_submissions c
          where c.submission_id = s.id
            and c.user_id = (select auth.uid())
        )
      )
  );
$$;
revoke all on function private.has_submitted(uuid) from public;
grant execute on function private.has_submitted(uuid) to anon, authenticated;

-- has_submitted_ranking: same claim-aware extension of the authenticated
-- branch. Still returns ONLY a boolean -- no new information disclosed.
create or replace function public.has_submitted_ranking(
  p_tierlist_id uuid,
  p_guest_id    uuid default null
)
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
        (
          (select auth.uid()) is not null
          and (
            s.user_id = (select auth.uid())
            or exists (
              select 1
              from public.claimed_guest_submissions c
              where c.submission_id = s.id
                and c.user_id = (select auth.uid())
            )
          )
        )
        or ((select auth.uid()) is null and p_guest_id is not null and s.guest_id = p_guest_id)
      )
  );
$$;
revoke all on function public.has_submitted_ranking(uuid, uuid) from public;
grant execute on function public.has_submitted_ranking(uuid, uuid) to anon, authenticated;

-- get_results: the eligibility check (private.has_submitted) is already
-- fixed above. The my_ranking and submission_id subqueries independently
-- re-resolve "which row is MY submission for this game" and need the same
-- claim-aware extension, or an eligible-via-claim caller would see an empty
-- my_ranking / null submission_id despite passing the gate.
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
          (v_uid is not null and (
            s.user_id = v_uid
            or exists (
              select 1 from public.claimed_guest_submissions c
              where c.submission_id = s.id and c.user_id = v_uid
            )
          ))
          or (v_uid is null and s.guest_id = p_guest_id)
        )
    ),
    'submission_id', (
      select s.id
      from public.submissions s
      where s.tierlist_id = p_tierlist_id
        and (
          (v_uid is not null and (
            s.user_id = v_uid
            or exists (
              select 1 from public.claimed_guest_submissions c
              where c.submission_id = s.id and c.user_id = v_uid
            )
          ))
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

-- create_share: ownership check extended so the claiming user can create (or,
-- far more commonly, idempotently re-fetch) the share for a claimed
-- submission -- including one the guest already created before signing in.
create or replace function public.create_share(
  p_submission_id uuid,
  p_guest_id      uuid default null
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_sub   public.submissions%rowtype;
  v_token text;
begin
  select * into v_sub from public.submissions where id = p_submission_id;
  if not found then
    raise exception 'rankle: submission not found' using errcode = 'no_data_found';
  end if;

  if not (
    (v_uid is not null and (
      v_sub.user_id = v_uid
      or exists (
        select 1 from public.claimed_guest_submissions c
        where c.submission_id = v_sub.id and c.user_id = v_uid
      )
    ))
    or (v_uid is null and p_guest_id is not null and v_sub.guest_id = p_guest_id)
  ) then
    raise exception 'rankle: you can only share your own ranking'
      using errcode = 'insufficient_privilege';
  end if;

  select token into v_token from public.shares where submission_id = p_submission_id;
  if v_token is not null then
    return v_token;
  end if;

  v_token := encode(extensions.gen_random_bytes(16), 'hex');

  insert into public.shares (token, tierlist_id, submission_id, created_by, guest_id)
  values (v_token, v_sub.tierlist_id, p_submission_id, v_sub.user_id, v_sub.guest_id)
  on conflict (submission_id) do nothing;

  select token into v_token from public.shares where submission_id = p_submission_id;
  return v_token;
end;
$$;
revoke all on function public.create_share(uuid, uuid) from public;
grant execute on function public.create_share(uuid, uuid) to anon, authenticated;

------------------------------------------------------------------------
-- RLS: recognize claimed ownership on direct SELECT
--
-- /profile and /history/[id] (Milestone 6) read submissions/submission_items
-- directly via RLS (no new RPC -- "prefer existing safe access" over "RPC for
-- everything"). The existing submissions_select_own_or_admin /
-- submission_items_select_own_or_admin policies only ever matched
-- user_id = auth.uid(), which a claimed row never has (claiming never sets
-- it). Widened to also match via claimed_guest_submissions, mirroring every
-- other identity check touched in this migration. This only changes who may
-- SELECT an existing row -- no write policy exists on either table (writes
-- stay RPC-only), and no other table's policies are touched.
------------------------------------------------------------------------
drop policy submissions_select_own_or_admin on public.submissions;
create policy submissions_select_own_or_admin
  on public.submissions
  for select
  to authenticated
  using (
    user_id = (select auth.uid())
    or (select private.is_admin())
    or exists (
      select 1 from public.claimed_guest_submissions c
      where c.submission_id = submissions.id and c.user_id = (select auth.uid())
    )
  );

drop policy submission_items_select_own_or_admin on public.submission_items;
create policy submission_items_select_own_or_admin
  on public.submission_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.submissions s
      where s.id = submission_id
        and (
          s.user_id = (select auth.uid())
          or (select private.is_admin())
          or exists (
            select 1 from public.claimed_guest_submissions c
            where c.submission_id = s.id and c.user_id = (select auth.uid())
          )
        )
    )
  );

-- submit_ranking: the unique index on (tierlist_id, user_id) cannot catch a
-- second DIRECT submission for a tierlist that is already represented by a
-- CLAIMED guest submission -- that row has user_id IS NULL, so the index sees
-- no conflict. This explicit pre-check closes that gap, raising the SAME
-- errcode (unique_violation) the index would raise for an ordinary duplicate,
-- so the existing application-layer mapping (-> reason: "already") is
-- unchanged.
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
  -- for an ordinary duplicate (unchanged application-layer mapping).
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
  -- records it, but it must NEVER feed total_submissions or sum_weight (see
  -- migration 20260910180000_na_tier_scale.sql).
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

------------------------------------------------------------------------
-- 3. claim_guest_submissions -- deliberately NOT a public RPC
--
-- What this claims: every submissions row owned by p_guest_id, EXCEPT:
--   * one already claimed by anyone (idempotent -- also prevents stealing an
--     already-claimed row out from under its current owner)
--   * one for a tierlist where p_user_id already has a DIRECT submission
--     (the direct/authenticated submission always wins; the guest row for
--     that tierlist is simply left unclaimed, permanently -- never merged,
--     deleted, or overwritten)
--   * one for a tierlist where p_user_id already has a PREVIOUSLY CLAIMED
--     submission (covers claiming from a second/different guest identity
--     without ending up with two claimed rows for the same game)
-- Fully set-based (no loop), idempotent (safe to call on every sign-in), and
-- never touches submissions / submission_items / tierlist_item_stats / shares.
--
-- SECURITY -- why this is not exposed to anon/authenticated via PostgREST:
--
-- The real authorization question is "does the caller actually possess the
-- signed httpOnly rankle_guest cookie for p_guest_id?" That is an HMAC check
-- against GUEST_COOKIE_SECRET (lib/game/guest.ts) -- a secret Postgres does
-- not have and RLS cannot express. A raw guest UUID is not, by itself, proof
-- of anything to the database.
--
-- If this function were EXECUTE-granted to `authenticated` (the normal
-- pattern for every other RPC in this project), ANY authenticated caller
-- could invoke it directly through PostgREST with ANY guest UUID they
-- supply -- there is no RLS predicate that could verify cookie possession to
-- stop them. Guest ids are never intentionally exposed (unlike M5 share
-- tokens, which are DESIGNED to be shared), but they are also not designed
-- to be secret bearer credentials, and "the app never shows it to anyone"
-- is not a defensible database-level security boundary on its own.
--
-- So this function has NO grant to anon or authenticated at all -- it is not
-- a public RPC. The only caller that can ever reach it is one holding the
-- service-role key (lib/supabase/service-role.ts), which is server-only by
-- construction (never a NEXT_PUBLIC_* var -- absent from every browser
-- bundle) and used for exactly this one call site: app/auth/callback's
-- Route Handler, AFTER it has independently: (a) exchanged the OTP code for
-- a real Supabase Auth session and confirmed it via auth.getUser()
-- (JWT-verified, not just a cookie read), and (b) read+HMAC-verified the
-- guest cookie via the existing getGuestId() (returns null if missing or
-- tampered). p_user_id / p_guest_id are trusted here ONLY because of who is
-- allowed to call this function at all (service-role holders only) -- never
-- because a caller merely supplied them. No client UI or API in this
-- codebase accepts a user-entered guest UUID.
--
-- Calling PostgREST's /rest/v1/rpc/claim_guest_submissions directly with an
-- anon or authenticated key -- with any p_guest_id, real or not -- fails
-- with 42501 (insufficient_privilege) before the function body ever runs.
-- Verified in supabase/tests/rls_spec.sql.
------------------------------------------------------------------------
create or replace function public.claim_guest_submissions(
  p_user_id  uuid,
  p_guest_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_claimed integer;
begin
  if p_user_id is null or p_guest_id is null then
    return 0;
  end if;

  with claimable as (
    select s.id as submission_id
    from public.submissions s
    where s.guest_id = p_guest_id
      and not exists (
        select 1 from public.claimed_guest_submissions c
        where c.submission_id = s.id
      )
      and not exists (
        select 1 from public.submissions s2
        where s2.tierlist_id = s.tierlist_id and s2.user_id = p_user_id
      )
      and not exists (
        select 1
        from public.claimed_guest_submissions c2
        join public.submissions s3 on s3.id = c2.submission_id
        where c2.user_id = p_user_id and s3.tierlist_id = s.tierlist_id
      )
  )
  insert into public.claimed_guest_submissions (submission_id, user_id, guest_id)
  select submission_id, p_user_id, p_guest_id from claimable
  on conflict (submission_id) do nothing;

  get diagnostics v_claimed = row_count;
  return v_claimed;
end;
$$;

-- Deliberately NOT granted to anon/authenticated -- see the header comment
-- above. Only service-role (and the function's own postgres owner) can call
-- this. The explicit revoke is defense in depth / documentation: a function
-- newly created in this project's default setup is not granted to anon or
-- authenticated automatically, but making the intent explicit here (matching
-- every other RPC's own explicit revoke/grant pair) means a future migration
-- author sees a deliberate absence, not an oversight.
revoke all on function public.claim_guest_submissions(uuid, uuid) from public, anon, authenticated;
