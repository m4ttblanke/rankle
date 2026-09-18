# OPS.md

This document describes practical production operations.

Read this file when working on:

- Monitoring
- Logging
- Crash reporting
- Incident response
- Production debugging
- Backups
- Rollbacks
- Service health
- Cost monitoring
- Dependency/security maintenance

Keep operations proportional to the size of the project.

---

## 1. Operations Philosophy

This is a small passion project.

Operations should be:

- Simple
- Observable
- Cheap
- Documented
- Recoverable

Do not build enterprise incident-management systems.

Do make it possible to answer:

- Is the app working?
- What failed?
- Who is affected?
- Did we lose or corrupt data?
- Can we roll back?
- Is a third-party service failing?
- Are costs unexpectedly increasing?

---

## 2. Monitoring

Recommended layers:

### Application Errors

Use Sentry or an equivalent provider if configured.

Capture:

- Unhandled exceptions
- Server action/route failures
- Important client crashes

### Platform Health

Use Vercel status/logs for:

- Deployment failures
- Function errors
- Runtime behavior

**As built (Milestone 10):** Vercel Web Analytics is enabled (basic
traffic/page-view analytics, `docs/DEPLOY.md` sec 21) — use the Vercel
dashboard's Analytics tab for visitor/page-view trends. This is not error
monitoring and does not replace Vercel's function/runtime logs above.

### Database

Use Supabase tooling for:

- Query failures
- Database health
- Auth issues
- Storage issues

Do not add multiple overlapping monitoring vendors without a reason.

---

## 3. Logging

Logs should be structured enough to answer operational questions.

Useful context:

- Request/operation type
- Internal user ID where appropriate
- Game ID
- Share ID
- Error category
- Correlation/request ID if available

Do not log sensitive values.

Never log:

- Passwords
- OAuth tokens
- Refresh tokens
- Cookies
- Service-role keys
- API secrets
- Full phone numbers unnecessarily

---

## 4. Error Severity

A simple severity model is enough.

### Info

Expected operational events.

### Warning

Unexpected condition with fallback or limited impact.

### Error

Feature failure affecting users.

### Critical

Security issue, widespread outage, serious data corruption, or inability to operate core functionality.

Do not overclassify routine validation failures as incidents.

---

## 5. Core Health Checks

Important production capabilities:

- Homepage loads
- Today's game resolves
- Game data loads
- Submission succeeds
- Results remain spoiler-gated
- Authentication works
- Admin authorization works
- Database is reachable
- Storage assets load

Automate only where useful.

A small manual smoke test after risky deploys is acceptable.

---

## 6. Incident Workflow

For a meaningful incident:

1. Detect
2. Scope
3. Mitigate
4. Roll back if appropriate
5. Verify recovery
6. Document cause
7. Prevent recurrence where reasonable

Focus on restoring safe service first.

---

## 7. Incident Notes

For significant incidents record:

- Date/time
- Impact
- Detection
- Root cause
- Mitigation
- Recovery
- Follow-up action

A Markdown note is sufficient.

Do not build an incident database unless necessary.

---

## 8. Production Debugging

When investigating:

1. Reproduce if possible
2. Check recent deploys
3. Check application errors
4. Check database/auth/storage health
5. Identify whether impact is isolated or widespread
6. Avoid destructive changes while uncertain

Prefer evidence over guessing.

---

## 9. Rollback

Application rollback:

- Use a known-good Vercel deployment when appropriate

Database problems:

- Prefer forward-fix migrations
- Restore/rollback only with a clear understanding of data impact

Application rollback does not automatically revert schema.

See `DEPLOY.md`.

---

## 10. Database Backups

Once real user data matters, verify Supabase backup behavior for the active plan.

Document:

- Backup availability
- Restore process
- Export procedure
- Recovery expectations

For critical manual operations, consider taking an export first.

---

## 11. Data Corruption

If submission or aggregate corruption is suspected:

1. Stop the faulty write path if necessary
2. Preserve existing data
3. Identify affected records
4. Determine whether aggregate data can be recomputed
5. Repair with a documented script/migration
6. Verify integrity
7. Add a regression test

Do not delete evidence before understanding the failure.

---

## 12. Aggregate Rebuild

Community aggregate statistics should ideally be reconstructable from official submission data.

If aggregate counters become inconsistent:

- Treat submissions as the source of truth
- Recompute aggregates through a controlled script
- Verify totals

Do not make irreversible aggregate state the only record of votes.

---

## 13. Spoiler Incident

If protected result data becomes visible before submission:

Treat it as a high-priority product/security issue.

Steps:

1. Disable the leaking path
2. Identify affected routes/data
3. Check server responses and caches
4. Fix eligibility enforcement
5. Purge relevant caches if needed
6. Add regression tests

Do not treat this as merely a CSS bug.

---

## 14. Auth Incident

If auth provider or session behavior fails:

Check:

- Supabase status
- OAuth provider status
- Redirect URLs
- Environment variables
- Recent auth-related changes

Avoid repeatedly changing production OAuth configuration without recording what changed.

---

## 15. Admin Incident

If a normal user gains unauthorized admin capability:

Treat as critical.

Actions:

1. Disable vulnerable path
2. Review role source
3. Review RLS/policies
4. Inspect affected admin actions
5. Rotate secrets if exposure is possible
6. Correct authorization
7. Add regression tests

---

## 16. Third-Party Service Failure

The core game should degrade gracefully when nonessential services fail.

Examples:

### Analytics down
Game should continue.

**As built (Product Analytics milestone):** verified directly —
`lib/analytics/log.ts` swallows every failure mode (a rejected insert, a
thrown error constructing the service-role client, `after()` itself
throwing) after a server-only log line, and never throws or rejects to its
caller. Gameplay, submission, and sharing do not await or depend on it
succeeding (`lib/analytics/log.test.ts`,
`app/actions/submit-ranking.test.ts`).

### Monitoring down
Game should continue.

### Email down
Email-dependent actions may fail clearly; core play should continue.
Production magic-link email runs through Resend custom SMTP (`docs/DEPLOY.md`
sec 23) — check Resend's dashboard (Emails/Logs, and Domains for the
`auth.rankle.io` verification status) and Supabase Authentication Logs first;
see sec 27's "Investigating a failed magic-link email" procedure.

### SMS down
Invitation feature may fail; core sharing should continue.

Avoid hard coupling core play to optional services.

---

## 17. Cost Monitoring

Review usage periodically.

Watch:

- Vercel
- Supabase database
- Supabase storage
- Analytics
- Monitoring
- Email
- SMS if added

Investigate sudden increases.

SMS deserves special attention because usage can become expensive quickly.

---

## 18. Performance Monitoring

Do not optimize blindly.

Useful indicators:

- Page load
- Interaction responsiveness
- Slow database queries
- Submission latency
- Result latency
- Large client bundles

Use actual measurements to guide work.

---

## 19. Database Performance

As usage grows, inspect:

- Missing indexes
- N+1 behavior
- Large unbounded queries
- Expensive result aggregation
- Slow friend comparisons

Do not introduce Redis or another cache until the database/application actually needs it.

---

## 20. Dependency Maintenance

Periodically:

- Review outdated dependencies
- Apply important security updates
- Remove unused dependencies
- Check breaking changes before major upgrades

Do not upgrade everything continuously without a reason.

Prefer deliberate batches.

---

## 21. Secret Rotation

If a secret may be exposed:

1. Rotate it immediately
2. Update deployment environment
3. Redeploy if needed
4. Invalidate old credential
5. Review logs/repository history
6. Assess impact

Never assume deleting a committed secret makes it safe.

---

## 22. Production Data Access

Use production data access carefully.

Avoid ad hoc destructive commands.

For manual fixes:

- Query first
- Scope affected rows
- Back up if warranted
- Use transactions where practical
- Record the change

Prefer migrations/scripts over undocumented manual edits.

---

## 23. User Support

If users report a bug, useful information includes:

- Game/date
- Device/browser
- Signed-in or guest
- Approximate time
- Action attempted
- Error shown

Do not request secrets or passwords.

---

## 24. Browser Compatibility

Focus on current mainstream browsers.

If a feature relies on:

- Web Share API
- Advanced drag behavior
- New CSS

provide reasonable fallback behavior.

Do not add broad legacy-browser complexity without demand.

---

## 25. Mobile Incidents

Because mobile is a primary experience, treat severe mobile usability regressions seriously.

Smoke-test:

- Narrow viewport
- Touch ranking
- Submit flow
- Result reveal
- Share flow

after major interaction changes.

---

## 26. Release Verification

After high-risk changes verify the exact affected behavior.

Examples:

### Submission change
Play → submit → refresh → verify immutable result → verify aggregate count once.

### Auth change
Sign in → refresh → protected route → sign out.

### Admin change
Admin succeeds → normal user denied.

### Spoiler change
Unsubmitted user cannot access result payload.

---

## 27. Practical Procedures (Milestone 10)

Concrete commands for the checks referenced conceptually above. No new
tooling — just the actual Vercel CLI / Supabase CLI / Dashboard steps.

### Checking Vercel deployment health/logs

```bash
vercel ls rankle                     # recent deployments + state
vercel inspect <deployment-url>      # build/runtime detail for one deployment
vercel logs <deployment-url>         # runtime function logs (tail with -f)
```

Dashboard equivalent: the project's **Deployments** tab (build logs) and
**Logs** tab (runtime/function logs, filterable by status code and path).

### Checking Supabase health/logs

Dashboard → the project → **Logs**: separate explorers for API (PostgREST),
Postgres, Auth (GoTrue), and Storage. Filter by time range and status code.

For a specific failing RPC, search the Postgres log explorer for its name
(e.g. `submit_ranking`) — every RPC in this codebase that catches an error
logs `[<context>] ... code=<pg-error-code>` server-side first (sec 3), so the
Vercel function log and the Supabase Postgres log for the same failure should
show up within the same few seconds and can be cross-referenced by time.

### Investigating a failed submission

1. Ask the reporter for game/date, guest-vs-signed-in, and approximate time
   (sec 23).
2. Vercel logs around that time for `[submit-ranking]` (see
   `app/actions/submit-ranking.ts`) — the logged Postgres error code narrows
   it immediately: `23001` (release_authorization/locked) is expected/normal
   product behavior, not a bug; anything else warrants a closer look.
3. Confirm aggregate integrity: `total_submissions` on
   `tierlist_item_stats` for that game should equal `count(*)` on
   `submissions` for that `tierlist_id` — a mismatch is the sec 12 aggregate-
   rebuild scenario, not a submission bug.
4. Never re-run a user's submission manually — `submit_ranking` is one-shot
   by design (sec 10); if it failed, the player still can (and should) retry
   through the UI.

### Investigating an auth problem

1. Supabase Dashboard → **Authentication → Logs** for the affected email/time.
2. Supabase Dashboard → **Authentication → URL Configuration** — confirm
   Site URL and Redirect URLs match the actual production domain exactly
   (`DEPLOY.md` sec 10). A magic link redirecting to the wrong host is almost
   always this, not application code.
3. Vercel env vars (Project Settings → Environment Variables) — confirm
   `NEXT_PUBLIC_APP_URL` matches the real production URL for the Production
   environment specifically (a Preview-scoped override pointing at
   `localhost` or a stale preview domain is the other common cause).
4. `app/auth/callback` only ever redirects to a fixed `/profile` or
   `/login?error=1` (`docs/SECURITY.md` sec 16) — if users land somewhere
   else, the bug is upstream (GoTrue config), not the callback route.
5. If the failure looks email-specific rather than a redirect/callback
   issue, see "Investigating a failed magic-link email (Resend)" below.

### Domain/DNS troubleshooting (rankle.io cutover)

Canonical production URL is `https://rankle.io` (`docs/DEPLOY.md` sec 14,
sec 25). If the app appears to serve the wrong host or auth/share links point
somewhere unexpected:

1. **Confirm DNS/TLS first.** `vercel domains inspect rankle.io` — Nameservers
   should show `ns1.vercel-dns.com` / `ns2.vercel-dns.com` both checked, and
   the Projects section should list `rankle` with `rankle.io, www.rankle.io`.
   `curl -sI https://rankle.io` should return `200` with a valid cert (no TLS
   warning); if it doesn't, this is a Vercel domain issue, not application
   code. **`vercel domains inspect`/`vercel alias ls` do not show redirect
   direction or target** — they only confirm attachment. The only reliable
   way to see what a domain actually does is `curl -I` against it directly.
2. **Confirm `NEXT_PUBLIC_APP_URL` actually shipped.** This is a build-time
   value — changing it in Vercel's dashboard does nothing to an
   already-built deployment (sec 27 "Verifying `NEXT_PUBLIC_APP_URL` after
   deployment" below). Check the live page source/share link/magic-link
   destination, not just the dashboard's env var value.
3. **`www.rankle.io` not redirecting correctly?** This is a Vercel
   **domain-level** redirect (Project Settings → Domains → `www.rankle.io` →
   "Redirect to Another Domain" → `rankle.io`, 308) — not application code,
   nothing to check in `next.config.ts`. During the 2026-09-14 migration this
   was found configured backwards (apex redirecting to `www` instead of the
   reverse), which caused a live infinite redirect loop once an app-level
   `www → apex` rule was added on top of it — see the incident note below.
   **Never add a `www.rankle.io` rule to `next.config.ts`**; Vercel already
   owns this redirect, and duplicating it at the app level is exactly what
   caused the loop.
4. **`rankle-theta.vercel.app` redirect not firing?** This one *is*
   application-level — a host-matched rule in `next.config.ts`
   (`redirects()`) — because Vercel has no domain-level redirect mechanism
   for its own auto-issued `<project>.vercel.app` alias. If it stops
   working, check that rule still exists in `next.config.ts` and that the
   deployed build actually includes it (same build-time caveat as above —
   redirects are compiled into the build, not live-editable).
5. **Do not touch `auth.rankle.io` while debugging apex/www routing.** It is
   a separate DNS subdomain used only for Resend sending (`docs/DEPLOY.md`
   sec 23) and shares nothing with the app-serving DNS records.

**Incident (2026-09-14):** during the initial cutover, an app-level
`next.config.ts` rule redirecting `www.rankle.io → rankle.io` was deployed
without realizing Vercel already had an existing domain-level redirect going
the *other* direction (`rankle.io → www.rankle.io`, a leftover from how the
domain was originally added — invisible to `vercel domains inspect`).
Together they formed `rankle.io → www.rankle.io → rankle.io → …`, an
infinite loop making the entire site unreachable on both hosts for several
minutes. Fixed by (a) removing the app-level `www` rule, then (b) correcting
the Vercel domain-level redirect direction so `rankle.io` serves directly and
`www.rankle.io` redirects to it. Lesson: **always `curl -I` a domain's actual
live behavior before adding any redirect for it** — CLI/dashboard domain
*attachment* views don't show redirect configuration.

#### Verifying `NEXT_PUBLIC_APP_URL` after deployment

The Vercel dashboard showing the right value is not sufficient proof — it
only takes effect in the next build. To verify a specific deployment
actually has it baked in:

```bash
vercel env pull /tmp/prod-verify.env --environment=production --yes
grep NEXT_PUBLIC_APP_URL /tmp/prod-verify.env   # confirms the *stored* value
rm /tmp/prod-verify.env                          # delete immediately — do not leave env dumps on disk
```

That only confirms what's stored, not what shipped. To confirm a live
deployment was actually *built* with it, check the rendered page: view source
on `https://rankle.io/login` and confirm any client-visible reference to the
app URL (e.g. the share link a signed-in session would generate) reads
`rankle.io`, not the old host. `vercel inspect <deployment-url>` also shows
which commit/build produced the live deployment, useful for confirming a
redeploy actually happened after the env var change.

#### Rollback procedure

If the new domain breaks auth or gameplay, restore the previous known-good
configuration — do not improvise:

1. **Vercel → Environment Variables**: set `NEXT_PUBLIC_APP_URL` (Production)
   back to `https://rankle-theta.vercel.app`. Trigger a fresh deployment
   (env var changes don't apply retroactively — same caveat as above).
2. **Supabase Dashboard → Authentication → URL Configuration**: set Site URL
   back to `https://rankle-theta.vercel.app`. Leave the redirect allowlist
   alone if `https://rankle-theta.vercel.app/**` and
   `http://localhost:3000/**` are both still present — they should be, since
   the migration only ever *added* `https://rankle.io/**` rather than
   removing anything.
3. **`next.config.ts` redirects**: leave the `rankle-theta.vercel.app → rankle.io`
   rule in place; if `rankle.io` itself is the thing that's broken, revert or
   comment out the `redirects()` block too so `rankle-theta.vercel.app` keeps
   serving the app directly instead of bouncing users to a broken domain.
   This file has no `www.rankle.io` rule (see the incident note above) — no
   app-level change is needed for `www`.
4. **Vercel domain-level `www.rankle.io` redirect**: leave it pointed at
   `rankle.io` — it doesn't need to change for an app rollback. Only revisit
   it if `rankle.io` itself is what's being rolled back away from, in which
   case point it at whatever host is being restored to instead.
5. **Vercel domain attachment**: do not detach `rankle.io`/`www.rankle.io`
   from the project as part of rollback — they can keep pointing at the same
   deployment; the config above is what actually controls user-facing
   behavior.
6. Redeploy, then re-run the sec 26 auth/gameplay verification against
   `https://rankle-theta.vercel.app` before declaring rollback complete.

### Investigating a failed magic-link email (Resend)

Production custom SMTP is Resend (`docs/DEPLOY.md` sec 23,
`auth.rankle.io`). Work through these in order:

1. **Supabase Dashboard → Authentication → Logs** — filter to `/otp` (the
   send) and `/verify`/`/token` (the click/exchange) around the reported
   time. A `429 over_email_send_rate_limit` on `/otp` means either the
   per-address ~60s resend cooldown (normal, not a bug) or the project-wide
   20/hour limit (sec 23) was actually hit — the log's `error` message
   distinguishes the two ("after N seconds" vs. a flat rate-limit message).
2. **Resend Dashboard → Emails** — search by recipient address. Status
   progresses `Sent → Delivered` normally; `Bounced`/`Complained` means the
   recipient address itself is the problem (typo, full mailbox, etc.), not
   the Rankle configuration. Open the message to confirm the `From` address
   is exactly `Rankle <no-reply@auth.rankle.io>` — a different sender means
   the Supabase SMTP Settings were changed or reverted.
3. **Resend Dashboard → Domains → auth.rankle.io** — confirm status is
   still `Verified` and the DKIM/SPF records under "Records" still show
   `Verified`. A DNS record deleted or edited outside this procedure (e.g.
   during unrelated `rankle.io` DNS work — sec 25) is the most likely way
   this regresses; re-add the exact records from `docs/DEPLOY.md` sec 23 if
   any show unverified.
4. `GET /verify` returning a 303 with no subsequent `/token` call is a
   distinct failure mode from a `bad_code_verifier` 400 — it means the
   redirect back to `/auth/callback` never completed (or the callback never
   ran the exchange), not that the code itself was invalid. Rule out a stale
   already-signed-in session in the same browser before assuming a bug: a
   leftover valid session from earlier testing can make a failed/incomplete
   sign-in attempt look successful because the old session is still there.
5. Deliverability landing in spam rather than failing outright: confirm SPF/
   DKIM are `Verified` (step 3) — if both pass and it's still landing in
   spam, this is a sender-reputation/content issue to escalate to Resend
   support, not a configuration bug on Rankle's side.

### Rollback

**Application:** Vercel Dashboard → **Deployments** → find the last known-good
deployment → **Promote to Production** (or `vercel rollback` from the CLI).
Instant; does not touch the database.

**Database:** this project has no automated schema rollback (sec 9, `DEPLOY.md`
sec 19) — write a new forward-fix migration. Only hand-restore from a Supabase
backup if data itself (not just schema) is corrupted, and only after reading
sec 10 below.

### Database migration incidents

1. `npx supabase migration list` (needs `supabase link` or `--project-ref`)
   compares local migration files against what the remote project has
   actually applied — use this first to confirm what did or didn't land.
2. A migration that partially applied: Supabase runs each migration in a
   transaction, so a failure rolls it back automatically — confirm with (1)
   rather than assuming partial application.
3. Never hand-edit schema in the SQL Editor to "match" a migration — write
   the correction as a new migration file so local/remote/history stay one
   source of truth (`DEPLOY.md` sec 6).

### Secret compromise / rotation

1. **`GUEST_COOKIE_SECRET`** — generate a new value (`openssl rand -base64
   32`), set it in Vercel (Production), redeploy. Every existing guest cookie
   stops verifying (signed out as a guest, not a data loss — sec 21,
   `docs/SECURITY.md` sec 26).
2. **`SUPABASE_SERVICE_ROLE_KEY`** — Supabase Dashboard → **Settings → API**
   → roll the service-role key, update Vercel, redeploy immediately (this key
   bypasses RLS entirely — treat exposure as Critical, sec 4).
3. **`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`** — this one is meant to be
   public; rotating it is only needed if RLS itself is believed compromised,
   not for ordinary exposure.
4. **Resend API key (Supabase SMTP password)** — Resend Dashboard →
   **API keys** → revoke the compromised key → create a new one (Sending
   access, scoped to `auth.rankle.io` if available) → paste the new value
   into Supabase Dashboard → Authentication → Emails → SMTP Settings →
   Save. No Vercel redeploy needed — this credential lives only in
   Supabase's own config, never in the app's environment (`docs/DEPLOY.md`
   sec 23). Confirm the old key no longer authenticates by checking Resend's
   API keys list shows it revoked.
5. After any rotation: update `.env.local` for local development, confirm the
   old value no longer works, and note what happened per sec 7.

### Launch-day smoke checks

Run against the real production URL after every deploy that touches auth,
submission, sharing, or admin:

1. Homepage loads; today's game (or the honest empty state) renders.
2. Rank every item, submit, confirm the lock-in — results reveal.
3. Refresh `/results` — ranking is unchanged (immutability holds).
4. Share the result; open the link in a private/incognito window — locked
   gate appears, no ranking data in the page source.
5. Sign in via magic link (a real inbox) — lands on `/profile`.
6. Visit `/admin` signed out and as a non-admin — both redirected, no admin
   UI ever flashes.
7. Check Vercel logs and Supabase logs (above) for unexpected errors during
   this pass.

### Verifying product analytics (Product Analytics milestone)

Events land in `public.analytics_events` — a first-party table, no
third-party dashboard to check. Query it directly (Supabase SQL editor, or
`psql "$SUPABASE_DB_URL"` against the linked remote project):

```sql
-- Recent events, most recent first
select event_name, occurred_at, tierlist_id, user_id, guest_id, share_id, properties
from public.analytics_events
order by occurred_at desc
limit 50;

-- Funnel counts for a given day's tierlist
select event_name, count(*)
from public.analytics_events
where tierlist_id = '<tierlist-id>'
group by event_name;

-- Completion-time percentiles (ranking_started -> ranking_submitted)
select
  percentile_cont(0.5) within group (order by (properties->>'duration_ms')::numeric) as p50_ms,
  percentile_cont(0.75) within group (order by (properties->>'duration_ms')::numeric) as p75_ms
from public.analytics_events
where event_name = 'ranking_submitted' and properties ? 'duration_ms';
```

If a deploy that should be logging events shows none: confirm the deployment
is actually Production (`lib/analytics/log.ts` is a deliberate no-op unless
`VERCEL_ENV === "production"` — a Preview deployment or local dev never
writes, and never will merely because `next build` marks the bundle
`NODE_ENV=production` too; `VERCEL_ENV` is the value that actually
distinguishes Production from Preview), then check Vercel function logs for
`[analytics] ...` lines (every
failure mode is logged server-side, never thrown — sec 3's "prefer IDs and
redacted context" applies here too, no ranking/share/PII content in these
lines). A missing/rotated `SUPABASE_SERVICE_ROLE_KEY` is the most likely
root cause of a silent, total analytics outage — see sec 21 for rotation.
Analytics failing this way never affects gameplay, submission, or sharing —
those paths do not depend on the analytics write succeeding.

**As verified (2026-09-15 production rollout):** the Production/Preview
split was confirmed against real deployments, not just unit tests — a
genuine Preview deployment of the shipped commit produced zero rows after
a confirmed page load reaching the exact call site (row count unchanged
across an isolated before/after check), while an isolated Production
request immediately produced one. Reuse this exact before/after row-count
method (not just reading `VERCEL_ENV`'s configured value) whenever
verifying this boundary again after a future change to `lib/analytics/log.ts`.

---

## 28. Operational TODOs

Longer-term operational improvements belong in `TODO.md`.

Examples:

- Automated smoke tests
- Backup verification
- Better alerting
- Aggregate rebuild command
- Admin audit log
- Abuse monitoring

Do not implement all of them before usage justifies them.

---

## 29. Operations Principle

Prefer a small number of tools you understand over a complicated observability stack.

The goal is not enterprise ceremony.

The goal is to know when the game is broken and to be able to fix it safely.

---

## 30. Test Suite Reliability (2026-09-15 flakiness audit)

Root causes found and fixed for the flakes previously explained away as
"known flaky, passes on rerun." Each was reproduced with a concrete
mechanism before being fixed — see git history on this date for the exact
diffs.

**`accounts.spec.ts` — "another signed-in user cannot view someone else's
history detail page."** `rankAndSubmit()` was followed immediately by
`page.goto("/profile")` with no wait for the post-submit redirect, unlike
every other call site of `rankAndSubmit()` in the same file. Under any real
load, `page.goto()`'s hard navigation cancels the still-in-flight
`submit_ranking` Server Action request (visible as `ECONNRESET`/`aborted` in
the dev server log), so the owner's submission never lands and `/profile`
correctly shows zero Rankles. Fix: added the same
`await expect(page).toHaveURL(/\/results\/?$/)` wait the other five call
sites already use. Reproduced on demand pre-fix (failed the first isolated
run); 10+ clean runs post-fix.

**`/profile`, `/archive`, `/friends`, `/history/[id]`, `/results`, and
`/share/[token]` — duplicate ARIA `banner` landmark.** Every one of these
pages renders the shared `<AppHeader>` (a real `<header>`, correctly the
page's one `banner` landmark) followed immediately by a second, page-local
`<header>` for the page's own title block. Neither is nested inside
`article`/`aside`/`main`/`nav`/`section`, so per the HTML spec both resolve
to `role=banner` — a real accessibility defect (a screen reader announces
two "banner" landmarks), not just a test-locator ambiguity. Only `/profile`
had been reported because it's the one route `retention.spec.ts` explicitly
loops over with a bare `getByRole("banner")` assertion, but the identical
bug existed on five other routes.  Fixed at the markup level: each page-local
title `<header>` became a plain `<div>` (same classes, same content — no
CSS or JS anywhere selected on the `header` tag itself). `AppHeader` is now
the sole banner landmark app-wide. No test was loosened; `.first()` was
never needed because the underlying markup was actually wrong.

**`admin.spec.ts` — `tierlists_release_date_key` collisions.** Two tests
insert a real `tierlists` row at a randomly-offset date
(`e2e-locked-*` in the past, `E2E Admin Test Game` in the future) specifically
so repeated local runs don't collide with each other — but neither test ever
deleted its row afterward. Across enough uncleaned runs without an
intervening `supabase db reset`, the birthday paradox catches up with the
finite date range and a fresh insert collides with 23505. Reproduced
directly (`Key (release_date)=(2024-12-20) already exists`) after ~8
uncleaned local runs. Fixed: both tests now delete their own row(s) by id/
slug in a `finally` block, so no run leaves fixture state behind for a later
run to collide with.

**Vitest integration tests — shared "current game" race.**
`submit-ranking`, `get-results`, `get-share`, `claim-guest-submissions`, and
`friends` integration tests all call `submit_ranking()`, which — by design
(`private.current_daily_game_id()` is a deliberate global singleton, see
`SECURITY.md`) — only accepts submissions for whichever tierlist is
currently "the" game. This makes true per-file fixture isolation impossible
for this specific group without weakening that invariant, so Vitest's
default full file-parallelism let these five files race each other's
aggregate-count assertions. Fixed narrowly: `vitest.config.mts` now defines
two projects — `unit` (everything else, still fully parallel) and
`integration-shared-current-game` (exactly these five files,
`fileParallelism: false`). Nothing else was serialized. 5 consecutive
`npx vitest run` runs: 489/489 every time.

**`get-daily-game.integration.test.ts` was stale.** It still ran the raw
pre-Milestone-8 `tierlists` query the resolver used before
`get_daily_game()`/`private.current_daily_game_id()` existed, per the TODO
item this closes. Rewritten into two blocks: a remote smoke test (RPC now
called instead of the raw query, matching what `getDailyGame()` actually
calls) and a new local block against the seeded fixtures, which resolves
today's live game while correctly excluding the seeded future-scheduled and
past-archived games, checks item ordering, and confirms public
(unauthenticated) callability. Resolver day-rollover/ordering semantics
themselves are already exhaustively covered at the SQL level
(`supabase/tests/rls_spec.sql` sec 11) and are intentionally not re-tested
here — this file only exercises the JS integration boundary.

**Not a code defect: transient auth-callback failures under extreme,
self-induced local load.** While stress-testing this fix (30+ consecutive
full-suite/admin-suite runs back-to-back on a single dev machine with an
IDE and several MCP servers also running), one run produced a genuine
`/auth/callback` PKCE-exchange failure (`/login?error=1`) on an otherwise
correct flow, and a later run under even heavier accumulated load produced
a large cascade of timeouts across many files (24 failures, 2.4 min instead
of ~30s). System load (`uptime`) was elevated (>20 on a 14-core machine)
during both; the very next run after backing off passed cleanly (98/98,
~30s), and Docker/Postgres/Next.js showed no crash or leaked process. This
is real resource exhaustion, but it is a property of running dozens of
uninterrupted full-suite iterations on a shared, already-loaded workstation,
not something a single normal local run or a dedicated CI runner will hit.
No code or test changed for this — do not add retries or sleeps to paper
over it. If it becomes a real CI symptom, look at CI runner CPU/memory
headroom first, not the test code.

**Arbitrary waits reviewed, none removed.** `e2e/ranking.spec.ts`'s
`waitForTimeout` calls in `dragCardToLane()` exist to give dnd-kit's pointer
sensor real wall-clock gaps between synthetic mouse events (there is no DOM
condition to await — it's input-event timing, not render timing) and were
left as-is. The `setTimeout(r, 250)` calls inside every spec file's
Mailpit-polling `getLatestMagicLink()` are a bounded poll-with-backoff
against an inherently async external system (already scoped by exact
recipient address, not "most recent overall" — see the comment in
`accounts.spec.ts`), not a blind sleep, and were also left as-is.

**Retry/worker configuration: unchanged, and not the fix.** Playwright
already runs with `retries: 0` locally / `1` in CI and `fullyParallel: true`
at the default worker count (half of CPU cores); none of the fixes above
relied on raising retries or lowering parallelism. The one narrow
serialization introduced (the Vitest integration-project above) is scoped
to five specific files that share a real database invariant, not a general
concurrency reduction.

**Running the suite.** `npm test` and `npm run test:e2e` are unchanged
commands and now produce deterministic results under normal (non-abusive)
local use: `npx vitest run` (489/489, 5 consecutive local runs, and again
after a `supabase db reset`) and `npx playwright test` (98/98 across
multiple consecutive runs post-fix, run at a normal cadence). A red run
should now be treated as a real signal, not the historical "probably the
known flake."

---

## 31. GitHub Actions CI (2026-09-15)

Rankle had no CI before this. The now-trustworthy suite (sec 30 above) made
it worth gating merges on. `.github/workflows/ci.yml` runs on every pull
request and every push to `main`. See `docs/DEPLOY.md` sec 30 for the
CI/CD boundary and what it does and doesn't touch; this section is the
"why it's built this way."

**One job, not four.** The task this was built from sketched a four-lane
shape (static checks / unit+integration / browser / build+security). All
four ended up as ordered steps in a single job instead: the browser lane
and the unit/integration lane both need the same local Supabase stack, and
running that boot twice (once per job) would double the slowest, most
Docker-dependent part of the pipeline for no isolation benefit — nothing
here needs to run on a different runner or in true parallel with anything
else. One job also means one linear log a solo maintainer can read top to
bottom instead of jumping between job summaries.

**Ordering is deliberately fail-fast.** Steps run cheapest-and-most-likely-
to-catch-something first: secret scan (no dependencies installed yet) →
lint/typecheck → production build → only then Docker/Supabase → Vitest →
SQL/RLS → Playwright. The build step runs *before* Supabase starts, using
fixed placeholder values (`sb_publishable_ci-placeholder` etc.) that are
never reachable at that point in the job — every route in this app is
server-rendered on demand with no build-time data fetching, so `next
build` only needs `lib/env.ts`'s Zod schema to see syntactically valid
values, never a live connection (confirmed locally: build succeeds with
Supabase stopped entirely). A change with an obvious lint/type/build
problem now fails in well under a minute instead of after paying for a
multi-minute Docker boot.

**`scripts/test-sql.sh` exists because `rls_spec.sql` can't fail on its
own.** The SQL suite wraps every assertion in `BEGIN ... ROLLBACK` and only
ever prints a PASS/FAIL summary row — `psql -f supabase/tests/rls_spec.sql`
exits `0` no matter how many assertions fail (verified: forced 7 fake
failures through the same parsing logic and confirmed it exits non-zero).
Without this wrapper, CI would report "SQL/RLS: passed" on a real
regression. The script parses the printed `passed | failed | total` row and
fails the process when `failed != 0` or the row can't be found at all — it
never hardcodes an expected count, so adding a legitimate new assertion
never requires touching CI.

**`scripts/setup-env-test.sh` replaces the manual `cp .env.test.example
.env.test` + copy-from-`supabase status` step** (`docs/DEPLOY.md` sec 4)
with `supabase status -o env --override-name ...`, which emits the same
values under the exact variable names the app expects. Every value it
writes is either a fixed local-only demo credential the Supabase CLI
generates identically for every `supabase start` on every machine (never
production — there is no production URL or key anywhere in the script or
the workflow) or a disposable per-run string (`GUEST_COOKIE_SECRET`). The
generated `NEXT_PUBLIC_SUPABASE_URL` is also exported as a real process env
var for the job (via `$GITHUB_ENV`), which has one deliberate side effect:
`get-daily-game.integration.test.ts`'s "remote" describe block (normally
skipped unless `.env.local` points it at a real project) sees this local
URL instead of being skipped, so in CI it harmlessly re-exercises the local
stack rather than skipping — never production, since CI never has a
production URL available to put there in the first place.

**`scripts/secret-scan.sh`** replaces what had only ever been an ad hoc
manual grep with a real, reproducible, dependency-free script (a handful of
regexes for `sb_secret_...`, private-key blocks, embedded service-role
JWTs, AWS-style keys, and Resend-style keys, over `git ls-files` only —
never `node_modules` or build output). No scanning platform was added; the
existing baseline didn't justify one.

**Playwright artifacts.** `playwright.config.ts` now also writes an HTML
report and captures screenshots/video on failure, but only when
`process.env.CI` is set (same existing conditional pattern the file
already used for `retries` and `reporter`) — local runs are unaffected.
CI uploads `playwright-report/` and `test-results/` as a build artifact
only when the job fails (7-day retention).

**Worker/retry config was not touched.** `playwright.config.ts` already
computes `retries`/`reporter` from `process.env.CI`, which GitHub Actions
sets automatically — nothing in the workflow overrides `workers`. On a
2-core GitHub-hosted runner, Playwright's own default (half of detected
CPUs) naturally lands at a conservative worker count without any CI-
specific configuration being needed.

**Branch protection is applied (2026-09-18).** Two shapes were considered
for `main`: (A) direct pushes allowed, CI only observational after the
fact; (B) a pull request required before merge, gated by the CI check,
with zero required reviewer approvals. A status check that only runs
*after* a push can't stop that push from landing — so (A) isn't actually a
pre-merge gate, just a post-hoc signal. (B) was applied via classic branch
protection (`PUT /repos/m4ttblanke/rankle/branches/main/protection`), not
the newer rulesets API — nothing about this repo's scale needs rulesets'
extra flexibility:

- `required_status_checks`: `strict: true`, required check context
  `"Lint, typecheck, tests, build, secret scan"` (the exact job `name:`
  from `ci.yml` — this is the string GitHub actually keys required checks
  on, not the workflow filename or the `jobs.<id>` key).
- `required_pull_request_reviews.required_approving_review_count: 0` — a
  PR is required before merge, but nobody has to approve it. No
  `require_code_owner_reviews`, no `required_signatures`.
- `allow_force_pushes: false`, `allow_deletions: false`.
- `enforce_admins: false` — **deliberately**, by the repository owner's
  explicit choice after being shown the tradeoff: Rankle's only
  collaborator is also necessarily an admin on their own repo, so with
  `enforce_admins: false` these rules bind only a hypothetical future
  non-admin collaborator, and a direct `git push origin main` by the owner
  today still bypasses both the PR requirement and the CI gate entirely.
  Setting `enforce_admins: true` would close that gap (including for the
  owner's own accidental direct pushes) at the cost of never being able to
  push a hotfix straight to `main` without going through a PR, even solo.
  Revisit either the `enforce_admins` value or the whole PR-required shape
  if a second contributor joins or the bypass gap becomes a real problem.
