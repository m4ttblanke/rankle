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

- [ ] Choose final product name (working name: "Rankle")
- [ ] Finalize repository/package naming (package `name` set to `rankle`)
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

- [ ] Define share-record schema
- [ ] Add unguessable share tokens
- [ ] Build spoiler-safe share page
- [ ] Add Web Share API
- [ ] Add copy-link fallback
- [ ] Add spoiler-safe OpenGraph metadata

---

# Next

## Admin

- [ ] Add admin role model
- [ ] Document secure admin bootstrap
- [ ] Build `/admin`
- [ ] Create tier-list editor
- [ ] Add item reorder controls
- [ ] Add image upload
- [ ] Add preview
- [ ] Add scheduling
- [ ] Add release-date conflict protection
- [ ] Add admin calendar
- [ ] Add topic backlog
- [ ] Add duplicate-game action
- [ ] Add emergency disable/unpublish action

## Accounts

- [ ] Configure chosen Supabase Auth providers
- [ ] Build sign-in flow
- [ ] Add profile model
- [ ] Add unique usernames
- [ ] Add display names
- [ ] Add avatar support
- [ ] Add history page
- [ ] Add current streak
- [ ] Add longest streak
- [ ] Add total games played
- [ ] Add streak unit tests

## Friends

- [ ] Create friend-request model
- [ ] Create friendship model
- [ ] Prevent self/duplicate requests
- [ ] Build friend search
- [ ] Build request inbox
- [ ] Add accept/decline
- [ ] Add remove friend
- [ ] Add spoiler-safe friend activity count
- [ ] Add post-submission friend ranking comparison

## Product Analytics

- [ ] Choose analytics provider
- [ ] Track daily play starts
- [ ] Track successful submissions
- [ ] Track shares
- [ ] Track share visits
- [ ] Track share-to-play conversion
- [ ] Track account creation
- [ ] Avoid sending unnecessary PII

---

# Later

## Social

- [ ] Define compatibility score
- [ ] Add compatibility tests
- [ ] Add friend compatibility UI
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

- [ ] Build archive browse experience
- [ ] Allow historical play
- [ ] Keep historical play separate from current streak
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

- [ ] Configure production error monitoring
- [ ] Verify backup/restore process
- [ ] Add aggregate rebuild script
- [ ] Add automated critical-flow smoke tests
- [ ] Add usage/cost review procedure
- [ ] Document significant incident template

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

---

# Decisions Needed

Track unresolved product choices here until decided.

- [ ] Final product name
- [ ] Final production domain
- [ ] Canonical application timezone confirmation
- [ ] Guest submission persistence approach
- [ ] Initial authentication providers
- [ ] Whether archived games can be played by guests
- [ ] Exact consensus formula
- [ ] Exact controversy formula
- [ ] Exact compatibility formula
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
