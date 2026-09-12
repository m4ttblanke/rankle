-- Rankle -- Milestone 7 correction: harden friend RPC EXECUTE grants
--
-- 20260912200000_friends.sql created nine authenticated-only RPCs, each with
-- `revoke all on function ... from public;` followed by
-- `grant execute on function ... to authenticated;` -- the same shape used
-- elsewhere in this project for RPCs that intentionally end up granted to
-- BOTH anon and authenticated (e.g. submit_ranking, get_results). For those,
-- omitting anon/authenticated from the revoke doesn't matter because the very
-- next statement grants to both anyway.
--
-- It does matter here. This remote project's public schema has a default
-- privilege (owned by `postgres`) that grants EXECUTE on every newly created
-- function DIRECTLY to anon, authenticated, and service_role -- confirmed via
-- pg_default_acl:
--
--   owner_role=postgres, schema=public, defaclobjtype=f,
--   defaclacl={postgres=X/postgres, anon=X/postgres, authenticated=X/postgres,
--              service_role=X/postgres}
--
-- `revoke all on function X from public` only strips the PUBLIC pseudo-role's
-- privileges -- it does nothing to a privilege granted directly to the named
-- role `anon` by this default-ACL mechanism. The result: all nine new
-- authenticated-only RPCs ended up with `anon` EXECUTE on the remote project
-- (verified via pg_proc.proacl), even though every one of them independently
-- checks `auth.uid() is null` and raises `insufficient_privilege` (42501)
-- internally -- so no data leaked and no unauthorized mutation was actually
-- reachable, but the grant itself didn't match the approved
-- authenticated-only design.
--
-- This exact class of platform default is already documented in this project
-- for TABLES (migration 4's `ensure_rls`/blanket-grant note) and was already
-- fixed once for a function-adjacent case in
-- 20260912190500_harden_claimed_guest_submission_grants.sql. The established
-- fix -- and the pattern `claim_guest_submissions` itself already uses --
-- is to name every role in the revoke explicitly rather than relying on the
-- PUBLIC pseudo-role to cover them: `revoke all on function ... from public,
-- anon;` before granting only to `authenticated`. `service_role` is left
-- untouched, matching every other RPC's own revoke/grant pair in this
-- project (service-role access is never revoked by any existing migration).
--
-- A clean local `supabase start` does not have this default ACL at all (there
-- is nothing to harden there), which is exactly why this was invisible to
-- `supabase/tests/rls_spec.sql`'s runtime-call assertions locally --
-- verified in-function auth.uid() checks already returned 42501 for anon on
-- a database that never granted anon EXECUTE in the first place. The privilege
-- regression test added alongside this migration asserts against pg_proc's
-- ACL directly (not just runtime behavior) so a future default-ACL surprise
-- like this one is caught by the test suite regardless of which environment
-- happens to reproduce the underlying platform default.
--
-- Does not touch: function bodies, signatures, SECURITY DEFINER status,
-- search_path, the two private.* helpers (already correct -- no
-- anon/authenticated grant at all), any M1-M6 object, or service_role's
-- existing access to any of these nine functions.

revoke all on function public.search_profiles(text) from public, anon;
grant execute on function public.search_profiles(text) to authenticated;

revoke all on function public.list_friend_requests() from public, anon;
grant execute on function public.list_friend_requests() to authenticated;

revoke all on function public.send_friend_request(uuid) from public, anon;
grant execute on function public.send_friend_request(uuid) to authenticated;

revoke all on function public.accept_friend_request(uuid) from public, anon;
grant execute on function public.accept_friend_request(uuid) to authenticated;

revoke all on function public.decline_friend_request(uuid) from public, anon;
grant execute on function public.decline_friend_request(uuid) to authenticated;

revoke all on function public.cancel_friend_request(uuid) from public, anon;
grant execute on function public.cancel_friend_request(uuid) to authenticated;

revoke all on function public.remove_friend(uuid) from public, anon;
grant execute on function public.remove_friend(uuid) to authenticated;

revoke all on function public.get_friend_played_status(uuid) from public, anon;
grant execute on function public.get_friend_played_status(uuid) to authenticated;

revoke all on function public.get_friend_results(uuid) from public, anon;
grant execute on function public.get_friend_results(uuid) to authenticated;
