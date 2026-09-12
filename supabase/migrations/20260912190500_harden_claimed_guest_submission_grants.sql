-- Rankle -- Milestone 6 correction: harden claimed_guest_submissions grants
--
-- 20260912000000_guest_account_claiming.sql created claimed_guest_submissions
-- and granted only `select ... to authenticated`, but never explicitly
-- revoked this Supabase project's default blanket table grants for new
-- tables first -- unlike every other table-creating migration in this
-- project (see rls_security_hardening.sql's own header comment: "revoke
-- Supabase's default blanket table grants for anon/authenticated, then
-- re-grant the minimum each role needs"). As a result, the remote table
-- ended up with anon/authenticated holding SELECT/INSERT/UPDATE/DELETE/
-- TRUNCATE/TRIGGER/REFERENCES -- far broader than the approved design.
--
-- Runtime impact was already contained: RLS is enabled and the table's only
-- policy is a SELECT policy scoped to `authenticated` (own rows or admin),
-- so anon could not actually read anything (no matching policy) and
-- authenticated could not actually write anything (no INSERT/UPDATE/DELETE
-- policy) -- but the grants themselves did not match the approved
-- least-privilege design, so this migration corrects them to match exactly.
--
-- Does not touch the already-applied 20260912000000 migration, any RLS
-- policy, any function, or any data -- table is brand new and empty.

revoke all on public.claimed_guest_submissions from anon, authenticated;
grant select on public.claimed_guest_submissions to authenticated;
