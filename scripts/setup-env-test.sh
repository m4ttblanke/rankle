#!/usr/bin/env bash
# Generates .env.test from a running local Supabase stack (`npm run db:start`
# must have already succeeded). Used by CI so it never hand-copies or stores
# these values anywhere durable — every value here is either a fixed local-only
# demo credential the Supabase CLI generates for every `supabase start` on
# every machine (never production), or a fresh throwaway string. Also usable
# locally as a faster alternative to the manual
# `cp .env.test.example .env.test` + copy-paste-from-`supabase status` flow
# documented in docs/DEPLOY.md sec 4.
set -euo pipefail

npx --yes supabase status -o env \
  --override-name api.url=NEXT_PUBLIC_SUPABASE_URL \
  --override-name auth.publishable_key=NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY \
  --override-name auth.secret_key=SUPABASE_SERVICE_ROLE_KEY \
  --override-name db.url=SUPABASE_DB_URL \
  | grep -E '^(NEXT_PUBLIC_SUPABASE_URL|NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY|SUPABASE_SERVICE_ROLE_KEY|SUPABASE_DB_URL|MAILPIT_URL)=' \
  > .env.test

{
  echo 'NEXT_PUBLIC_APP_URL=http://localhost:3000'
  echo "GUEST_COOKIE_SECRET=ci-test-only-$(date +%s)-$RANDOM"
} >> .env.test

echo "wrote .env.test ($(wc -l < .env.test) lines)"
