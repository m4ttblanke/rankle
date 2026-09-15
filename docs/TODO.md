# TODO.md

This file tracks meaningful project work.

Use four sections:

- Now
- Next
- Later
- Ideas

Do not add every tiny implementation task.

A TODO should represent a feature, meaningful technical task, decision, or operational improvement worth remembering across sessions.

Mark completed tracked work instead of silently deleting history immediately.

Periodically clean up old completed items.

---

# Now

## Foundation

- [x] Choose final product name (working name: "Rankle")
- [x] Finalize repository/package naming (package `name` set to `rankle`)
- [x] Initialize Next.js + TypeScript project (Next 16, App Router, Turbopack)
- [x] Configure Tailwind CSS (v4, CSS-first `@theme`)
- [ ] Configure shadcn/ui (deferred until a primitive is needed)
- [ ] Configure Motion for React (deferred until interactive ranking)
- [ ] Configure dnd-kit (deferred until interactive ranking)
- [x] Configure Supabase project (`@supabase/ssr` browser + server clients, generated types, `lib/env.ts`)
- [x] Add `.env.example` (annotated public vs server-only)
- [x] Add initial Supabase migrations (applied pre-M1; filenames now match remote history)
- [x] Establish base error handling (`app/error.tsx`, `app/not-found.tsx`, `DailyGameError`, env validation)
- [x] Establish lint/typecheck/test commands (`lint`, `typecheck`, `test` (Vitest), `test:e2e` (Playwright))

## Design

- [x] Establish initial visual direction (tokens + type, light mode only)
- [x] Choose display font (Bricolage Grotesque)
- [x] Choose interface font (Hanken Grotesk)
- [x] Define base color tokens (OKLCH, `app/globals.css`)
- [x] Define S/A/B/C/F tier colors (provisional; AA-verified; review after first board — done)
- [x] Corrected default tier scale from S/A/B/C/D to S/A/B/C/F/N/A pre-M4 (N/A = "haven't tried," excluded from `tier_weight`/`sum_weight`/`total_submissions` in `submit_ranking` so it can never score as worse than F; `N/A` uses the NEUTRAL fallback in `tierStyle`, no dedicated tokens)
- [x] Define basic radius/surface system
- [x] Update `DESIGN.md` with approved decisions
- [x] Build first responsive daily-game layout (read-only tier board; verified 320–430px)

## Core Game

- [ ] Create tier-list data model (schema exists; app-side Zod shaping in `lib/game/schema.ts`)
- [ ] Create tier-list item data model (schema exists)
- [ ] Seed development games (local `supabase/seed.sql` only; remote intentionally empty)
- [x] Resolve today's game from canonical timezone (`lib/game/get-daily-game.ts`; TZ gate enforced by RLS)
- [x] Build tier board (Milestone 2: interactive `RankingBoard`, one `useReducer` in `lib/game/ranking.ts`)
- [x] Add drag-and-drop ranking (dnd-kit; whole card is the drag surface; `pointerWithin` collision)
- [x] Add non-drag ranking alternative (shared inline `MovePicker` — tap/click/keyboard; ▲/▼ reorder; same `MOVE` path)
- [x] Require all items before submission (UI-gated pre-M3; server-enforced by `submit_ranking` as of Milestone 3)
- [x] Implement official submission (Milestone 3: `submitRanking` Server Action -> `submit_ranking` RPC)
- [x] Enforce one registered-user submission per game (DB unique index, pre-existing; app now surfaces it as a locked state)
- [x] Make submitted rankings immutable (DB trigger + no client grants, pre-existing; app now unmounts ranking controls after success)

## Results

- [x] Add community result model (`lib/game/results-schema.ts` — no RPC/schema
  change; `get_results` already returned everything needed)
- [x] Add per-item tier distributions (`lib/game/results.ts` `itemDistribution`;
  N/A % uses game-wide `total_submissions`, never the item's own scored `n`)
- [x] Define aggregate ranking formula (`communityTierForAvg` — nearest scored
  tier to `avg_weight`, ties round to the higher tier)
- [x] Define consensus formula (`consensusControversy` — 1 − normalized
  variance of scored tier weights)
- [x] Define controversy formula (same function; normalized variance itself)
- [x] Define hottest-take formula (`hottestTake` — largest
  `|player weight − avg_weight|` clearing both a minimum-responses and a
  minimum-diff threshold; N/A ineligible; ties broken by `sortOrder`)
- [x] Add unit tests for result calculations (`lib/game/results.test.ts`,
  `lib/game/results-schema.test.ts`)
- [x] Build results reveal UI (`app/results/page.tsx`, `components/results/`)
- [x] Enforce server-side spoiler gate (unchanged `get_results` RPC remains the
  authority; `/results` also redirects at the app level as a UX convenience —
  see Milestone 4 entry below)

## Sharing

- [x] Define share-record schema (pre-existing since the initial migration
  set — `shares` / `create_share` / `get_share`, unchanged by Milestone 5)
- [x] Add unguessable share tokens (pre-existing; 32-char hex, `shares_token_len`)
- [x] Build spoiler-safe share page (`app/share/[token]/page.tsx`)
- [x] Add Web Share API (`components/share/share-button.tsx`)
- [x] Add copy-link fallback
- [x] Add spoiler-safe OpenGraph metadata (`generateMetadata`, teaser fields only)

---

# Next

## Admin

- [x] Add admin role model (Milestone 8 — reused `profiles.is_admin` + `private.is_admin()`, unchanged; added `public.is_admin_user()` wrapper)
- [x] Document secure admin bootstrap (Milestone 8 — unchanged procedure, `docs/DEPLOY.md` sec 16, now with a self-check via `is_admin_user()`)
- [x] Build `/admin` (Milestone 8)
- [x] Create tier-list editor (Milestone 8 — `/admin/tierlists/[id]`)
- [x] Add item reorder controls (Milestone 8 — ▲/▼, no drag)
- [ ] Add image upload (Milestone 8 explicitly deferred — `image_url` is a pasted `https://` URL only; no Storage bucket. See `docs/DEPLOY.md` sec 11.)
- [x] Add preview (Milestone 8 — reuses `RankableCard`/`tierStyle`, admin-authenticated, read-only)
- [x] Add scheduling (Milestone 8 — `schedule_tierlist`/`unschedule_tierlist` RPCs)
- [x] Add release-date conflict protection (Milestone 8 — reused the pre-existing `tierlists_release_date_key` unique index; no new constraint needed)
- [x] Add admin calendar (Milestone 8 — a chronological Today/Upcoming/Drafts/Past list on `/admin` itself, no separate calendar route/grid)
- [ ] Add topic backlog (out of scope for Milestone 8 — see CLAUDE.md's M8 scope note)
- [x] Add duplicate-game action (Milestone 8 — `duplicate_tierlist` RPC)
- [x] Add emergency disable/unpublish action (Milestone 8 — `unschedule_tierlist`, future-scheduled-only, returns to draft; no separate "disable" verb was added — see the Milestone 8 write-up under Completed for why)
- [ ] The Milestone 8 migration is now applied to the remote project (and M9's
  `next_release_date` migration as of 2026-09-13). Update
  `lib/game/get-daily-game.integration.test.ts` to also (or instead) call the
  `get_daily_game()` RPC — it still only smoke-tests the raw `tierlists` query
  the resolver used *before* M8.

## Accounts

- [ ] Reduce re-authentication friction after sign-out ("remember this
  device" or similar). Observed 2026-09-14: every sign-in currently requires
  a fresh magic-link email round-trip, including shortly after a recent
  sign-out, which is real friction against the "Return tomorrow" core loop.
  Needs a deliberate design pass, not a quick toggle — magic-link-only auth
  (no passwords) means any "remember me" mechanism is itself a form of
  session/trust extension and has to be reviewed against `docs/SECURITY.md`'s
  auth invariants before implementation. Options to evaluate: simply confirm
  Supabase's default refresh-token session length is long-lived and the
  friction is actually about explicit sign-out (which is supposed to fully
  end the session) vs. unexpected early expiry; a scoped "trusted device"
  cookie that shortens (not skips) re-verification within a short window;
  or extending session/refresh-token lifetime itself. Do not weaken the
  email-verification guarantee without deciding this deliberately.
- [x] Configure chosen Supabase Auth providers (email magic link only; local
  `supabase/config.toml` `[auth]` site_url/redirect URLs — production TBD
  until a domain exists, see `docs/DEPLOY.md` sec 9-10)
- [x] Build sign-in flow (`/login`, `/auth/callback`, `app/actions/sign-in.ts`,
  `app/actions/sign-out.ts`)
- [x] Add profile model (pre-existing `profiles` table/trigger, unchanged)
- [x] Add unique usernames (pre-existing DB constraint; `/profile` edit UI added)
- [x] Add display names (same)
- [ ] Add avatar support (deferred — initials placeholder only,
  `components/profile/avatar.tsx`; `avatar_url` stays unused)
- [x] Add history page (`/profile`, `/history/[submissionId]`)
- [x] Add current streak (Milestone 9 — `lib/game/streaks.ts`,
  `components/profile/streak-stats.tsx`; consecutive released Rankles played,
  not calendar days)
- [x] Add longest streak (Milestone 9 — same)
- [x] Add total games played (Milestone 9 — same `StreakStats` row)
- [x] Add streak unit tests (Milestone 9 — `lib/game/streaks.test.ts`,
  `lib/game/get-next-release.ts`'s countdown covered by
  `lib/game/countdown.test.ts`)

## Friends

- [x] Create friend-request model (Milestone 7 — pending-only, no status column)
- [x] Create friendship model (Milestone 7 — canonical unordered pair)
- [x] Prevent self/duplicate requests (Milestone 7)
- [x] Build friend search (Milestone 7 — `search_profiles`)
- [x] Build request inbox (Milestone 7 — `/friends`, `list_friend_requests`)
- [x] Add accept/decline (Milestone 7 — plus sender-side cancel)
- [x] Add remove friend (Milestone 7)
- [x] Add spoiler-safe friend activity count (Milestone 7 — `get_friend_played_status`)
- [x] Add post-submission friend ranking comparison (Milestone 7 — `/results` Friends section)

## Product Analytics

Separate from Vercel Web Analytics (Milestone 10 — basic anonymous
traffic/page-view analytics only, `docs/DEPLOY.md` sec 21). Product
analytics means Rankle-specific behavioral metrics, which need their own
provider decision (e.g. PostHog) and are explicitly not implemented yet:

- [ ] Choose product-analytics provider
- [ ] Daily players
- [ ] Ranking completion rate
- [ ] Submission rate
- [ ] Share creation
- [ ] Share → play conversion
- [ ] New vs. returning players
- [ ] Account conversion (guest → registered)
- [ ] Average completion time
- [ ] Avoid sending unnecessary PII (`docs/SECURITY.md` sec 23)

---

# Later

## Social

- [x] Define compatibility score (Milestone 7 — per-game weighted agreement,
  N/A excluded, never persisted; see `docs/MANUAL.md` sec 19)
- [x] Add compatibility tests (Milestone 7 — `lib/game/friend-compatibility.test.ts`)
- [x] Add friend compatibility UI (Milestone 7 — `/results` Friends section)
- [ ] Add cumulative multi-game head-to-head (`/friends/[username]`) — deferred
  from Milestone 7 to keep scope to "friend-specific results on today's
  /results plus friends management." Would need new aggregation across
  historical submissions; revisit only if there's real demand.
- [ ] Add simple reactions
- [ ] Add internal share-to-friends flow
- [ ] Add optional groups
- [ ] Add group aggregate rankings

## Contacts

- [ ] Decide whether phone-number discovery is worth implementing
- [ ] Design privacy-preserving contact discovery
- [ ] Add phone normalization
- [ ] Add phone verification
- [ ] Add enumeration protection
- [ ] Add invite rate limiting

## SMS

- [ ] Evaluate SMS provider only if needed
- [ ] Estimate actual cost before launch
- [ ] Add provider abstraction
- [ ] Add abuse controls
- [ ] Add usage monitoring
- [ ] Ensure SMS is not required for normal sharing

## Archive

- [x] Build archive browse experience (Milestone 9 — `/archive`,
  `getArchive()`, read-only, open to signed-out visitors)
- [ ] Allow historical play (deliberately out of scope for Milestone 9 — no
  submission path to an old game; see `ArchiveList`)
- [ ] Keep historical play separate from current streak (moot until the item
  above exists)
- [ ] Add friend completion indicators for archive games

## Moderation

- [ ] Add blocking if social features require it
- [ ] Add reporting if needed
- [ ] Add admin moderation tools if needed
- [ ] Add audit log if privileged actions justify it

## PWA / Retention

- [ ] Evaluate PWA after core loop is proven
- [ ] Evaluate push notifications
- [ ] Evaluate daily reminder opt-in

## Operations

- [x] **Production email — replace Supabase's built-in Auth sender with
  Resend custom SMTP (2026-09-14).** Rankle previously used Supabase Auth's
  default/built-in email sender for magic-link sign-in; during Milestone 10
  production testing this hit the built-in sender's project-wide rate limit
  (`error_code: over_email_send_rate_limit`) after a single test account's
  sign-in. Now configured: `auth.rankle.io` (dedicated subdomain of the
  newly-owned `rankle.io`) verified in Resend with DKIM/SPF/DMARC records in
  Vercel DNS; Supabase Authentication → Emails → SMTP Settings points to
  `smtp.resend.com`; sender identity is `Rankle <no-reply@auth.rankle.io>`;
  Supabase's email rate limit set to 20/hour (sized against Resend's 100/day
  free-tier cap, see `docs/DEPLOY.md` sec 23). Verified end to end in
  production for both a non-admin and the admin account: Resend shows
  Sent → Delivered, landed in the primary inbox (not spam), PKCE callback
  exchange succeeded, `/profile` and `/admin` worked correctly, and signed-
  out protected routes stayed protected. The Resend API key lives only in
  Supabase's Dashboard, never in this repo or Vercel's environment
  (`docs/SECURITY.md` sec 32). Full setup/troubleshooting procedure:
  `docs/DEPLOY.md` sec 23, `docs/OPS.md` sec 27.
- [x] **Migrate production app to `rankle.io` as the canonical domain.**
  Root cause found (2026-09-14): `rankle.io`/`www.rankle.io` were already
  correctly attached to the `rankle` Vercel project (both aliased to the
  same deployment as `rankle-theta.vercel.app`) — the reason navigation kept
  landing back on the old host was purely that Production's
  `NEXT_PUBLIC_APP_URL` (a build-time value) was still pinned to
  `https://rankle-theta.vercel.app`, so every absolute URL the app generated
  (auth redirect, share link) pointed there regardless of which hostname
  served the page. Not a Vercel account/project misassociation.

  Completed:
  - `next.config.ts`: host-matched `redirects()` sends
    `rankle-theta.vercel.app/*` to `https://rankle.io/*`, preserving path and
    query string (no Vercel dashboard-level redirect exists for a project's
    own auto-issued `*.vercel.app` alias, so this had to be framework-level;
    see `docs/DEPLOY.md` sec 25). Covered by `e2e/domain-redirect.spec.ts`.
  - `NEXT_PUBLIC_APP_URL` set to `https://rankle.io` for Production only;
    Preview deliberately left at `https://rankle-theta.vercel.app`
    unchanged (`docs/DEPLOY.md` sec 13) rather than redesigned as part of
    this migration.
  - Supabase Auth Site URL set to `https://rankle.io`; redirect allowlist is
    now `https://rankle.io/**`, `https://rankle-theta.vercel.app/**`,
    `http://localhost:3000/**` (applied manually via the Supabase Dashboard
    — confirmed no other entries existed beforehand and none were removed;
    `docs/DEPLOY.md` sec 10).
  - No OpenGraph/canonical metadata existed to update — `app/layout.tsx` has
    no `metadataBase` and no route sets its own OpenGraph metadata.
  - Deployed to production (commits `3d119d1`, `82c392b`) via push to
    `main` → Vercel's git integration.
  - **Incident, found and fixed during rollout:** the first deploy also
    added an app-level `www.rankle.io → rankle.io` rule in `next.config.ts`,
    not realizing Vercel already had a domain-level redirect going the
    *other* direction (`rankle.io → www.rankle.io`, a leftover from how the
    domain was originally added — invisible to `vercel domains inspect`,
    only surfaced via a direct `curl -I` against the live host). The two
    together produced a live infinite redirect loop, making both hosts
    unreachable for a few minutes. Fixed by removing the app-level `www`
    rule (commit `82c392b`) and correcting the Vercel-level redirect
    direction (dashboard) so `rankle.io` serves directly and `www.rankle.io`
    redirects to it, 308, single hop. Full detail and the general lesson
    (always `curl -I` a domain before adding a redirect for it) in
    `docs/OPS.md` sec 27.
  - Live-verified post-fix: `rankle.io` serves directly (200); `www.rankle.io`
    and `rankle-theta.vercel.app` each redirect to `rankle.io` in exactly one
    hop with path/query preserved; no loops; no 5xx.
  - Full local regression re-verified with no regressions: SQL/RLS 272/272,
    Vitest 438/438 (deterministic, `--no-file-parallelism`), Playwright
    91/91 (87 pre-existing + 4 new redirect tests; one pre-existing
    `accounts.spec.ts` test is flaky only under full-suite parallelism,
    unrelated to this change, passes in isolation).

  Post-deploy application verification, all passed:
  - Real magic-link sign-in on `rankle.io` with the existing admin account
    (Matt, @m4ttblanke): `/login` → email from `Rankle <no-reply@auth.rankle.io>`
    → PKCE callback → landed on `rankle.io/profile`, no `rankle-theta.vercel.app`
    or `localhost` anywhere in the flow. Supabase auth logs for the window:
    `/otp` 200, `/verify` 303, `/token` 200 — zero 4xx/5xx.
  - `/admin` (5 submissions, matches baseline) and `/friends` (1 friend,
    matches baseline) both worked signed in; sign-out worked; `/admin`
    correctly redirected to `/` once signed out again — no admin data
    exposed to a signed-out request.
  - Anonymous smoke test: `/`, `/archive`, `/login` all 200; `/profile`,
    `/friends`, `/admin`, `/results` all correctly gate signed-out visitors
    (soft-redirect, e.g. `/results` → `NEXT_REDIRECT;replace;/;307` with only
    loading-skeleton markup in the payload — no ranking/tier data).
  - DB row counts identical to the pre-migration baseline across all 10
    tables + `auth.users` (see top of this section) — no unexpected
    mutations from the migration or the live auth test.
  - Vercel request logs for the test window: no 4xx/5xx.
  - Old-share-link compatibility: not directly tested against a real
    production token (skipped by request rather than creating a new share);
    covered indirectly by `e2e/domain-redirect.spec.ts`'s fixture-token
    redirect-preservation tests and the general `rankle-theta.vercel.app`
    redirect verification above.

  Remaining (deliberately not part of this migration):
  - Decide later (not now) whether to remove the
    `rankle-theta.vercel.app/**` Supabase redirect-allowlist entry once the
    cutover has been stable (`docs/OPS.md` sec 27)
- [ ] Configure production error monitoring
- [ ] Verify backup/restore process
- [ ] Add aggregate rebuild script
- [ ] Add automated critical-flow smoke tests
- [ ] Add usage/cost review procedure
- [ ] Document significant incident template
- [ ] Fix pre-existing Vitest integration-test flakiness: several
  `*.integration.test.ts` files (submit-ranking, get-results, get-share,
  claim-guest-submissions, friends) all submit rankings to the same seeded
  local "live" game and run as separate parallel files/workers by default,
  so `total_submissions`/aggregate-count assertions can race against each
  other (surfaced during Milestone 8 while adding
  `lib/admin/admin-rpcs.integration.test.ts`; confirmed pre-existing and
  unrelated to M8's own changes — `npx vitest run --no-file-parallelism`
  passes 400/400 deterministically, the default parallel run does not).
  Fix by disabling file parallelism for `*.integration.test.ts` specifically
  in `vitest.config.mts`, or by giving each integration file its own
  dedicated fixture tierlist instead of sharing the seeded one.

## Security (deferred beyond the initial schema/RLS migration)

The initial migration set enforces the trust boundaries (spoiler gate, admin
authorization, submission immutability, server-side payload validation,
transactional aggregates, share-link authorization) at the database level. The
items below are follow-up hardening that depends on real traffic, later
features, or infrastructure not yet in place.

- [ ] Rate limiting / abuse protection for guest-facing RPCs, especially
  `submit_ranking` and `create_share` (also `get_results` / `get_share` scans).
  Guests are unauthenticated (`anon`), so the current defenses are only the
  per-guest unique index and Supabase platform limits. Add per-IP / per-guest
  throttling (edge middleware, a lightweight counter table, or a platform WAF
  rule) before or shortly after public launch. Keep it simple first
  (SECURITY.md sec 19).
- [ ] Revisit guest identity hardening beyond the initial signed httpOnly
  `guest_id` cookie if abuse (ballot stuffing, fake community volume) becomes a
  real problem. Options to weigh only if needed: proof-of-work, attestation,
  soft account nudge before results, server-side correlation heuristics. Avoid
  invasive fingerprinting (SECURITY.md sec 26).
- [ ] Revisit public profile discovery/access when friend discovery and public
  profile pages are implemented. Direct `SELECT` on `public.profiles` is
  currently authenticated-only and anonymous share visitors get sender info
  only through controlled RPCs (`get_share`). When usernames become searchable,
  expose the minimum via a dedicated search RPC / view rather than widening the
  table policy; keep enumeration surface as narrow as possible (SECURITY.md
  sec 6, sec 24).
- [ ] Review whether additional production security controls are needed before
  public launch, based on observed traffic and abuse patterns: CAPTCHA on
  sign-up / guest submit, bot filtering, anomaly alerts, tighter CORS/CSP,
  automated RLS regression tests in CI, periodic advisor review. Decide with
  data, not speculation (CLAUDE.md sec 6, SECURITY.md sec 30).

---

# Ideas

These are not commitments.

- [ ] Daily category themes
- [ ] Friend-group leaderboards
- [ ] "Most controversial friend"
- [ ] "Closest rankings"
- [ ] Weekly recap
- [ ] Personal ranking statistics
- [ ] Shareable compatibility cards
- [ ] Community trend history
- [ ] Limited special-event games
- [ ] User-submitted topic suggestions
- [ ] Curated seasonal themes
- [ ] Optional custom tier labels for special games
- [ ] **Rankle Sports** — a sports-focused extension of Rankle: the same
  core subjective ranking experience (Rank → Submit → Compare → Share,
  canonical S/A/B/C/F/N/A tiers), applied to sports-related daily topics
  instead of general ones. Example topics: NBA players, NFL quarterbacks,
  MLB teams, college football teams, NBA jerseys, stadiums, sports logos,
  championship teams, all-time players, current players by position,
  sports rivalries, coaches, sports moments, draft classes, uniforms,
  mascots. Not part of Milestone 10 or any current milestone — a future
  product/brand extension to evaluate after the core Rankle launch, with
  architecture deliberately left open for now. Questions to resolve before
  designing it:
  - Mode/category inside Rankle, vs. a distinct branded experience
  - Sports-specific daily topic scheduling
  - League/team/sport taxonomy
  - Seasonal and event-driven Rankles (playoffs, championships, drafts,
    etc.)
  - Sports-specific friend/community comparisons
  - Historical vs. current-player topics
  - Staying opinion/ranking-driven, not objective sports trivia
  - Image/logo/player-photo licensing and rights before using any official
    sports assets
  - Whether users can follow favorite sports/leagues for more relevant
    Rankles
  - A separate URL/route/subdomain/app identity, only if usage justifies it

---

# Decisions Needed

Track unresolved product choices here until decided.

- [ ] Final product name
- [x] Final production domain — `rankle.io` (registered via Vercel,
  2026-09-14). App migration itself is separate tracked work (Operations
  section above) — code/config changes are done, production deployment of
  them is still pending as of this writing.
- [x] Canonical application timezone confirmation — `America/Los_Angeles`
  (`private.app_tz()`; verified on both local and the remote project)
- [ ] Guest submission persistence approach
- [x] Initial authentication providers — email magic link only (Milestone 6)
- [ ] Whether archived games can be played by guests
- [ ] Exact consensus formula
- [ ] Exact controversy formula
- [x] Exact compatibility formula — per-game weighted agreement, N/A
  excluded, never persisted (Milestone 7, `docs/MANUAL.md` sec 19)
- [ ] Whether dark mode launches in MVP
- [ ] Whether item images are required or optional per game

---

# Completed

Move meaningful completed items here temporarily when useful.

Remove stale completed items during periodic cleanup once they no longer provide useful project history.

## Milestone 1 — app scaffold + read-only daily game (2026-09-08)

Next.js 16 scaffold; Tailwind v4 + OKLCH design tokens + Bricolage/Hanken fonts
(light mode only); `@supabase/ssr` client wiring + validated env; today's-game
resolver (RLS-enforced release gate, no app-side timezone); read-only tier board
at `/` with empty/error/not-found states; Vitest unit + read-only RLS
integration tests; Playwright e2e; lint/typecheck/build green.

Follow-ups it surfaced:

- [ ] Resolver query-semantics tests (ignores future `scheduled` / `draft` /
  `disabled`, picks the latest of several released games) — needs an isolated
  local/test Supabase env with fixtures. Currently only `mapDailyGame` (pure)
  and a read-only "no game -> null, no error" remote check are covered.
- [x] Standardize the public key var name on `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
  (was `NEXT_PUBLIC_SUPABASE_ANON_KEY`); value is the `sb_publishable_...` key.
- [ ] Add an app icon / favicon (browser requests `/favicon.ico`, currently 404).
- [x] `.nvmrc` set to `22.19.0` (satisfies the `undici` engine requirement).
  Dev machines still on 22.18.0 should install/switch to >= 22.19.
- [ ] `app/dev/preview` is a dev-only tier-board harness (404 in production).
  Revisit once an isolated test DB exists — it may be replaceable by real
  fixtures/seed in e2e.
- [ ] Consider caching the daily-game read (revalidate once per day) when
  traffic makes the per-request query worth avoiding.
- [ ] `shadcn` is still an unused devDependency (CLI only) — wire up shadcn/ui
  when the first primitive is needed, or drop it.

## Milestone 2 — interactive ranking (2026-09-08)

Static tier board → interactive `RankingBoard` (`app/page.tsx` + `app/dev/preview`).
One `useReducer` over `lib/game/ranking.ts` (`placement: Record<container, id[]>`
+ `selectedItemId`); one `moveItem` operation. Desktop drag via dnd-kit
(`@dnd-kit/core` + `/sortable` + `/utilities`), whole card as drag surface,
`pointerWithin`→`closestCorners` collision, `MouseSensor` distance 8 /
`TouchSensor` delay 200. Shared inline `MovePicker` for tap + keyboard, ▲/▼
reorder — all through the same `MOVE`. Live-region announcements, focus return,
completion state, no submit control, no persistence, no network. Old
`components/game/tier-board.tsx` (+ test) deleted. Visual polish pass: tier-wash
lanes, tier-badge monograms + accent bar on placed cards, dashed pool, HUD.
Vitest 64 pass, Playwright 21 pass, lint/typecheck/build green.

Follow-ups it surfaced:

- [ ] Draft persistence decision: docs don't require pre-submission persistence,
  so M2 keeps ranking in memory only (refresh resets). Revisit if playtesting
  shows accidental loss is a real pain — a `localStorage` draft keyed by game id
  would be the minimal fix; keep it off the server.
- [ ] Deeper drag e2e once an isolated test DB exists: multi-item reorder via
  drag, drag from a populated tier, drop precision at small widths. Current e2e
  covers pool→tier, tier→tier, and reorder via the ▲/▼ controls.
- [ ] `web-design-guidelines` audit noted the card drag surface is a
  `div[role="button"]` containing the ▲/▼ `<button>`s (nested interactives).
  This is the accepted dnd-kit whole-card pattern with full keyboard support
  (Enter/Space, focus ring, `aria-expanded`/`aria-haspopup`); revisit only if
  real SR testing shows a problem.
- [ ] Tier colours are still provisional (M1). Now that a populated board
  exists, do the deferred visual review — especially the amber B wash, which is
  the warmest/palest of the five.
- [ ] `RankingBoard` handles a 0-item game defensively ("No items to rank.")
  but that state shouldn't reach production; admin validation later.

## Milestone 3 — official submission (2026-09-10)

Real "Submit ranking" control with a lightweight inline confirm ("Lock it
in", no modal) atop the unchanged M2 `RankingState`/`useReducer`/`moveItem`.
`toSubmissionPayload` derives the RPC payload from the ranking state — no
second representation. Guest identity: a random UUID in a signed
(HMAC-SHA256), httpOnly `rankle_guest` cookie (`lib/game/guest.ts`), minted
only server-side. `submitRanking` Server Action (`app/actions/submit-ranking.ts`)
is the sole client-reachable write path — RLS client only, identity from the
cookie, `.strict()` Zod shape validation, `submit_ranking` remains the
authoritative/atomic write. New migration 5: `has_submitted_ranking(tierlist_id,
guest_id)` — a boolean-only, spoiler-safe RPC so a later visit (or a duplicate
submit) is recognised as a locked state without fetching results. Post-success
the board unmounts entirely in favor of a restrained "Ranking locked in" panel
— no results/community data (Milestone 4). Local Supabase (Docker) stands up
the isolated mutation/integration/E2E test environment; production received
only the migration, never test writes. 125 Vitest + 36 Playwright green,
lint/typecheck/build green.

Follow-ups it surfaced:

- [ ] `GUEST_COOKIE_SECRET` is validated lazily (first cookie read/write), not
  at startup like `lib/env.ts`'s public vars. A misconfigured deploy would 500
  on first page view rather than fail the build. `lib/env.ts` is scoped to
  `NEXT_PUBLIC_*` by design; adding server-secret validation there needs a
  small deliberate restructure — worth doing before the first real deploy that
  sets this var.
- [ ] The local Supabase migration set now replays from a clean database
  (portability guard on migration 4's `rls_auto_enable()` revoke). The M1/M2
  "deeper drag e2e once an isolated test DB exists" item above is now
  unblocked.
- [ ] `supabase/tests/rls_spec.sql` has 3 pre-existing assertions (rows testing
  `private.is_admin()` / `private.has_submitted()` EXECUTE grants, and
  `rls_auto_enable()`) that fail against a clean local stack: migration 1
  explicitly grants `authenticated` EXECUTE on those two `private.*` helpers,
  so the spec's stricter expectation only ever held on the remote project for
  reasons predating M3. Investigate and reconcile (tighten the grants, or
  correct the assertions) — out of scope for M3 since it does not touch any
  object those three assertions exercise.
- [ ] `RankingBoard` replaces the whole board with the locked panel rather than
  keeping a frozen view of the actual placements — simplest for M3 (also makes
  post-success mutation structurally impossible). Revisit if Milestone 4's
  reveal wants to grow out of an in-place frozen board instead of a fresh fetch.
- [x] `supabase/.branches` and `supabase/.temp` (Supabase CLI local-stack state;
  the latter holds only fixed, non-secret local Docker demo keys) were
  untracked but not gitignored before this milestone — added to `.gitignore`
  during the pre-commit secret scan.

## Milestone 4 — community results (2026-09-11)

No migration, no RPC change. Inspection found `get_results` (built in
Milestone 3) already returned every field this milestone needed — `tier_counts`
per item (generic, already includes `"N/A"`), `n`/`sum_weight`/`avg_weight`
(already opinion-only, per the pre-M4 tier-scale correction), and the game-wide
`total_submissions` (the correct "haven't tried %" denominator). All new work
is application-layer: `lib/game/results-schema.ts` (Zod boundary for the RPC's
`Json` return), `lib/game/results.ts` (pure calculations — `tierWeight`,
`communityTierForAvg`, `communityTierList`, `itemDistribution`,
`consensusControversy`, `hottestTake` — no Supabase import, no charting
dependency), `lib/game/get-results.ts` (server-only reader; any failure,
including the RPC's own `42501`, returns `null` rather than distinguishing
"ineligible" from "error"), `app/results/page.tsx` (new route; app-level
`hasSubmittedRanking` redirect as UX, `get_results`'s own gate as the actual
authority), and `components/results/*` (community tier list, your-ranking-vs-
community with inline distribution bars, hottest-take callout — reusing
`tierStyle` rather than a new palette).

Every N/A-exclusion rule is enforced by explicit identity checks
(`tier === "N/A"`), never by assuming N/A is the last `tier_config` entry.
Community-tier rounding ties go to the higher tier, verified at every exact
half-integer boundary. Thresholds (`MIN_RESPONSES_FOR_VERDICT = 3`,
`HOTTEST_TAKE_MIN_RESPONSES = 2`, `HOTTEST_TAKE_MIN_DIFF = 1`) are named
constants in `lib/game/results.ts`, not config/infrastructure.

Post-submit UX changed per Milestone 3's own forward note: `SubmittedPanel`
and the "locked in" panel are gone. `app/page.tsx` redirects server-side to
`/results` when the identity already submitted; `RankingBoard` calls
`router.replace("/results")` (not `push`) on a fresh success or a detected
duplicate, so the immutable pre-submit board can never become a back-button
destination.

134 Vitest (12 new: `results.test.ts`, `results-schema.test.ts`,
`get-results.integration.test.ts` against real local Supabase) + 10 new
Playwright specs (`results.spec.ts`) green, plus the full existing suite
(SQL/RLS 81/81, e2e, lint, typecheck, build) unaffected.

Follow-ups it surfaced:

- [ ] The community tier list and comparison rows show item labels as plain
  text, not the ranking board's card treatment (image thumbnail, monogram
  badge). Revisit once item imagery exists in seed/production content —
  today's demo items have no `image_url`, so this wasn't visually testable.
- [ ] Consensus/controversy labels are three static buckets ("Strong
  consensus" / "Mixed opinions" / "Controversial") on a fixed 0.25/0.6 split.
  Revisit thresholds once real usage data exists (same spirit as the M4
  product-threshold constants above).
- [ ] No caching/memoization on `/results` — every view recomputes
  `communityTierList`/`hottestTake` from the RPC response. Fine at current
  scale (see `docs/MANUAL.md` sec 32); revisit if per-item aggregate reads
  become a real cost.

## Milestone 5 — spoiler-safe sharing (2026-09-11)

The `shares` table + `create_share` / `get_share` RPCs already existed from
the initial (pre-M1) migration set, already spoiler-gated, already covered by
`supabase/tests/rls_spec.sql` (81/81, unchanged). This milestone was almost
entirely application layer: `app/share/[token]/page.tsx` (locked gate /
"wrapped up" / reveal, branching on `get_share`'s own `locked` flag and a
slug comparison against `getDailyGame()`), `components/share/*`,
`lib/game/get-share.ts`, `lib/game/share-schema.ts`,
`lib/game/share-comparison.ts` (literal same-tier count, not a weighted
compatibility score), and `app/actions/create-share.ts`.

One migration: `20260911190000_get_results_submission_id.sql` adds a single
additive `submission_id` field to `get_results`'s JSON output — the only way
the client can learn its own submission id to call `create_share` (guests
have no grant on `public.submissions`). Approved before implementation; SQL
tested locally (81/81 RLS spec, both `get_results` integration tests) before
being proposed for remote deployment.

Share continuation (`?share=<token>` on `/`, carried from a locked
`ShareGate`'s CTA so a fresh submission returns to the reveal instead of
`/results`) is validated in `app/page.tsx`, not a general `returnTo`
mechanism: shape-checked, then confirmed to correspond to *today's* live game
via a `getShare(token, null)` call that is structurally incapable of ever
returning ranking data (a null-guest, unauthenticated caller can never
satisfy `get_share`'s eligibility check). The actual game submitted is always
`getDailyGame()`'s result, independent of the token, so a foreign/old token
can only affect the post-submit destination, never what gets submitted.

Seed data (`supabase/seed.sql`, local/dev only) gained a fourth demo game —
an already-`archived` "Retro Snacks" tierlist with a pre-seeded submission
and a fixed share token (`deadbeefdeadbeefdeadbeefdeadbeef`) — so the
"already wrapped up" old-link state has real fixture data to test against
without needing admin tooling or Milestone 9's archive-gameplay feature.

216 Vitest (82 new: share-schema, share-comparison, create-share action, plus
a real-DB `get-share.integration.test.ts` mirroring the results one) + 60
Playwright (13 new `e2e/share.spec.ts`, covering creation, the locked gate,
continuation, duplicate-submit continuation, old/foreign-token handling, no
open redirect, native-share + copy-fallback + cancellation, and mobile
overflow) green, plus SQL/RLS 81/81, lint, typecheck, and a production build
(confirms `/share/[token]` renders dynamically, `ƒ`, same as `/results` — no
shared-cache leak path).

Follow-ups it surfaced:

- [ ] `ShareGate`/`ShareWrappedUp`/`InvalidShare` don't move focus to their
  own heading on the client-side `router.replace` landing (mirrors the
  `ResultsHeading` pattern from Milestone 4) — worth doing once real
  screen-reader testing flags it as a problem, same deferred call as M2's
  drag-surface note.
- [ ] The sender re-opening their own share link before anyone else has
  played sees their own ranking mirrored as "your ranking" (trivial 100%
  self-agreement) — harmless (their own data, nothing new disclosed) but not
  a polished experience. Revisit only if it turns out to confuse real users.
- [ ] No dynamic OG image — metadata is text-only (title/description).
  Acceptable per the M5 brief ("do NOT build a dynamic OG image rendering
  system just for M5"); revisit if link-preview engagement data suggests it's
  worth the cost.

## Milestone 6 — accounts & profiles (2026-09-12)

Supabase Auth, email magic link only (no passwords, no OAuth, no
Auth.js/NextAuth). `profiles` + `private.handle_new_user()` already existed
(pre-M1) and needed no changes — a new account is immediately usable, no
onboarding gate. New routes: `/login`, `/auth/callback` (Route Handler),
`/profile` (own profile only — editable username/display name, initials
placeholder avatar, history list), `/history/[submissionId]` (read-only,
ownership-checked). `middleware.ts` was written then renamed to `proxy.ts` +
`proxy()` mid-implementation — Next 16.3.4 deprecated the `middleware`
convention in favor of `proxy` (build warning caught it).

**Guest → account claiming** (the milestone's hardest problem, revised from
the original plan mid-review): a new `claimed_guest_submissions` link table
records that an authenticated user owns a specific guest-submitted row,
*without ever mutating the immutable `submissions`/`submission_items` rows*.
`private.has_submitted`, `has_submitted_ranking`, `get_results`,
`create_share`, and the `submissions`/`submission_items` RLS SELECT policies
were all extended to recognize a claimed submission as the user's own —
verified end to end (not just simulated) with a real Supabase Auth session
created via `auth.admin.createUser` + `generateLink` + `verifyOtp`
(`lib/game/claim-guest-submissions.integration.test.ts`). `submit_ranking`
gained an explicit duplicate-via-claim guard, since the unique index alone
can't catch a second *direct* submission for a game already represented by a
claimed row. Conflict rule: a direct (or already-claimed) submission for a
tierlist always wins; a colliding guest submission for that same tierlist is
simply never claimed, permanently.

`claim_guest_submissions(p_user_id, p_guest_id)` is deliberately **not** a
public RPC — no grant to `anon`/`authenticated` at all, reachable only via
the service-role client (`lib/supabase/service-role.ts`), called exactly once
(`app/auth/callback`), only after that handler independently verifies a real
session (`auth.getUser()`) and a signed guest cookie (`getGuestId()`) in the
same request. This was a deliberate, narrow, documented use of service-role —
the alternative (granting the RPC broadly) would let any authenticated caller
attempt to claim any guest's history merely by supplying its UUID through
PostgREST directly. See `docs/SECURITY.md` sec 26.

One migration:
`supabase/migrations/20260912000000_guest_account_claiming.sql` — the new
table/RPC plus the five modified functions/policies above. Approved and
applied following the same local-first, checkpoint-gated workflow as M5.

Public profiles of other users (`/profile/[username]`) were explicitly
**not** built — `profiles` has no anon read grant, and building one would
have meant inventing a privacy/product decision (whose history is visible to
whom) that belongs to a genuinely social milestone, not this one.

264 Vitest (48 new: sign-in/sign-out/update-profile actions, the auth
callback, `claimGuestSubmissions`, `getCurrentUser`/`getCurrentProfile`, a
real-auth-user integration file) + 68 Playwright (8 new
`e2e/accounts.spec.ts`, driving the *real* magic-link flow end to end via
local Mailpit — no auth step mocked) green, plus SQL/RLS 110/110 (29 new,
covering every identity-transition scenario including the direct-PostgREST
attack attempt), lint, typecheck, and a production build.

Follow-ups it surfaced:

- [ ] `notFound()` in `/history/[submissionId]` (and pre-existing `redirect()`
  calls in `/results`, etc.) return HTTP 200, not the semantically correct
  4xx/3xx status — a consequence of the root `app/loading.tsx` Suspense
  boundary already streaming the 200 before the async page component's
  `notFound()`/`redirect()` runs. Pre-existing app-wide Next.js behavior, not
  M6-specific; the rendered *content* is correct either way (no data leak),
  and the e2e suite asserts on content for exactly this reason. Revisit only
  if an exact status code is ever load-bearing for something (e.g. a crawler
  or monitoring check).
- [ ] `/login` and `/profile` don't move focus to their own heading after a
  client-side transition (same deferred class of issue as M4/M5's heading-
  focus notes).
- [ ] "Total games played" is currently just the history list's length,
  shown inline (`Your Rankles (N)`) — no separate profile stat card. Fine for
  now; revisit if `/profile` grows more stats later.
- [ ] `supabase/seed.sql`'s release dates are computed from `private.today()`
  at reset time, so a long-running local stack can drift out of sync with
  the real calendar day (hit during this milestone's own e2e runs — see
  `docs/DEPLOY.md`'s Local Supabase section for the symptom/fix). Not a
  product bug, just a local-dev-environment note now documented so it isn't
  re-discovered the hard way.

## Milestone 7 — friends (2026-09-12)

Two new tables (`friend_requests`, `friendships`) plus eight new RPCs,
delivered in one migration
(`supabase/migrations/20260912200000_friends.sql`). `friend_requests` has
**no status column** — a persisted row can only ever mean "pending"; accept
creates the `friendships` row and deletes the request in the same call,
decline/cancel just delete it, and no accepted/declined history is retained
(a deliberate simplification beyond the milestone brief's own illustrative
schema, approved before implementation). `friendships` is a single
canonically-ordered pair per relationship (`user_id_low < user_id_high`,
enforced by a `check` constraint) — symmetric by construction, never
directional rows. Every mutating RPC (`send_/accept_/decline_/cancel_friend_request`,
`remove_friend`) takes a `pg_advisory_xact_lock` on the sorted pair before
touching either table, closing the "A and B request each other at the same
moment" race deterministically: `send_friend_request` detects an existing
reverse-pending row and converts it straight into a friendship rather than
creating a second pending row in the other direction.

**Profile visibility was tightened, not just extended.** `profiles`' one
existing RLS policy let any authenticated user read every profile's safe
columns directly (`using (true)`) — true since Milestone 1, unused by any
code path, but the first thing Friends makes into a live full-enumeration
bypass of the new capped/prefix `search_profiles` RPC. Approved and replaced
with `profiles_select_self_or_friend` (self, an accepted friend, or admin)
as part of this milestone rather than left as a deferred item —
`docs/TODO.md`'s own "Security (deferred)" list had already flagged exactly
this gap. A pending request's counterpart is deliberately *not* covered by
that policy; `list_friend_requests()` is the one audited reader for that
relationship instead of a further-widened table policy.

`private.has_submitted_by(tierlist_id, user_id)` — a parameterized,
claim-aware sibling of the existing `private.has_submitted` — is the one
place "has this arbitrary user submitted this game, direct or claimed"
lives, shared by `get_friend_played_status` (boolean-only, safe
pre-submission) and `get_friend_results` (the actual comparison reader,
which additionally requires the CALLER to have submitted before returning
anything, and only ever iterates the caller's own `friendships` rows so a
non-friend can never appear). Compatibility
(`lib/game/friend-compatibility.ts`) reuses Milestone 5's `compareRankings`
rather than a second comparison implementation — it only adds the weighted
per-game agreement percentage (N/A excluded, `null` when there are zero
jointly-scored items) and a "biggest disagreement" pick on top of that
existing output.

New routes: `/friends` (search, incoming/outgoing requests, friends list with
per-friend played-today status and an inline-confirm remove — no modal,
matching the ranking board's own confirm pattern). `/results` gained a
Friends section (after "Your hottest take," before "Challenge a friend"),
visible only to signed-in callers (a guest gets no section at all, not an
empty one). `/` gained a single spoiler-safe "N friends played today" line
above the board for a signed-in player with friends.

328 Vitest (64 new: `friend-compatibility.test.ts` (10), `friends-schema.test.ts`
(12), six Server Action test files (39: send/accept/decline/cancel/remove/
search), and a real-two-user `friends.integration.test.ts` (3) — mirrors
`claim-guest-submissions.integration.test.ts`'s approach: genuine
`auth.admin.createUser` + `generateLink` + `verifyOtp` sessions, no email
mocked — covering search, the full request lifecycle, symmetric friendship
visibility/removal, and the full played-status/friend-results access matrix.
4 new Playwright specs (`e2e/friends.spec.ts`) drive two real signed-in
browser sessions through the entire loop: search → request → accept → both
submit → comparison appears on `/results` → unfriend hides it immediately —
plus confirms anonymous play, community results, and sharing are all
unaffected. `supabase/tests/rls_spec.sql` grew from 110 to 190 assertions,
all passing, including the corrected profile-visibility assertions (a
non-friend authenticated user now sees only their own row; admin still sees
every row) and the full friend-request race/ownership/idempotency matrix.
Full regression suite (72 Playwright, unchanged specs), lint, typecheck, and
a production build all green; `/friends` renders `ƒ` (server-rendered on
demand), same as every other account-sensitive route.

Follow-ups it surfaced:

- [ ] Cumulative multi-game head-to-head (`/friends/[username]`) explicitly
  deferred — see the Social section above.
- [ ] No rate limiting on `search_profiles` / friend-request creation yet
  (docs/SECURITY.md sec 19 already treats this as a "when needed" item, same
  as every other RPC in this project).
- [ ] `IncomingRequestRow`/`OutgoingRequestRow`/`FriendRow` don't move focus
  anywhere after an accept/decline/cancel/remove completes — same deferred
  class of heading/focus-management issue noted in M4-M6.

## Milestone 8 — admin & scheduling (2026-09-13, applied remotely 2026-09-13)

One migration
(`supabase/migrations/20260912220000_admin_scheduling.sql`) adds:
`private.current_daily_game_id()` (the single authoritative "what game is
current" resolver — caller-independent, used by both `public.get_daily_game()`
and a tightened `submit_ranking`), `public.get_daily_game()`,
`public.is_admin_user()`, two historical-lock triggers
(`tierlists`/`tierlist_items`, unconditional once any submission exists —
blocking UPDATE *and* DELETE, closing a pre-M8 gap where a submitted
tierlist could still be deleted and cascade its real submissions away), two
new lifecycle CHECK constraints (`draft` ⇒ `release_date IS NULL`;
`scheduled`/`live`/`archived` ⇒ `release_date IS NOT NULL`), and four admin
RPCs (`schedule_tierlist`, `unschedule_tierlist`, `duplicate_tierlist`,
`set_tierlist_items`).

**The core correctness fix:** pre-M8, `getDailyGame()` ran a raw `tierlists`
query trusting RLS to filter by release date — but the admin RLS policy
intentionally bypasses that filter for `is_admin()`, so an admin's own
homepage visit could (once real scheduling existed) resolve a *different*,
future game than every other visitor. Separately, `submit_ranking` only
checked "released, not archived," so a superseded game with an older release
date stayed submittable through the raw RPC forever, with nothing to age it
out (no cron by design). Both are fixed by the one new resolver:
`get_daily_game()` replaces the raw query in `lib/game/get-daily-game.ts`,
and `submit_ranking` now requires `p_tierlist_id is distinct from
current_daily_game_id()` to be false — i.e. the submission must target
*the* current game, not merely *a* released one. This deliberately preserves
the pre-M8 behavior that the most recently released game remains current
through any scheduling gap (never `release_date = today`). Verified with a
dynamic day-rollover fixture in `supabase/tests/rls_spec.sql` (insert day A,
prove it's current and submittable, insert day B, prove B is now current and
A no longer accepts a submission, prove admin/non-admin/anon all agree) and a
real end-to-end JS-client version in
`lib/admin/admin-rpcs.integration.test.ts`.

**Historical lock:** once a tierlist has any official submission, the two
triggers make every mutation on it and its items fail with
`restrict_violation` (23001) — including deletion, which previously cascaded
freely. `docs/SECURITY.md`/`docs/MANUAL.md` sec 4/27 have the exact rule.

**Admin surface:** `/admin` (Today/Upcoming/Drafts/Past, no calendar grid),
`/admin/tierlists/new`, `/admin/tierlists/[id]` (metadata form, ▲/▼ item
editor, schedule control, a preview reusing the real `RankableCard`/
`tierStyle` player components, duplicate, delete). `requireAdmin()` /
`isCurrentUserAdmin()` (`lib/admin/require-admin.ts`) gate every route and
Server Action via the new `is_admin_user()` RPC. Tier configuration is
hard-coded to the canonical S/A/B/C/F/N/A scale server-side for new games —
no custom tier-config UI. Image support stays a pasted `https://` URL, no
Storage bucket (tracked above).

**Grants tightened, not just added:** following the M6/M7 "remote default
ACL" lesson, every new function explicitly revokes from `public, anon,
authenticated` before granting only the intended role, written correctly the
first time rather than needing a follow-up hardening migration. `tierlists`'
client grants narrowed to column-level (`title`/`prompt`/`slug` only —
`status`/`release_date`/`tier_config` are RPC-only); `tierlist_items` lost
direct client table access entirely (item mutation is `set_tierlist_items`-
only now). A static catalog-level privilege check
(`information_schema.routine_privileges`/`role_table_grants`/
`column_privileges`) verifies this directly, mirroring the Milestone 7
friend-RPC privilege-catalog test's own rationale.

**Existing test semantics that had to change (not a regression, a
consequence of the tightened `submit_ranking`):** `supabase/tests/rls_spec.sql`'s
`na-game`/`teardown-game` fixtures are deliberately dated before `live-game`,
so several sections that used to call the real `submit_ranking` RPC against
them (N/A-exclusion tests, claim-mechanics setup) now use a new
`pg_temp.fixture_submit()` helper that performs the identical insert +
aggregate-update logic *without* the current-game gate — these were always
fixture setup for other features, not tests of submission eligibility itself,
and every downstream assertion's expected values are unchanged because the
helper mirrors `submit_ranking`'s math exactly. The "game teardown still
cascades (UPDATE-only trigger, not DELETE)" test was intentionally flipped to
assert the opposite — deletion is now blocked — since that was precisely the
gap Decision 3 closed.

261 SQL/RLS assertions (up from 190; all M1-M7 assertions unchanged in
expected outcome), 400 Vitest (72 new: `lib/admin/schema.test.ts`,
`lib/admin/require-admin.test.ts`, seven Server Action test files, a real-
admin-session `lib/admin/admin-rpcs.integration.test.ts`), 77 Playwright (5
new `e2e/admin.spec.ts`: non-admin/anon redirected, full create → items →
schedule → duplicate-date-rejected → unschedule → edit → reschedule
lifecycle, duplicate copies items into a fresh unscheduled draft, historical
lock reflected in the editor UI) — all green on a clean `supabase db reset`
replay. Lint, typecheck, and a production build are all clean;
`/admin`, `/admin/tierlists/new`, `/admin/tierlists/[id]` all render `ƒ`
(server-rendered on demand), same as every other account-sensitive route.

Applied to the remote Supabase project 2026-09-13, verified via the same
read-only checkpoint discipline used for every remote deployment in this
project (migration registration, function signature/grants, RLS/table/
function regression diff against a pre-deploy snapshot).

Follow-ups it surfaced (also tracked above, under Admin/Operations):

- [ ] Pre-existing Vitest integration-test flakiness across `lib/game/*.integration.test.ts`
  (shared seeded "live" game, parallel file workers) — confirmed unrelated to
  M8, tracked under Operations above.
- [ ] `lib/game/get-daily-game.integration.test.ts` still smoke-tests the
  pre-M8 raw query rather than the `get_daily_game()` RPC now that both are
  applied remotely — tracked under Admin above.
- [ ] No explicit "archive" admin action was built — a superseded game
  naturally stops being current the moment a newer one releases, and the
  historical lock already makes further editing impossible once it has
  submissions, so `archived`/`disabled` remain legacy/reserved schema values
  with no M8 UI verb. Revisit only if a real product need for manually
  marking/organizing very old content emerges.

## Milestone 9 — retention & polish (2026-09-13, applied remotely 2026-09-13)

One migration (`supabase/migrations/20260913000000_next_release_date.sql`)
adds exactly one function, `public.get_next_release_date()` — the bare date
of the next future `scheduled` release only (never title/slug/prompt/items),
`SECURITY DEFINER`, hardened `search_path`, explicit revoke-then-grant to
`anon`/`authenticated` (the M7/M8 remote-default-ACL lesson applied again).
Everything else this milestone built — the archive browse, streaks, and the
post-submit return cue — reads data already exposed by existing RLS/grants;
no other schema/RPC change was needed.

**Archive** (`/archive`, `lib/game/archive.ts`, `components/archive/
archive-list.tsx`): read-only browse of every publicly-released Rankle,
newest first, open to signed-out visitors. Visibility mirrors `private.
is_tierlist_public()`'s rule explicitly in application code (status in
`scheduled/live/archived` and `release_date <= today`) rather than trusting
the admin RLS bypass on `tierlists` alone, so an admin's own visit can't leak
a draft/future row. A guest gets no played/unplayed indicator at all
(`played: null`); a signed-in caller gets one batched `getMyHistory()` call
turned into a slug lookup map, never one query per row. No submission path to
an old game exists or is planned for this milestone — unplayed past Rankles
render as plain text, not a link.

**Streaks** (`lib/game/streaks.ts`, `get-streaks.ts`, `components/profile/
streak-stats.tsx`): "current," "longest," and "total played," computed fresh
from two already-owned reads (released dates + the caller's own submission
history) on every request — never a persisted counter, so there is nothing
that can drift out of sync with the submissions table. Counts consecutive
*released* Rankles played, not consecutive calendar days (a scheduling gap
never breaks it), and today's still-open game never counts against the
streak before the player has had a chance to submit it. Guests get no streak
at all (`null`) — no fingerprinting/localStorage identity workaround was
built to give one.

**Return cue / countdown** (`components/results/return-cue.tsx`,
`components/game/next-release-countdown.tsx`, `lib/game/countdown.ts`): the
last thing on the results reveal, after sharing. `computeCountdown` is a
pure function of `get_next_release_date()`'s result and the current instant,
so it's fully unit-tested without a fragile real-clock dependency; the
client component only ticks a clock toward an already-server-decided target
instant, hydration-safe by construction (`remaining` starts `null` on both
server and client).

**Brand** (`public/brand/rankle-mark.svg` + derived `rankle-icon.png`/
`rankle-apple-icon.png`, wired via `app/layout.tsx` metadata and the header):
the first formalized Rankle brand asset — three overlapping rounded cards,
red/pink-yellow/orange-blue, thin black outline. See `docs/DESIGN.md` sec 2
("Brand Mark") for the full record; sec 35's "Logo/wordmark" open decision is
now resolved.

**Per-route loading/error boundaries** (`app/*/loading.tsx`, `app/*/
error.tsx`, `components/layout/route-error.tsx`, `components/layout/
skeleton.tsx`): every account-sensitive and content route now has its own
`loading.tsx` skeleton and `error.tsx` boundary, extracted into two shared
components once the near-identical per-route versions made the duplication
obvious, rather than nine bespoke implementations.

270 SQL/RLS assertions (up from 261 — 9 new `get_next_release_date`
assertions; all M1-M8 assertions unchanged in expected outcome), 438 Vitest
(up from ~360; new coverage for archive/streaks/countdown/timezone/format-
date plus the extracted `route-error`/`focus-heading` components), 87
Playwright (up from 77; 10 new across `e2e/archive.spec.ts`,
`e2e/retention.spec.ts`, and one added to `e2e/friends.spec.ts` covering a
real session-loss failure on Remove — visible, non-sr-only error, friend
never falsely disappears) — all green on a clean `supabase db reset` replay.
Lint, typecheck, and a production build are all clean.

Follow-ups it surfaced (also tracked above, under Archive/PWA-Retention):

- [ ] Multi-day streak history (2+ consecutive Rankles) has no Playwright
  coverage — backdating submissions isn't reachable through the UI/seed, so
  this is covered at the unit level (`lib/game/streaks.test.ts`) only.
- [ ] "Allow historical play" and "friend completion indicators for archive
  games" remain open, deliberately deferred (tracked under Archive above).
