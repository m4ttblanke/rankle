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

## 27. Operational TODOs

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

## 28. Operations Principle

Prefer a small number of tools you understand over a complicated observability stack.

The goal is not enterprise ceremony.

The goal is to know when the game is broken and to be able to fix it safely.
