# MANUAL.md

This document describes the intended product behavior and high-level architecture.

Read this file when working on:

- Core game behavior
- Routes
- User flows
- Profiles
- Friends
- Results
- Sharing
- Archive
- Admin
- Product analytics
- Data-model decisions

Do not use this document as a substitute for `SECURITY.md` when changing permissions, RLS, auth, or private data.

---

## 1. Product Overview

The application is a daily social tier-list game.

Every official game presents:

- One topic
- A fixed set of items
- A tier configuration
- A release date

Players rank every required item, submit their ranking, then compare their opinions with the community and friends.

Core loop:

**Rank → Submit → Compare → Share → Return tomorrow**

The product is intentionally subjective. There is no objectively correct ranking.

---

## 2. Main Experience

A typical daily session is:

1. Open the site
2. See today's topic
3. Rank all items
4. Review ranking
5. Submit
6. Reveal community results
7. Compare with friends
8. Share result
9. Return tomorrow

Keep this loop short.

Avoid unnecessary account walls before the player understands the game.

---

## 3. Daily Game

A daily game should include:

- `id`
- `title`
- `slug`
- Optional prompt/description
- `release_date`
- `status`
- Tier configuration
- Items
- Optional item image
- Sort order
- Timestamps

Initial games will usually contain approximately 8–12 items.

Initial standard tiers:

- S
- A
- B
- C
- F
- N/A

S/A/B/C/F are opinion tiers. `N/A` means "I haven't tried or experienced this,
so I can't give it an appropriate ranking" — it is an intentional final
placement (counts as ranked, allows submission, is immutable once submitted),
but it is not an opinion and must never be scored as though it were a tier
below F. See sec 9 and sec 32 for how aggregates keep that distinction.

`N/A` is NOT the same as "Unranked": Unranked means the player has not decided
yet, does not count toward completion, and blocks submission.

The schema may support configurable tiers if doing so remains simple.

---

## 4. Release Behavior

Use an explicit canonical application timezone.

The currently active game is determined by:

- Release date
- Publication status

Do not require a cron job merely to switch from one daily game to the next.

Suggested statuses:

- `draft`
- `scheduled`
- `live`
- `archived`
- `disabled`

A scheduled game should become eligible automatically when its configured date becomes current in the canonical timezone.

**As built (Milestone 8):** `private.current_daily_game_id()` is the single
authoritative resolver — the `scheduled`/`live` tierlist with the greatest
`release_date <= private.today()`. It is caller-independent (SECURITY
DEFINER, reads the base table directly, ignores RLS) so admin, a non-admin
authenticated user, and an anonymous visitor always resolve the identical
game — this replaced a pre-M8 gap where an admin's own RLS bypass could
(once scheduling existed) make the homepage's raw query resolve a different,
future game than everyone else. `public.get_daily_game()` is the player-facing
reader built on it; `getDailyGame()` (`lib/game/get-daily-game.ts`) calls that
RPC rather than querying `tierlists` directly. `submit_ranking` requires the
submitted game to equal this same resolver's result — not merely "released
and not archived" — so a superseded game stops accepting new submissions the
moment a newer one is released, with no cron/status-transition needed. This
deliberately preserves the pre-M8 behavior that the most recently released
game remains current through any scheduling gap (never `release_date ===
today`) — see `docs/SECURITY.md` sec 4/13 and
`supabase/migrations/20260912220000_admin_scheduling.sql`.

`live` is accepted by the resolver for backward compatibility with the
existing status values, but M8's admin tooling never writes it — "is this
game live today" is a derived comparison against
`current_daily_game_id()`, not a persisted state. `archived`/`disabled`
remain supported by the schema but have no admin-exposed workflow in M8 (see
sec 27).

---

## 5. Ranking

Before submission, a player can:

- Drag items between tiers
- Reorder items within tiers
- Move items back to an unranked pool
- Use a non-drag ranking method
- Review the full tier list

All required items must be ranked before official submission.

Ranking interactions should primarily stay local until submission unless persistence is intentionally added.

---

## 6. Submission

An official submission:

- Belongs to one player identity or guest identity
- Belongs to one game
- Contains the final tier and position of each item
- Has a submission timestamp
- Is immutable after successful official submission

Registered users should have at most one official submission per game.

Draft data, if stored, is distinct from the official submission.

Drafts do not affect statistics.

**As built (Milestone 3):** once every item is ranked, a "Submit ranking"
control appears; a lightweight inline confirmation ("Lock it in") — not a
modal — makes the irreversible commitment explicit before the write happens.
Success is shown only after the database confirms it (never optimistically).
A failed attempt leaves the ranking exactly as the player left it. After a
successful submission, or on any later visit once the identity is recognised
as having already submitted, the board is replaced by a restrained "Ranking
locked in" state — no results yet (Milestone 4).

---

## 7. Spoiler Gate

Before official submission, users may see:

- Game topic
- Rankable items
- Their own draft ranking
- Non-spoiler friend activity such as a count of friends who played

They must not see:

- Community aggregate rankings
- Per-tier voting percentages
- Friends' actual rankings
- Hottest takes
- Most controversial items
- Result-derived OpenGraph content

After submission, result access becomes available.

See `SECURITY.md` for enforcement requirements.

---

## 8. Results

After submission, a result page may show:

- User's ranking
- Community aggregate ranking
- Per-item tier distribution
- Consensus score
- Controversy score
- Hottest take
- Most controversial item
- Friend rankings
- Friend comparisons

Results should feel like a reveal, not a spreadsheet.

The user should quickly understand:

- Where they agreed with everyone
- Where they strongly disagreed
- Which item divided people most

**As built (Milestone 4):** `/results` (`app/results/page.tsx`). No migration
or RPC change — `get_results` already returned everything needed. Section
order: community verdict -> your ranking vs. everyone else (with per-item
distribution + consensus/controversy inline) -> your hottest take. Friend
rankings/comparisons are not built (Friends is a later phase). A game-wide
"Early results" framing appears below `MIN_RESPONSES_FOR_VERDICT` total
submissions; per-item consensus/controversy fall back to "Not enough ratings
yet" the same way, independent of the game-wide framing.

---

## 9. Aggregate Ranking

A simple aggregate ranking can be computed from per-tier counts.

Example numeric tier weights (`private.tier_weight`, positional by
`tier_config` order):

- S = 6
- A = 5
- B = 4
- C = 3
- F = 2

`N/A` has no numeric weight and is excluded entirely from this aggregate: a
placement of `N/A` never contributes to `sum_weight` or the submission count
`avg_weight` divides by, so it can never pull the average toward, or below, F.
It is tracked separately (per-item `tier_counts["N/A"]`) so a future result can
report something like "18% haven't tried this" without touching the opinion
average. See sec 32.

The exact formula should be documented near its implementation.

Avoid presenting this score as objective truth.

The aggregate is a summary of player opinion.

**As built (Milestone 4):** an item's community tier (`communityTierForAvg`,
`lib/game/results.ts`) is whichever opinion tier's weight is nearest its
DB-sourced `avg_weight` — that value stays the one source of truth; nothing
recomputes it from `tier_counts`. An exact halfway average rounds to the
HIGHER tier (tested at every boundary). An item with zero scored responses
(`avg_weight === null`) is **Unrated**, never forced into F. All exclusion of
`N/A` is by identity (`tier === "N/A"`), not by assuming it is the last
`tier_config` entry — a hypothetical future scale with N/A elsewhere would
behave identically.

---

## 10. Consensus and Controversy

Keep formulas deterministic and explainable.

A consensus measure should increase when votes cluster tightly.

A controversy measure should increase when votes are dispersed or polarized.

Prefer formulas that can be described simply in product copy.

Do not add machine learning or opaque scoring for this.

Unit test these calculations.

**As built (Milestone 4):** `consensusControversy` (`lib/game/results.ts`) —
the variance of scored tier weights around `avg_weight`, normalized by the
maximum possible variance for the scale (a 50/50 split at the two weight
extremes). `controversy` rises with spread; `consensus = 1 − controversy`.
`N/A` responses never enter the sum, checked by identity. An item with zero
scored responses has no verdict at all (`null`, not zero — it is Unrated, not
"maximally consensual"). Below `MIN_RESPONSES_FOR_VERDICT = 3` scored
responses, the numbers are still computed (and unit-tested) but the UI shows
"Not enough ratings yet" instead of a confident label — raw distribution
counts stay visible regardless of that threshold.

---

## 11. Hottest Take

A "hottest take" is a placement where the player's choice differs strongly from the community.

A simple implementation can compare:

- Player's tier position
- Community average tier position

The item with the largest meaningful difference can be surfaced.

Use an explainable calculation.

**As built (Milestone 4):** `hottestTake` (`lib/game/results.ts`). Candidates
are the player's non-`"N/A"` placements on items with at least
`HOTTEST_TAKE_MIN_RESPONSES = 2` scored responses (so the comparison reflects
at least one opinion besides the player's own); `diff = |player weight −
avg_weight|` must clear `HOTTEST_TAKE_MIN_DIFF = 1` (a full tier) to count.
Highest `diff` wins; ties break by the item's `sortOrder`. No eligible
candidate yields a graceful "no hot take yet" state rather than a manufactured
one. When the player is the sole scored response on an item, `avg_weight`
equals their own weight exactly, so `diff` is `0` and it is excluded
automatically — no special-casing needed to avoid disagreeing with yourself.

---

## 12. Guest Play

Guest play should be supported if practical.

A guest should ideally be able to:

1. Play today's game
2. Submit
3. View community results
4. Share

Accounts unlock persistence and social features.

Avoid invasive fingerprinting.

Guest replay prevention can remain lightweight unless abuse becomes a real problem.

**As built (Milestone 3):** guest identity is a signed httpOnly cookie, minted
server-side on first submission (see `docs/SECURITY.md` sec 26). A guest who
already submitted today's game is recognised on a later visit via
`has_submitted_ranking` and sees the locked state directly, without re-ranking.
Clearing cookies starts over as a new guest — accepted per MANUAL sec 12's
"lightweight" guidance above.

---

## 13. Registered User Profile

A registered profile may include:

- Username
- Display name
- Avatar
- Optional short bio later
- Ranking history
- Current streak
- Longest streak
- Total games played
- Friend information

Private fields are not part of the public profile.

See `SECURITY.md`.

**As built (Milestone 6):** `profiles` already existed (pre-M1) with
`username`/`display_name`/`avatar_url`/`is_admin`/timestamps, and
`private.handle_new_user()` already auto-creates a row on `auth.users` insert
(auto-generated `user_<12 hex>` username, `display_name` from OAuth metadata
or `"Player"`). M6 built on this unchanged — no onboarding gate: a new
account is immediately usable, and `/profile` (`app/profile/page.tsx`) lets
the owner rename their username/display name anytime
(`app/actions/update-profile.ts`, a plain RLS-gated `UPDATE`, no RPC).
Avatar upload is deferred; `/profile` shows an initials placeholder
(`components/profile/avatar.tsx`), `avatar_url` stays unused.
**Only the owner's own `/profile` exists in M6** — a public
`/profile/[username]` for other users was explicitly deferred (no anon read
grant on `profiles` exists; see `SECURITY.md` sec 6a).

---

## 14. History

A user's history should make previous rankings easy to revisit.

Possible views:

- Calendar
- Grid
- List

Each entry may show:

- Game title
- Date
- Completion status
- Personal ranking preview
- Friend activity

Avoid turning the archive into a dense analytics dashboard.

---

## 15. Streaks

Support:

- Current streak
- Longest streak
- Total official games completed

Historical games do not extend the current streak.

Define behavior for:

- Missed days
- No game published that day
- First game
- Timezone boundary
- Late account creation

Use the canonical application timezone.

---

## 16. Friends

Use a mutual friend model.

Basic flow:

1. User searches or discovers another user
2. Sends request
3. Recipient accepts or declines
4. Accepted users become friends
5. Either user may remove the friendship

Prevent:

- Self requests
- Duplicate requests
- Duplicate friendships
- Invalid transitions

**As built (Milestone 7):** `friend_requests` has no status column — a row
existing means "pending," full stop. Accept creates the `friendships` row and
deletes the request in one operation; decline and cancel (sender-only
retraction, distinct from decline) just delete it. No accepted/declined
history is retained. `friendships` is a single canonically-ordered pair per
relationship (`user_id_low < user_id_high`), never directional rows — a
friendship is symmetric by construction, not by convention. A mutual
near-simultaneous request (A→B while B→A is already pending) resolves
deterministically into exactly one friendship via a
`pg_advisory_xact_lock`-serialized check inside `send_friend_request`, never
two pending rows. See `supabase/migrations/20260912200000_friends.sql` and
`docs/SECURITY.md` sec 6/24.

Discovery is `/friends`' search box, calling `search_profiles` (authenticated
only, username-prefix match, capped at 20, excludes the caller, returns only
`id/username/display_name/avatar_url` plus a computed relationship label). A
public `/profile/[username]` for arbitrary other users remains out of scope
(unchanged from Milestone 6) — a friend's identity is visible only through
this search RPC, `list_friend_requests` (pending-request counterpart), or a
direct `profiles` read once actually friends (see `docs/SECURITY.md` sec 6a).

---

## 17. Friend Activity

Before today's submission, a user may see non-spoiler activity such as:

> 5 friends played today

Do not reveal who ranked what.

After both users submit, comparison becomes available.

**As built (Milestone 7):** `get_friend_played_status(tierlist_id)` returns
only `{ user_id, played: boolean }` per friend — never ranking data, never
tier/position fields, so it's safe to call before the caller's own
submission. `/friends` shows it per-row ("Played today" / "Hasn't played
yet") for the current live game only; `/` shows a single spoiler-safe count
line ("N friends played today") above the ranking board for a signed-in
player with friends, using the same RPC. A signed-out visitor never triggers
this call.

---

## 18. Friend Comparison

Friend comparison may show:

- Side-by-side rankings
- Agreement percentage
- Largest disagreements
- Shared S-tier items
- Shared F-tier items

Keep this visually fun and concise.

Avoid turning it into a complex statistical report.

**As built (Milestone 7):** a "Friends" section on `/results` (after "Your
hottest take," before "Challenge a friend"), populated by
`get_friend_results(tierlist_id)` — requires the caller to have already
submitted, returns a ranking only for friends who have ALSO submitted (see
sec 19 below and `docs/SECURITY.md` sec 24 for the exact access rule). Each
row shows: a literal same-placement count ("Same placement on N of M" —
including a shared N/A, honestly labeled as a literal match, not an opinion
agreement, same convention as Milestone 5's share comparison), the weighted
agreement percentage (sec 19), and the single biggest jointly-scored
disagreement as a pair of tier chips. A signed-out guest never sees this
section at all (not an empty state — the section itself is omitted, since
friends are account-only). Zero qualifying friends renders "No friends have
played today's Rankle yet."

---

## 19. Compatibility

A future compatibility score may compare historical rankings between two friends.

Use a deterministic similarity metric.

The score should be easy to explain.

Do not build a recommendation engine or social graph algorithm prematurely.

**As built (Milestone 7) — per-game only, not persisted:** for every item
where BOTH sides gave a scored (non-`N/A`) opinion tier, `agreement = 1 -
|weightA - weightB| / maxDiff` (`maxDiff` = the opinion-tier weight range,
4 for the canonical S..F scale); the game's agreement is the average across
those jointly-scored items, rounded to a whole percent. `N/A` is excluded
entirely — never treated as agreement, never as a numeric opinion, and an
`N/A`/`N/A` pair on the same item is simply not counted (it still counts
toward the separate literal same-placement number, sec 18, but never toward
this percentage). Zero jointly-scored items → no percentage at all ("Not
enough shared ratings"), never a fabricated 0% or 100%. Computed on read from
the two immutable rankings (`lib/game/friend-compatibility.ts`, reusing
Milestone 5's `compareRankings` rather than a second comparison
implementation) — never persisted, and explicitly labeled "X% agreement
today" (a single game's number), never a permanent "compatibility score."
Cumulative multi-game head-to-head (`/friends/[username]`) was considered and
deferred — see `docs/TODO.md`.

---

## 20. Groups

The data model may later support friend groups such as:

- Roommates
- UCSB
- Family

Possible future features:

- Group membership
- Group aggregate tier list
- Group-only comparisons

Do not implement full groups before needed.

---

## 21. Sharing

Sharing is a primary growth mechanism.

Support:

- Unique share URLs
- Web Share API
- Copy-link fallback
- Spoiler-safe social metadata

Desired loop:

**Friend receives share → curiosity → plays → ranking is revealed → compares**

A recipient who has not played should see a prompt similar to:

> Matt ranked today's Fast Food Fries list. Play to reveal his ranking.

**As built (Milestone 5):** the `shares` / `create_share` / `get_share`
schema and RPCs already existed from the initial migration set (pre-M1) —
this milestone built the application layer on top of unchanged SQL, plus one
additive field. `/share/[token]` (`app/share/[token]/page.tsx`) branches on
`get_share`'s own `locked` flag: locked + the share's game is today's live
game → `ShareGate` (spoiler-free invitation); locked + the game has since
rotated away from being current → `ShareWrappedUp` ("this Rankle has already
wrapped up," with a clearly separate "Play today's Rankle instead" link —
there is no archive-gameplay route to send them into, so this never claims
they can still play the represented game; that gap is Milestone 9's, not
this one); unlocked → `ShareReveal`, the sender's ranking (from `get_share`)
side by side with the recipient's own (from `get_results`, fetched only
because eligibility is already confirmed). A malformed, unknown, or revoked
token all render one generic `InvalidShare` state — nothing distinguishes
them to the visitor.

Share creation (`ShareButton`, `components/share/share-button.tsx`) needs the
caller's own submission id, which the client had no way to learn (guests have
no grant on `public.submissions`) — `get_results` now additionally returns
`submission_id`, the caller's own, only after its existing eligibility gate
(`supabase/migrations/20260911190000_get_results_submission_id.sql`). The
`createShare` Server Action (`app/actions/create-share.ts`) treats that id as
untrusted client input and forwards it to the unchanged
`create_share(p_submission_id, p_guest_id)`, which independently
re-verifies ownership — the id is never an authorization mechanism on its
own. `create_share` was already idempotent (one share per submission), so a
repeated "Share" tap reuses the same token.

**Share continuation:** a locked `ShareGate`'s CTA links to `/?share=<token>`
rather than plain `/`. `app/page.tsx` validates that token's shape and calls
`getShare(token, null)` solely to learn which game the token represents
(compared against `getDailyGame()`'s slug) before carrying it into
`RankingBoard` — that result is never serialized, rendered, or otherwise
passed into the gameplay UI, and eligibility for the reveal remains
`get_share`'s own decision throughout (an ineligible identity still gets back
`locked: true` / `ranking: null`, same as anywhere else it's called).
Passing `null` rather than the visitor's real guest id also means that, with
no sign-in flow yet, this lookup happens to never come back unlocked either —
but that's a property of today's guest-only identity model, not a guarantee
this code relies on; it is expected to change once authenticated sessions
exist. A fresh success or a detected duplicate then `router.replace`s to
`/share/[token]` instead of the ordinary `/results`; without a validated
token, M4's plain `/results` behavior is unchanged. This is a narrow,
internally-constructed continuation, not a general `returnTo`/open-redirect
mechanism — no client input ever becomes the actual navigation target.

**Web Share / copy fallback:** `ShareButton` uses `navigator.share` when
available (spoiler-free message: *"I ranked today's {title}. Play yours to
reveal mine."*), else copies the link with an accessible "Link copied"
message — no toast dependency. Cancelling the native share sheet
(`AbortError`) is treated as a no-op, never an error.

**Comparison, not compatibility:** the reveal's "Same placement on N of M
items" is a literal same-tier count (`lib/game/share-comparison.ts`) —
deliberately not the weighted/persistent compatibility score sec 19
describes for later. A shared N/A placement counts as a literal match for
that count (both sides abstained) but is never implied to be an opinion
agreement, and N/A rows are kept out of the S..F-ordered comparison list
entirely, same neutral treatment as `/results` (sec 9, sec 32).

---

## 22. Internal Sharing

Later, users may send a ranking directly to selected friends in the app.

This should create:

- A share record
- A spoiler-safe notification or inbox item
- A reveal after recipient eligibility

Do not build full chat.

---

## 23. Phone Numbers

Phone numbers may later support:

- Contact discovery
- Invitations
- Friend matching

Phone number sharing should not be the main daily ranking mechanism.

Prefer native share sheets and links.

If SMS is added later, monitor cost and abuse carefully.

See `SECURITY.md` for privacy requirements.

---

## 24. Reactions

Simple reactions may be added after both users can see the ranking.

Examples:

- Agree
- No way
- Emoji reaction

Keep reactions lightweight.

Do not add comments or chat until there is a real product need.

---

## 25. Archive

Past daily games should remain discoverable.

Potential behavior:

- Anyone can browse prior topics
- Users can play missed games
- Archive completions do not extend current streak
- Users can revisit submitted results

Clearly distinguish today's official game from historical play.

---

## 26. Routes

Likely routes include:

```text
/
 /play
 /results
 /archive

 /game/[slug]
 /share/[token]

 /login
 /auth/callback
 /profile
 /profile/[username]
 /history/[submissionId]

 /friends
 /friends/requests

 /admin
 /admin/tierlists
 /admin/calendar
 /admin/backlog
 /admin/analytics
 /admin/users
 /admin/ops

 /privacy
 /terms
```

Only create routes when their features exist.

---

## 27. Admin

Admins manage official daily content.

Basic admin capabilities:

- Create game
- Edit draft
- Add/remove items
- Reorder items
- Upload item imagery
- Preview game
- Schedule release
- Publish
- Archive
- Duplicate
- Emergency disable

Admin UX should prioritize speed and clarity over visual theatrics.

**As built (Milestone 8):** `/admin` (dashboard), `/admin/tierlists/new`
(create), `/admin/tierlists/[id]` (editor) — no separate calendar route (sec
28). Authorization is `requireAdmin()` (`lib/admin/require-admin.ts`), which
calls `public.is_admin_user()`, a thin RPC wrapping `private.is_admin()` —
added because `profiles.is_admin` has no client SELECT grant at all, so the
app cannot otherwise learn "am I an admin" to gate the route. Every
mutation independently re-verifies admin authority server-side regardless
of this check (`docs/SECURITY.md` sec 4).

Capabilities: create a draft (title/prompt/slug; always the canonical
S/A/B/C/F/N/A scale — no tier-config UI), edit draft/scheduled metadata,
manage items (add/remove/rename/reorder via ▲/▼ — no drag, matching the
player board's own non-drag alternative), preview (reuses the real
`RankableCard`/`tierStyle` components, admin-authenticated, creates nothing),
schedule/reschedule/unschedule, duplicate (any source status, always lands as
a fresh draft with new ids, never copies release date/status/submissions/
stats/shares), and delete (zero-submission drafts only).

**Historical immutability:** once a tierlist has ANY official submission, the
database freezes it completely — title/prompt/slug/release_date/tier_config/
deletion on `tierlists`, and insert/update/delete on its `tierlist_items`, all
rejected unconditionally (`restrict_violation`, 23001) by two triggers
(`private.tg_block_tierlist_edit_if_submitted`,
`private.tg_block_item_edit_if_submitted`). The editor UI reflects this by
hiding the edit/schedule/delete controls rather than rendering forms that
would only ever fail; duplicate remains available regardless (it never
touches the source). No admin action can partially edit a locked game through
a UI gap — the trigger is unconditional at the database level.

**Image uploads deferred:** `image_url` is a plain optional `https://` URL
text field (server-validated), no Supabase Storage bucket, no upload UI. See
`docs/DEPLOY.md`.

---

## 28. Admin Calendar

The admin calendar should quickly answer:

- What is live?
- What is scheduled?
- Which dates are empty?
- Where are conflicts?
- Which games are still drafts?

Do not build a heavyweight editorial CMS.

**As built (Milestone 8):** no separate calendar route — `/admin` itself
shows Today / Upcoming / Drafts / Past as chronological lists (a compact list
reads better than a month grid at this scale, per sec 28's own guidance).
"Live today" is computed by comparing each row's id against
`get_daily_game()`'s own id, so this page can never disagree with what a
player actually sees. An empty "Upcoming" list is itself the gap signal —
nothing is scheduled next, so the current game keeps running with no cron.

---

## 29. Topic Backlog

Maintain a lightweight backlog of future ideas.

Potential fields:

- Topic/title
- Category
- Notes
- Status
- Created date

The backlog is not a project-management system.

---

## 30. Analytics

Useful analytics may include:

- Daily players
- Completion rate
- Shares
- Share visits
- Share-to-play conversion
- New accounts
- Returning users
- Friend requests
- Average completion time
- Popular archive games

Analytics should answer actual product questions.

Avoid unnecessary PII.

---

## 31. Data Model

The exact schema may evolve.

Expected concepts include:

```text
profiles
roles

tierlists
tierlist_items

submissions
submission_items
tierlist_item_stats

friend_requests
friendships

groups
group_members

shares
reactions

topic_backlog

admin_audit_log
```

Do not create tables before their features require them.

---

## 32. Aggregate Stats Storage

As usage grows, avoid recalculating every community result from all historical submission rows on each request.

A stats table may store counts by tier per item.

`N/A` counts are stored in that same per-tier structure but are excluded from
any numeric-average column (`tierlist_item_stats.sum_weight` /
`total_submissions`, see `public.submit_ranking`): an abstention must never
silently join the opinion average as though it were a real (and unusually low)
tier value.

Updates must be transaction-safe and idempotent.

Start simple, but preserve a reasonable path to efficient reads.

---

## 33. Seed Content

Useful development examples:

- Fast Food Fries
- Pixar Movies
- Breakfast Foods

Seed content must remain clearly demo/development data.

Application behavior must not depend on those specific records.

---

## 34. Product Phases

Suggested order:

### Foundation
- Project setup
- Supabase
- Base design
- Documentation

### Core Game
- Daily game
- Ranking
- Submission
- Results
- Sharing

### Admin
- Game creation
- Scheduling
- Preview
- Calendar

### Accounts
- Authentication
- Profiles
- History
- Streaks

### Social
- Friends
- Comparisons
- Compatibility
- Internal sharing

### Polish
- Landing page
- Motion
- Accessibility
- Performance
- Analytics
- Operations

Later:

- Groups
- Reactions
- Contacts
- SMS
- Push notifications
- Moderation
- Advanced stats

---

## 35. UX Principle

For every player-facing feature, ask:

- What does the user see first?
- What is the primary action?
- Is it obvious?
- What can be removed?
- What happens on mobile?
- What happens when loading fails?
- Is feedback immediate?
- Is anything revealing spoilers?
- Does this make the game more fun, social, or shareable?

The product should feel simpler than the system behind it.
