# DEPLOY.md

This document describes local environment setup and production deployment.

Read this file when working on:

- Environment variables
- Supabase setup
- Migrations
- Auth providers
- Storage
- Vercel
- Production domains
- Admin bootstrap
- Preview deployments
- Rollback
- Release verification

Keep this file aligned with actual infrastructure.

---

## 1. Deployment Architecture

Intended production architecture:

```text
Browser
   ↓
Next.js application on Vercel
   ↓
Supabase
├── PostgreSQL
├── Auth
└── Storage
```

Avoid introducing additional production services unless required.

---

## 2. Requirements

Local development should require approximately:

- Node.js version defined by repository
- Repository package manager
- Supabase project or local Supabase environment as configured
- Environment variables
- Git

Document exact versions in `README.md` or package configuration.

---

## 3. Environment Files

Use:

- `.env.example` for variable names (kept in sync with the app; the source of
  truth for what is required)
- `.env.local` for local values. Never commit it.

Currently required (see `.env.example` for the authoritative list and notes):

```text
# Public — inlined into the browser bundle, gated by RLS
NEXT_PUBLIC_SUPABASE_URL=                  # https://<project-ref>.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=     # the "sb_publishable_..." key
NEXT_PUBLIC_APP_URL=                       # defaults to http://localhost:3000 if unset

# Server-only — never prefix with NEXT_PUBLIC_
SUPABASE_SERVICE_ROLE_KEY=          # bypasses RLS; unused as of Milestone 1

# Local design tooling only (not read by the app)
API_KEY_21ST=
```

`lib/env.ts` validates the public vars at startup with Zod and fails fast with a
clear message if one is missing or malformed.

Analytics (`NEXT_PUBLIC_POSTHOG_*`) and monitoring (`SENTRY_DSN`) are not wired
yet — add them here when those services are introduced.

Only include variables for services actually used.

Never put server secrets in `NEXT_PUBLIC_*`.

---

## 4. Local Setup

Typical setup:

```bash
git clone <repository>
cd <repository>
<package-manager> install
cp .env.example .env.local
```

Populate required environment values.

Then run the repository's development command.

Keep exact commands in `README.md`.

---

## 5. Supabase Project

Create or connect the intended Supabase project.

Configure:

- Project URL
- Anon/publishable browser key
- Service-role server key
- Database
- Auth
- Storage if needed

Do not expose the service-role key to browser code.

---

## 6. Database Migrations

All schema changes must be represented as migrations under the repository's Supabase migration directory.

Before production deployment:

1. Review migration
2. Confirm backward compatibility where relevant
3. Back up important data when risk warrants it
4. Apply migration
5. Verify schema
6. Deploy compatible application code

Avoid manual production schema edits.

---

## 7. Migration Safety

For risky schema changes, prefer additive rollout:

1. Add new column/table
2. Deploy code compatible with old and new state
3. Backfill if necessary
4. Switch reads/writes
5. Remove old structure later

Do not perform destructive migration and application changes in an unsafe order.

For a small project, keep this pragmatic rather than ceremonial.

---

## 8. Seed Data

Seed scripts may provide development/demo games.

Example topics:

- Fast Food Fries
- Pixar Movies
- Breakfast Foods

Do not seed demo content into production unless explicitly intended.

---

## 9. Authentication

Configure only providers actually used.

Potential providers:

- Email
- Google
- Apple

For OAuth providers configure:

- Client ID
- Client secret
- Authorized redirect URL
- Production URL
- Preview/local callback URLs where appropriate

Document provider-specific callback values here once finalized.

---

## 10. Supabase Auth Redirects

Configure approved site and redirect URLs for:

- Local development
- Production
- Preview environments if supported

Avoid wildcard redirects broader than necessary.

---

## 11. Storage

Use Supabase Storage initially.

Potential buckets:

- Public game item images
- User avatars

Decide intentionally whether each bucket is:

- Public
- Private

Validate upload permissions through storage policies.

If public media volume later justifies another object store, document migration before changing providers.

---

## 12. Vercel Project

Connect the Git repository to Vercel.

Configure:

- Framework detection
- Build command if non-default
- Environment variables
- Production domain
- Preview environments

Avoid unnecessary custom build infrastructure.

---

## 13. Environment Variable Scopes

Configure variables for the correct Vercel environments:

- Development where needed
- Preview
- Production

Production secrets should not automatically leak into untrusted preview environments if that creates risk.

---

## 14. Production URL

Once the product domain is selected, record:

```text
Production URL: TBD
```

Update:

- `NEXT_PUBLIC_APP_URL`
- OAuth redirect configuration
- Supabase site URLs
- OpenGraph metadata
- Any allowed-origin configuration

---

## 15. Preview Deployments

Use Vercel preview deployments for normal branch/PR testing.

Be careful with:

- Production databases
- OAuth callbacks
- Admin access
- Real analytics
- Email/SMS providers

Prefer isolated or limited behavior where practical.

Do not send real SMS/email from arbitrary preview branches unless explicitly configured.

---

## 16. Admin Bootstrap

Admin access must not be self-service.

Recommended bootstrap:

1. Create normal authenticated account
2. Identify trusted user ID
3. Grant admin role through a controlled database/admin procedure
4. Verify server-side authorization
5. Record the procedure here

Exact production procedure (schema is implemented as of the initial migration
set; see `supabase/README.md` "Admin bootstrap"):

1. The person signs in normally to create their `auth.users` row and `profiles`
   row (the `handle_new_user` trigger creates the profile).
2. From a privileged SQL session (Supabase dashboard SQL editor or a direct
   service-role connection), run:

   ```sql
   update public.profiles set is_admin = true where id = '<uuid>';
   ```

3. Verify: `private.is_admin()` returns true for that user; admin-only RLS
   policies on `tierlists` / `tierlist_items` now allow writes.

`profiles.is_admin` has **no** client column-update grant (migration 4), so it
cannot be set through the API — only from a role that bypasses RLS.

Do not build a public endpoint to assign admin roles.

---

## 17. Deployment Checklist

Before production deployment:

- Relevant tests pass
- Lint passes
- Type check passes
- Production build succeeds
- Migrations reviewed
- Environment variables present
- Auth callbacks correct
- RLS policies applied
- No secrets committed
- Important routes tested
- Mobile smoke test completed
- Spoiler protection verified when relevant

Do not require every item for a trivial static-only deployment, but use judgment.

---

## 18. Post-Deploy Verification

After a meaningful production deployment verify:

- Landing page loads
- Today's game resolves correctly
- Ranking interaction works
- Submission works
- Results unlock only after submission
- Auth works
- Admin access is restricted
- Static/media assets load
- Monitoring receives errors if configured

For schema/auth changes, test the changed path directly.

---

## 19. Rollback

Application rollback:

- Revert to last known-good Vercel deployment where appropriate

Database rollback:

- Prefer forward-fix migrations
- Use destructive rollback only when safe and understood

Never assume rolling back application code automatically rolls back schema.

Document high-risk migration rollback strategy before applying it.

---

## 20. Release-Date Verification

Because the game is date-driven, verify:

- Canonical timezone
- Today's game
- Tomorrow's scheduled game
- No duplicate release date
- Future game remains hidden
- Archived game remains accessible as intended

Do not rely on deployment server timezone.

---

## 21. Analytics

If PostHog or another analytics provider is enabled:

- Configure client key appropriately
- Do not expose private server secrets
- Disable or separate analytics in local development if noisy
- Avoid sending PII

Document exact variables once enabled.

---

## 22. Monitoring

If Sentry or another monitoring provider is enabled:

- Configure DSN
- Configure source maps if useful
- Verify production event ingestion
- Redact sensitive information

Operational behavior belongs in `OPS.md`.

---

## 23. Email

If transactional email is added:

- Document provider
- Required environment variables
- Verified sending domain
- Development behavior
- Production limits

Do not add an email provider until a feature requires it.

---

## 24. SMS

SMS is not part of the initial deployment.

If added later, document:

- Provider
- Environment variables
- Sender registration
- Rate limits
- Cost monitoring
- Abuse prevention
- Development behavior

Never send production SMS from local development accidentally.

---

## 25. DNS

When a custom domain is configured, record:

- Registrar/DNS provider
- Required records
- Vercel verification status
- Redirect behavior between apex and `www` if applicable

Current domain configuration:

```text
TBD
```

---

## 26. Backups

Supabase backup capabilities and any additional backup procedure should be documented once production data matters.

At minimum, understand:

- What Supabase plan provides
- How to export critical data
- How to restore after an incident

Operational details belong in `OPS.md`.

---

## 27. Deployment Ownership

Infrastructure should remain understandable enough that one developer can:

- Deploy
- Roll back
- Rotate secrets
- Apply migrations
- Diagnose common failures

Avoid infrastructure that requires dedicated platform engineering.

---

## 28. Production Cost

Periodically review:

- Vercel usage
- Supabase database/storage usage
- Analytics volume
- Monitoring volume
- Email volume
- SMS usage if introduced

Do not add services that create significant fixed cost before the project has demand.

---

## 29. Deployment Principle

Production deployment should be boring.

The interesting complexity belongs in the product experience, not the release pipeline.
