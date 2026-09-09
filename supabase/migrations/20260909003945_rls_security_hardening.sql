-- Rankle MVP -- Migration 4/4: RLS, table privileges, hardening
--
-- Depends on migrations 1-3. This migration is the single place where row
-- access and privileges are decided:
--   * enable RLS explicitly on every application table
--   * revoke Supabase's default blanket table grants for anon/authenticated,
--     then re-grant the minimum each role needs
--   * define every RLS policy
--   * harden the pre-existing public.rls_auto_enable() event-trigger function
--     flagged by security advisors 0028 / 0029
--
-- Trust model:
--   * service_role keeps its default privileges and bypasses RLS (server only;
--     never shipped to the browser).
--   * SECURITY DEFINER RPCs (public.submit_ranking / get_results / create_share
--     / get_share) run as the owner and bypass RLS by design; they do their own
--     auth.uid() / guest-id / admin checks internally.
--   * The private.* policy helpers (is_admin, is_tierlist_public, has_submitted)
--     are SECURITY DEFINER and are EXECUTE-granted to anon/authenticated
--     (migrations 1-2) because this Postgres enforces the invoking role's
--     EXECUTE privilege on functions named in a policy expression. They leak
--     nothing: each returns only a boolean about the caller or public release
--     state, and the private schema is not exposed through PostgREST.
--   * All direct client (anon / authenticated) access to application tables is
--     read-only and RLS-gated. Every write goes through a SECURITY DEFINER RPC.

------------------------------------------------------------------------
-- 1. enable RLS (idempotent; the `ensure_rls` event trigger also does this)
------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.tierlists           enable row level security;
alter table public.tierlist_items      enable row level security;
alter table public.submissions         enable row level security;
alter table public.submission_items    enable row level security;
alter table public.tierlist_item_stats enable row level security;
alter table public.shares              enable row level security;

------------------------------------------------------------------------
-- 2. table privileges: reset then grant the minimum
------------------------------------------------------------------------
revoke all on public.profiles            from anon, authenticated;
revoke all on public.tierlists           from anon, authenticated;
revoke all on public.tierlist_items      from anon, authenticated;
revoke all on public.submissions         from anon, authenticated;
revoke all on public.submission_items    from anon, authenticated;
revoke all on public.tierlist_item_stats from anon, authenticated;
revoke all on public.shares             from anon, authenticated;

-- profiles: signed-in users may read only the safe columns; the owner may edit
-- a subset. Anonymous visitors get NO direct profile access -- the only public
-- sender information they need reaches them through controlled RPCs such as
-- get_share() (SECURITY DEFINER), never by reading this table.
grant select (id, username, display_name, avatar_url, created_at)
  on public.profiles to authenticated;
grant insert (id, username, display_name, avatar_url)
  on public.profiles to authenticated;
grant update (username, display_name, avatar_url)
  on public.profiles to authenticated;

-- tierlists / tierlist_items: read gated by RLS; writes are admin-only (RLS).
grant select                 on public.tierlists      to anon, authenticated;
grant insert, update, delete on public.tierlists      to authenticated;
grant select                 on public.tierlist_items to anon, authenticated;
grant insert, update, delete on public.tierlist_items to authenticated;

-- submissions / submission_items / stats: signed-in read only, gated by RLS.
-- All writes flow through submit_ranking(). No INSERT/UPDATE/DELETE to clients.
grant select on public.submissions         to authenticated;
grant select on public.submission_items    to authenticated;
grant select on public.tierlist_item_stats to authenticated;

-- shares: no direct table access at all -- create_share() / get_share() only.

------------------------------------------------------------------------
-- 3. policies
------------------------------------------------------------------------

-- profiles -----------------------------------------------------------
-- Signed-in users may read the safe columns of any profile (column grants
-- above restrict which columns; is_admin is never granted). Anonymous users
-- have no direct read path -- see get_share() for the public sender teaser.
create policy profiles_select_authenticated
  on public.profiles
  for select
  to authenticated
  using (true);

create policy profiles_insert_self
  on public.profiles
  for insert
  to authenticated
  with check (id = (select auth.uid()));

create policy profiles_update_self
  on public.profiles
  for update
  to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- tierlists --------------------------------------------------------
create policy tierlists_select_public_or_admin
  on public.tierlists
  for select
  to anon, authenticated
  using ((select private.is_admin()) or private.is_tierlist_public(id));

create policy tierlists_admin_insert
  on public.tierlists
  for insert
  to authenticated
  with check ((select private.is_admin()));

create policy tierlists_admin_update
  on public.tierlists
  for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy tierlists_admin_delete
  on public.tierlists
  for delete
  to authenticated
  using ((select private.is_admin()));

-- tierlist_items -------------------------------------------------
create policy tierlist_items_select_public_or_admin
  on public.tierlist_items
  for select
  to anon, authenticated
  using ((select private.is_admin()) or private.is_tierlist_public(tierlist_id));

create policy tierlist_items_admin_insert
  on public.tierlist_items
  for insert
  to authenticated
  with check ((select private.is_admin()));

create policy tierlist_items_admin_update
  on public.tierlist_items
  for update
  to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));

create policy tierlist_items_admin_delete
  on public.tierlist_items
  for delete
  to authenticated
  using ((select private.is_admin()));

-- submissions --------------------------------------------------
-- Read your own submissions (or any, as admin). No write policies: writes are
-- RPC-only, and updates are additionally blocked by the immutability trigger.
create policy submissions_select_own_or_admin
  on public.submissions
  for select
  to authenticated
  using (user_id = (select auth.uid()) or (select private.is_admin()));

-- submission_items -------------------------------------------
create policy submission_items_select_own_or_admin
  on public.submission_items
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.submissions s
      where s.id = submission_id
        and (s.user_id = (select auth.uid()) or (select private.is_admin()))
    )
  );

-- tierlist_item_stats  (community spoiler gate) -------------
-- A signed-in user may read a game's aggregates only after submitting their own
-- official ranking for that game. Guests read aggregates via get_results().
create policy stats_select_after_submit_or_admin
  on public.tierlist_item_stats
  for select
  to authenticated
  using ((select private.is_admin()) or private.has_submitted(tierlist_id));

-- shares: intentionally no policies -> no direct client access.

------------------------------------------------------------------------
-- 4. harden the pre-existing rls_auto_enable() event-trigger function
--    Advisors 0028/0029: it is a SECURITY DEFINER function in the exposed
--    `public` schema that anon/authenticated can invoke via /rest/v1/rpc.
--    It is only meant to run from the `ensure_rls` event trigger.
------------------------------------------------------------------------
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
