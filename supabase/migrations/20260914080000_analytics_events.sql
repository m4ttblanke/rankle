-- Rankle -- Product analytics: the event log table.
--
-- One small first-party table, not a third-party analytics vendor (see the
-- Product Analytics milestone writeup in docs/TODO.md for the evaluation).
-- Six event names only -- `daily_game_viewed`, `ranking_started`,
-- `ranking_completed`, `ranking_submitted`, `share_opened`,
-- `share_recipient_submitted`. Deliberately NOT included: `share_created`
-- (the existing `shares` table, one row per submission, is already a more
-- accurate source than an event could be) and `account_created` (`profiles`
-- / `claimed_guest_submissions` already answer guest->registered conversion
-- more accurately than an event could).
--
-- Lives in `public` (PostgREST-reachable schema) but, exactly like
-- `public.shares` / `public.friend_requests`, gets NO grant to `anon` or
-- `authenticated` at all -- RLS is defense in depth here; the absent grants
-- already deny both roles outright. The only writer is the service-role
-- client (`lib/analytics/log.ts`), called from trusted server-only code
-- (Server Actions / Server Components that have already resolved identity
-- the same way `submit_ranking`/`create_share` do) -- mirroring the
-- `claim_guest_submissions` precedent in docs/SECURITY.md sec 26: a
-- table/function with no anon/authenticated grant at all, reachable only via
-- a server-only trusted path.
--
-- Every identity column mirrors an identifier this project already stores
-- elsewhere (`submissions.user_id` / `submissions.guest_id`) -- nothing new
-- is minted for analytics. `share_id` is the internal `shares.id` uuid, NOT
-- the public unguessable share token -- the token itself never appears here.
-- There is no session/anonymous-id column: a first-time-ever anonymous
-- visitor (no guest cookie minted yet, since that only happens at first
-- submission -- docs/SECURITY.md sec 26) is intentionally not given any
-- substitute tracking identity. For that population, "unique" counts
-- collapse to raw event counts (each row has NULL identity and is its own
-- bucket) -- an honest, conservative reading, not a workaround. See the
-- Product Analytics writeup for the exact metric definitions this implies.
create table public.analytics_events (
  id          bigint generated always as identity primary key,
  event_name  text not null,
  occurred_at timestamptz not null default now(),
  tierlist_id uuid references public.tierlists (id) on delete set null,
  user_id     uuid references public.profiles (id) on delete set null,
  guest_id    uuid,
  share_id    uuid references public.shares (id) on delete set null,
  properties  jsonb not null default '{}'::jsonb,
  constraint analytics_events_event_name_check check (
    event_name in (
      'daily_game_viewed',
      'ranking_started',
      'ranking_completed',
      'ranking_submitted',
      'share_opened',
      'share_recipient_submitted'
    )
  )
);

create index analytics_events_name_time_idx
  on public.analytics_events (event_name, occurred_at);
create index analytics_events_tierlist_idx
  on public.analytics_events (tierlist_id)
  where tierlist_id is not null;

alter table public.analytics_events enable row level security;

-- Explicit even though a fresh table grants nothing to anon/authenticated by
-- default -- the same "write it explicitly, don't rely on the default"
-- discipline this project applies to every table/function grant, after the
-- M7/M8 lesson that the remote project's default ACL has surprised this
-- exact assumption before (20260912210000_harden_friend_rpc_grants.sql).
revoke all on public.analytics_events from anon, authenticated;
-- Intentionally no policies and no grants beyond the revoke above -- see the
-- table comment. Only the service-role client ever touches this table.
