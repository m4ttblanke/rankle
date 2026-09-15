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
