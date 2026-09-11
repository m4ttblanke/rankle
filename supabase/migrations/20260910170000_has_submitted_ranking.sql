-- Rankle -- Migration 5: has_submitted_ranking RPC (spoiler-safe submission-state check)
--
-- Depends on migrations 1-4 (submissions table, private helpers, RLS hardening).
--
-- Milestone 3 needs a way for the application to know, on a later request,
-- whether the current identity (registered user OR guest) has already submitted
-- an official ranking for a given game -- WITHOUT returning any spoiler-bearing
-- data. The existing tools cannot do this:
--   * private.has_submitted(uuid) is user-only (no guest awareness) and lives in
--     the `private` schema, so it is not reachable through PostgREST.
--   * get_results() / get_share() answer the question only as a side effect of
--     returning community aggregates / ranking contents, and raise 42501 for the
--     not-submitted case -- inferring state from them means fetching spoilers.
--
-- This function returns ONLY a boolean about the caller's own submission. It is
-- the same eligibility test get_results() already performs internally, with
-- every result field removed. It does not touch submit_ranking, any RLS policy,
-- or any table grant.
--
-- Forward note (Milestone 4): the results page will call this before deciding
-- whether to call get_results(), so the check lives in one place.

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
        ((select auth.uid()) is not null and s.user_id = (select auth.uid()))
        or ((select auth.uid()) is null and p_guest_id is not null and s.guest_id = p_guest_id)
      )
  );
$$;

-- Same exposure as submit_ranking / get_results: callable by both client roles,
-- never by the blanket `public` role.
revoke all on function public.has_submitted_ranking(uuid, uuid) from public;
grant execute on function public.has_submitted_ranking(uuid, uuid) to anon, authenticated;
