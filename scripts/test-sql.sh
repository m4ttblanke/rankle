#!/usr/bin/env bash
# Runs supabase/tests/rls_spec.sql and turns its printed PASS/FAIL summary
# into a real process exit code. The script itself always exits 0 from
# psql's point of view (it wraps its assertions in BEGIN...ROLLBACK and
# never RAISEs), so a bare `psql -f` in CI would report "passed" no matter
# how many assertions failed. This wrapper is the only thing that reads the
# summary and fails the build when it should.
set -euo pipefail

DB_URL="${SUPABASE_DB_URL:-postgresql://postgres:postgres@127.0.0.1:54322/postgres}"

output=$(psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/rls_spec.sql)
echo "$output"

summary=$(echo "$output" | grep -E '^ *[0-9]+ *\| *[0-9]+ *\| *[0-9]+ *$' | tail -1)
if [ -z "$summary" ]; then
  echo "error: could not find the passed/failed/total summary row in rls_spec.sql output" >&2
  exit 1
fi

failed=$(echo "$summary" | awk -F'|' '{gsub(/ /, "", $2); print $2}')
total=$(echo "$summary" | awk -F'|' '{gsub(/ /, "", $3); print $3}')

if [ "$total" -eq 0 ]; then
  echo "error: rls_spec.sql reported zero total assertions — treating as a failure" >&2
  exit 1
fi

if [ "$failed" -ne 0 ]; then
  echo "error: $failed of $total SQL/RLS assertion(s) failed" >&2
  exit 1
fi

echo "SQL/RLS: all $total assertions passed"
