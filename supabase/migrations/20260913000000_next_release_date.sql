-- Rankle -- Milestone 9: countdown support
--
-- Depends on migrations 1-12 (core schema through the admin-scheduling
-- grant hardening). This is the ONLY schema/RPC change in Milestone 9 --
-- streaks and the archive are derived entirely from data already exposed by
-- existing RLS/grants (docs/SECURITY.md sec 23's "prefer narrow readers"
-- principle didn't even need a new reader for those two).
--
-- The one gap: `private.is_tierlist_public()` requires
-- `release_date <= today()`, so a future 'scheduled' game's release date is
-- deliberately invisible to a normal caller today -- there is no existing
-- way to answer "is anything scheduled next, and when" for the post-submit
-- return-cue countdown (docs/MANUAL.md sec 4/25).
--
-- get_next_release_date() exposes ONLY the bare date of the next future
-- scheduled release -- never title, slug, prompt, item data, or any other
-- fact about which game it is. Same "read the base table directly, ignore
-- RLS, SECURITY DEFINER" shape as `current_daily_game_id()`, so admin,
-- authenticated, and anon callers all resolve the identical answer.
create or replace function public.get_next_release_date()
returns date
language sql
stable
security definer
set search_path = ''
as $$
  select min(t.release_date)
  from public.tierlists t
  where t.status = 'scheduled'
    and t.release_date > private.today();
$$;

-- Intended for anon AND authenticated alike -- the countdown appears for
-- signed-out visitors too, same exposure as get_daily_game()/
-- has_submitted_ranking. Every role is still named explicitly in the revoke
-- (not just `revoke ... from public`), per the M7/M8 lesson that the remote
-- project's default ACL grants EXECUTE on new functions directly to `anon`
-- and `authenticated` (not through the PUBLIC pseudo-role), so a revoke that
-- only mentions `public` leaves that grant untouched
-- (20260912210000_harden_friend_rpc_grants.sql). The grant below ends up
-- identical to what the default ACL would produce on its own in this case,
-- but the revoke+grant pair is written explicitly rather than relying on
-- that default, exactly like get_daily_game() and submit_ranking().
revoke all on function public.get_next_release_date() from public, anon, authenticated;
grant execute on function public.get_next_release_date() to anon, authenticated;
