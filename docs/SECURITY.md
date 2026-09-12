# SECURITY.md

This document defines security, privacy, authorization, and data-access expectations.

Read this file before changing:

- Authentication
- Authorization
- Supabase RLS
- Database permissions
- Admin behavior
- Private profile fields
- Phone numbers
- Sharing eligibility
- Spoiler gating
- Uploads
- Sensitive logging
- Account deletion

Security should remain simple, explicit, and server-enforced.

---

## 1. Core Security Principles

- Treat client input as untrusted
- Enforce authorization server-side
- Use database constraints for critical invariants
- Use RLS intentionally
- Keep secrets server-only
- Collect minimal personal data
- Avoid logging sensitive information
- Do not expose data merely because the UI hides it

---

## 2. Authentication vs Authorization

Authentication answers:

> Who is this user?

Authorization answers:

> Is this user allowed to do this?

Do not treat authentication alone as permission.

A signed-in user is not automatically allowed to:

- Access admin routes
- Read private profile fields
- Read another user's private data
- Modify another user's submission
- View spoiler-protected results

---

## 3. Roles

Initial roles:

- Guest
- User
- Admin

Potential future role:

- Moderator

Roles must come from trusted server/database state.

Never accept a role value from the client as authoritative.

Do not store admin authority only in client-readable metadata without server verification.

---

## 4. Admin Security

Admin operations must be server-enforced.

Examples:

- Create game
- Edit game
- Schedule game
- Publish/unpublish
- Upload official item imagery
- View privileged analytics
- Manage users

Do not rely on:

- Hidden admin navigation
- Client route guards
- Disabled buttons
- Query parameters

as security boundaries.

There must not be a public admin-registration path.

Document admin bootstrap in `DEPLOY.md`.

---

## 5. Supabase Service Role

The Supabase service-role key is server-only.

Never:

- Put it in `NEXT_PUBLIC_*`
- Import it into Client Components
- Return it from API routes
- Log it
- Commit it

Use it only where privileged server-side access is actually required.

Prefer normal user/RLS access whenever possible.

---

## 6. Row Level Security

Enable and maintain RLS on user-sensitive tables.

Policies should reflect actual product access.

Examples:

### Profiles

Users may update their own profile fields.

Public profile queries should expose only intentionally public fields.

Private fields such as phone numbers must not be publicly selectable.

### Submissions

Users may create their own submission according to game rules.

Users may not modify another user's submission.

Official submissions should not be editable after commitment.

**As built (Milestone 6):** the `submissions`/`submission_items` SELECT
policies also match a row linked via `claimed_guest_submissions` to the
caller, not just a direct `user_id` match — a claimed guest submission reads
exactly like the user's own (`/profile`, `/history/[id]`). `is_admin` remains
never selectable/writable by any client role, unchanged. `profiles` itself
still has zero `anon` grant — no public profile exposure was added; only the
owner's own `/profile` exists (a public `/profile/[username]` was explicitly
deferred to a later, deliberately social milestone — see `docs/MANUAL.md`
sec 13).

### Friend Requests

Users may create requests involving themselves.

Only involved users may read/act on the request.

### Friendships

Only participants should access private friendship details.

### Admin Content

Normal users must not create or modify official games.

---

## 7. Spoiler Protection

Spoiler protection is a security-like data-access rule, not a cosmetic UI rule.

Before a user becomes eligible to view results, do not return:

- Community distributions
- Aggregate rankings
- Friends' rankings
- Result-derived insights
- Share ranking contents

Eligibility should be checked server-side.

Do not fetch spoiler data early and hide it in CSS or React state.

**As built (Milestone 4):** two independent, server-side checks stand between
a visitor and any result data, in `app/results/page.tsx`:

1. `hasSubmittedRanking` (the same boolean-only `has_submitted_ranking` RPC
   Milestone 3 already uses) — a cheap, spoiler-free `redirect("/")`. This is
   UX, not authorization.
2. `getResults` -> the `get_results` RPC (unchanged since Milestone 3) — the
   actual authority. `SECURITY DEFINER`, raises `42501` until this identity
   has an official submission for this game. `getResults()` treats that error
   (or any other failure) identically: return `null`, so `/results` redirects
   without ever distinguishing "not eligible" from "transient failure" to the
   caller.

`app/page.tsx` also redirects to `/results` server-side when it detects an
already-submitted identity, so the ranking board never renders for someone who
cannot use it — but that redirect is the same UX convenience as (1), not a
security boundary; gate (2) alone is what a raw PostgREST call against
`get_results` would still have to pass. No result-derived data is put in page
metadata/OpenGraph on this route (sharing previews are Milestone 5). Tested for
both a guest identity and (at the RLS/SQL level, since the app has no sign-in
flow yet) an authenticated identity, including that one identity's submission
never unlocks another's (`supabase/tests/rls_spec.sql`,
`lib/game/get-results.integration.test.ts`, `e2e/results.spec.ts`).

---

## 8. Share Tokens

Share URLs should use unguessable tokens.

Do not expose sequential IDs as the only protection for private/spoiler-sensitive share content.

A share record may contain:

- Token
- Sender
- Game
- Created time
- Optional expiration/status
- Visibility rules

Server-side logic must determine what the recipient can see.

**As built (Milestone 5):** the schema/RPCs described above already existed
from the initial migration set (`supabase/migrations/20260909003915_sharing.sql`,
pre-M1) — `supabase/tests/rls_spec.sql` already exercised the eligibility
matrix (owner, correct guest, wrong guest, cross-identity, revoked) before
this milestone touched anything, and still does (81/81, unchanged). M5 is the
application layer on top of that: `getShare()` (`lib/game/get-share.ts`)
never distinguishes a malformed token, an unknown token, a revoked share, or
a transient failure to its caller — all four collapse to `null`, exactly like
`getResults()` already does for its own gate (sec 7).

`get_results` gained one additive field, `submission_id` — the caller's own,
returned only after the caller already passed that RPC's existing
eligibility gate (`supabase/migrations/20260911190000_get_results_submission_id.sql`).
This exists solely so the client can call `create_share`, which has no
grant to read `public.submissions` directly otherwise. `create_share`
independently re-verifies ownership of whatever id it's given — the
submission id is passed as untrusted client input through the `createShare`
Server Action (`app/actions/create-share.ts`), never treated as
self-authorizing.

**Share continuation caching:** `/share/[token]` (`app/share/[token]/page.tsx`)
legitimately renders different content for different visitors at the same
URL — locked teaser, "wrapped up," or the full reveal — decided by
`getGuestId()` reading `cookies()`, one of Next's Dynamic APIs. That opts the
whole route out of the Full Route Cache / static rendering automatically
(confirmed in the production build output — the route lists as `ƒ`
server-rendered on demand, same as `/results`), so there is no shared/public
cache path where one visitor's unlocked response could reach another.
`generateMetadata` on the same route reads only `get_share`'s teaser fields
(sender name, title, prompt) and never touches `locked`/`ranking` — the
social preview stays spoiler-free regardless of who (or what crawler)
requests it.

**Old/foreign share tokens:** the `/?share=<token>` continuation param
(carried from a locked `ShareGate` into gameplay so a fresh submission lands
back on the reveal) is validated in `app/page.tsx` before it can affect
anything — shape-checked, then confirmed to correspond to *today's* live
game via `getShare(token, null)`. This call exists ONLY to answer "what game
does this token represent" (compared against `getDailyGame()`'s slug) — its
result is never serialized into a prop, rendered, or otherwise passed into
`RankingBoard` or any other gameplay UI. Eligibility remains `get_share`'s
own job throughout: for an identity this call doesn't unlock, it returns
`locked: true` / `ranking: null`, exactly as it would for any other
ineligible caller — this lookup is not, and must not become, a second
eligibility decision made in application code. (Passing `null` rather than
the visitor's real guest id also happens to mean that, under the current
guest-only identity model with no sign-in flow yet, this particular call can
never come back unlocked either — but that is a property of today's identity
model, not something this code path relies on or that stays true once
authenticated sessions exist; `get_share` recognizing a matching `auth.uid()`
independently of `p_guest_id` is expected future behavior, not a bug.) A
token that fails either check is dropped before it ever reaches
`RankingBoard`; the game actually submitted is always `getDailyGame()`'s
result, never anything derived from the token, so a foreign/old token cannot
alter what gets submitted, only (when valid) where a successful submission
lands afterward.

---

## 9. IDOR Prevention

Do not assume that knowing an object ID grants access.

For any route or mutation using an ID:

1. Authenticate if necessary
2. Load the record
3. Verify the requesting user is allowed to access/modify it
4. Perform the operation

Examples:

- Profile edit
- Friend request
- Submission read
- Share reveal
- Admin mutation

---

## 10. Submission Integrity

Enforce one official registered-user submission per game using a unique database constraint.

Do not rely on:

- Disabled submit buttons
- Client state
- Request timing

Submission and aggregate updates should be atomic where practical.

Retrying a request must not double-count community statistics.

**As built (Milestone 3):** the only client-reachable write path is the
`submitRanking` Server Action (`app/actions/submit-ranking.ts`), which reads
identity from the trusted guest cookie (never the request body), shape-validates
the payload, and calls `submit_ranking` under the RLS (publishable-key) client —
never the service-role key. A duplicate/retry that hits the database's unique
index is reported to the UI as an "already submitted" locked state, not an
error the player must resolve.

---

## 11. Input Validation

Validate untrusted input at server boundaries.

Use Zod or the existing validation layer.

Validate:

- IDs
- Slugs
- Usernames
- Display names
- Search input
- Game configuration
- Tier values
- Ranking payloads
- Share tokens
- Upload metadata

Reject unexpected fields where appropriate.

Do not attempt to sanitize arbitrary malformed structures after deep processing.

---

## 12. Ranking Payload Validation

At submission, verify server-side:

- Game exists
- Game is playable
- User has not already submitted
- Every required item appears exactly once
- No unknown item IDs are present
- Every tier is valid
- Positions are valid
- Item belongs to that game

Never trust the client-generated ranking structure blindly.

---

## 13. Release Authorization

Do not allow users to submit to:

- Draft games
- Disabled games
- Future games unless archive/test rules explicitly allow it

Use the canonical application timezone for release checks.

Admins may need preview behavior through separate authorized paths.

---

## 14. Phone Numbers

Phone numbers are private data.

Requirements:

- Do not expose in public profiles
- Do not log full numbers unnecessarily
- Normalize before comparison
- Verify before using for trusted contact discovery if the feature launches
- Rate-limit lookup/invite behavior
- Prevent enumeration

Avoid endpoints that reveal whether arbitrary phone numbers belong to accounts.

Contact discovery should be privacy-preserving.

---

## 15. Email Addresses

Treat email addresses as private account data unless the user intentionally shares them.

Do not expose email addresses on public profiles by default.

Avoid analytics events containing raw email addresses.

---

## 16. Authentication Providers

Potential providers:

- Email
- Google
- Apple

Only enable providers actually used.

OAuth callback URLs must be explicitly configured.

Never store OAuth provider secrets in browser code.

**As built (Milestone 6):** email magic link only (Supabase Auth OTP) — no
passwords, no OAuth providers, so there are no provider secrets to manage at
all. `app/actions/sign-in.ts` calls `auth.signInWithOtp()` with
`emailRedirectTo` always built server-side from `NEXT_PUBLIC_APP_URL` (never
a client-supplied value); `app/auth/callback/route.ts` exchanges the code for
a session and redirects to a fixed destination (`/profile` on success,
`/login?error=1` on failure) — never a query-string-supplied target, so there
is no open-redirect surface in the callback. See `docs/DEPLOY.md` sec 9-10
for the exact local/production redirect URL configuration this requires.

See `DEPLOY.md` for environment setup.

---

## 17. Session Handling

Use the official Supabase/Next.js authentication approach used by the repository.

Do not implement custom session tokens unless required.

Protect privileged server actions with fresh server-side auth checks.

Do not trust stale client session state for authorization.

---

## 18. CSRF and Mutations

Use framework/provider protections appropriately.

State-changing requests should not be exposed as unsafe unauthenticated GET behavior.

For sensitive mutations:

- Require authorization
- Validate input
- Use appropriate origin/CSRF protections provided by the stack

---

## 19. Rate Limiting

Rate-limit abuse-prone endpoints when needed.

Candidates:

- Auth attempts
- Username search
- Friend requests
- Share creation
- SMS invitations
- Phone lookup
- Uploads
- Expensive result endpoints

Do not add complex rate-limit infrastructure before there is an actual need.

Use a simple platform-appropriate solution first.

---

## 20. File Uploads

Validate:

- MIME type
- File size
- Ownership
- Destination
- Allowed content type

Do not trust extensions alone.

Use generated storage paths rather than raw user filenames where helpful.

Avoid making sensitive storage buckets public.

Official game imagery may be public if intentionally designed that way.

---

## 21. Logging

Never log:

- Passwords
- OAuth tokens
- Refresh tokens
- Auth cookies
- Service-role keys
- API secrets
- Full phone numbers unnecessarily
- Entire private profile payloads

Prefer IDs and redacted context.

Logs should be useful without becoming a privacy liability.

---

## 22. Error Responses

Do not expose:

- Stack traces
- SQL errors
- Secret values
- Internal file paths
- RLS policy details

Return useful but non-sensitive user-facing messages.

Send technical detail to secure server logs/monitoring.

---

## 23. Analytics Privacy

Do not send unnecessary PII to analytics.

Prefer:

- Internal user ID or anonymous ID
- Game ID
- Event type
- Non-sensitive interaction properties

Avoid:

- Raw email
- Raw phone number
- Auth tokens
- Full ranking payloads unless truly necessary

---

## 24. Friend Privacy

Friend data should be visible only as required by the product.

Before both users submit a game:

- Do not reveal actual rankings

Public profile visibility does not imply all friend activity is public.

---

## 25. Blocking and Abuse

Blocking/moderation may be added later.

If social abuse becomes a real issue, prioritize:

- Blocking
- Reporting
- Rate limits
- Admin moderation tools

Do not build a large moderation system before social features require it.

---

## 26. Guest Security

Guest play should not require invasive fingerprinting.

**As built (Milestone 3):** a guest is a random v4 UUID (`crypto.randomUUID()`)
carried in a signed, httpOnly cookie (`rankle_guest`; `lib/game/guest.ts`):

- httpOnly — browser JavaScript can neither read nor forge it; never sent to
  the client, never logged, never placed in an RSC payload.
- HMAC-SHA256 signed with the server-only `GUEST_COOKIE_SECRET`, verified with
  a constant-time comparison; a value that fails to verify is treated as no
  cookie at all.
- `SameSite=Lax`, `Secure` in production, `Path=/`, ~400-day `Max-Age`.
- Minted only server-side (a Server Action), never accepted as a value the
  client supplies — the submission Server Action reads it from the cookie and
  ignores any identity-shaped field in the request body (`.strict()` Zod
  schema in `lib/game/submission.ts`).

Treat this as anti-repeat convenience, not strong identity proof: the database
unique index on `(tierlist_id, guest_id)` is the actual enforcement, and a
guest who clears cookies can always start over as a new identity. Do not claim
a guest is uniquely identified across devices unless that is actually true.

Submission-state recognition for a guest (has this identity already submitted
today's game?) uses `public.has_submitted_ranking(tierlist_id, guest_id)` — a
`SECURITY DEFINER` RPC that returns only a boolean, never community or ranking
data, so it is safe to call before the spoiler gate opens (sec 7).

**As built (Milestone 6) — guest → account claiming:** signing in claims a
guest's past submissions into the new account without ever mutating the
original (immutable) `submissions` row. `claimed_guest_submissions`
(`supabase/migrations/20260912000000_guest_account_claiming.sql`) links a
submission id to the claiming `user_id`; `private.has_submitted`,
`has_submitted_ranking`, `get_results`, and `create_share` were all extended
to recognize a claimed submission as the user's own (and the RLS SELECT
policies on `submissions`/`submission_items` widened the same way, so
`/profile` and `/history/[id]`'s plain table reads work). `submit_ranking`
gained an explicit pre-check so a claimed submission also blocks a *second*,
direct submission for the same game — the unique index alone can't catch
that case, since a claimed row never gets `user_id` set.

Conflict rule: if the authenticated user already has a *direct* submission
(or an earlier claim) for a tierlist, a guest submission for that same
tierlist is never claimed — it stays guest-owned, permanently. The direct/
already-claimed submission always wins; nothing is merged, copied, or
deleted, and claiming never touches `tierlist_item_stats` (the aggregate
table) at all.

**`claim_guest_submissions(p_user_id, p_guest_id)` is deliberately NOT a
public RPC** — no `EXECUTE` grant to `anon` or `authenticated` at all, unlike
every other RPC in this project. The reason: its real authorization question
— "does the caller actually possess the signed httpOnly guest cookie for
`p_guest_id`?" — is an HMAC check against `GUEST_COOKIE_SECRET`, a secret
Postgres does not have and RLS cannot express. A raw guest UUID is not proof
of anything to the database on its own (unlike an M5 share token, which is
*designed* to be handed to someone else — a guest id is never intentionally
exposed, but "the app never shows it to anyone" is not a database-level
security boundary). Granting this function to `authenticated` would let any
signed-in caller attempt to claim any guest's history merely by supplying its
UUID through PostgREST directly, with nothing to stop them.

Instead, the function is reachable only by whoever holds the service-role
key. `lib/supabase/service-role.ts` creates that client, and
`lib/game/claim-guest-submissions.ts` is its only call site, invoked once —
from `app/auth/callback`'s Route Handler — after that handler has
independently verified, in the same request: (a) a real Supabase Auth session
via `auth.getUser()` (JWT-verified, not a raw cookie read), and (b) a validly
HMAC-signed guest cookie via the existing `getGuestId()` (returns `null` if
missing or tampered). No client UI or API in this codebase accepts a
user-entered guest UUID anywhere. Verified directly in
`supabase/tests/rls_spec.sql`: calling
`/rest/v1/rpc/claim_guest_submissions` as `anon` or `authenticated` — with
any `p_guest_id`, including a real one belonging to someone else — fails
with `42501` before the function body ever runs.

Idempotent by construction: repeated claim calls for the same
`(user_id, guest_id)` pair claim nothing new and create no duplicate rows
(the `not exists (already claimed)` check, plus the table's own primary key).
Safe to call on every sign-in.

---

## 27. Account Deletion

When account deletion is implemented, document:

- Which personal data is deleted
- Which content is anonymized
- Whether aggregate stats remain
- Retention delay if any
- External service cleanup

Update `PRIVACY.md`.

Deletion behavior must match actual implementation.

---

## 28. Data Retention

Do not retain sensitive data indefinitely without purpose.

Potential policies should be documented in `PRIVACY.md` once implemented.

Do not invent retention promises that the system cannot currently enforce.

---

## 29. Database Constraints

Use constraints for security-relevant integrity when reasonable.

Examples:

- Unique username
- One submission per user/game
- One official game per release date
- Valid status values
- Valid relationship combinations

Database enforcement should complement application logic.

---

## 30. Security Review Triggers

Perform a security-focused review when changing:

- Auth
- RLS
- Admin permissions
- Share eligibility
- Submission logic
- Phone/contact discovery
- Uploads
- Service-role usage
- Account deletion
- New third-party integrations

ECC security/database review may be useful for these changes.

---

## 31. Dependency Security

Before adding a meaningful dependency:

- Check maintenance status
- Check license
- Check security history where relevant
- Avoid unnecessary packages
- Prefer established libraries already in the stack

Keep dependencies updated intentionally, not blindly.

---

## 32. Secrets

Secrets belong in environment variables or approved secret stores.

Never commit:

- `.env.local`
- Production credentials
- Supabase service-role keys
- OAuth client secrets
- SMS API secrets
- Monitoring auth tokens

Maintain `.env.example` with names only.

---

## 33. Security Principle

Security should be enforced where the data and action actually live.

If a rule matters, do not rely on the UI to enforce it.
