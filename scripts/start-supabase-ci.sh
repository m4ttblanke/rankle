#!/usr/bin/env bash
# `supabase start` pulls ~12 container images from public.ecr.aws /
# Docker Hub. GitHub-hosted runners share a small pool of outbound IPs, and
# those registries anonymous-rate-limit by IP — a run can hit
# "toomanyrequests: Rate exceeded" through no fault of this repo's code
# (observed live: CI run 35390712614, 2026-09-18). A partial/failed pull
# can also leave the stack half-started, so a naive immediate retry can
# fail again on a port already bound by the previous attempt's leftover
# container — hence the `supabase stop` before every attempt, including
# the first (a harmless no-op when there's nothing running yet).
#
# This is a narrow retry around ONLY the external image-pull step. It does
# not touch Playwright's retries, does not retry the test/build/lint
# steps, and still fails the job (non-zero exit) if the stack genuinely
# never comes up.
set -euo pipefail

MAX_ATTEMPTS=3

for attempt in $(seq 1 "$MAX_ATTEMPTS"); do
  echo "Start local Supabase: attempt $attempt/$MAX_ATTEMPTS"

  if ! npx --yes supabase stop --no-backup > /dev/null 2>&1; then
    echo "(nothing to stop, or stop failed harmlessly — continuing)"
  fi

  if npx --yes supabase start; then
    echo "Local Supabase started on attempt $attempt"
    exit 0
  fi

  echo "Attempt $attempt failed"
  if [ "$attempt" -lt "$MAX_ATTEMPTS" ]; then
    backoff=$((attempt * 30))
    echo "Retrying in ${backoff}s (likely an external registry rate limit, not an application issue)"
    sleep "$backoff"
  fi
done

echo "error: local Supabase failed to start after $MAX_ATTEMPTS attempts" >&2
exit 1
