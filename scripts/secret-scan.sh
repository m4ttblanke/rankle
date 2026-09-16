#!/usr/bin/env bash
# Dependency-free pattern scan for accidentally committed secrets, across
# git-tracked files only (so node_modules/build output are never scanned).
# .env.example's variables are declared with no value after `=`, so they
# can never match a pattern that requires real key material.
set -euo pipefail

PATTERNS=(
  '\bsb_secret_[A-Za-z0-9_-]{10,}'
  '-----BEGIN [A-Z ]*PRIVATE KEY-----'
  'service_role["'"'"']?[[:space:]]*[:=][[:space:]]*["'"'"']?eyJ[A-Za-z0-9_-]{10,}'
  '\bAKIA[0-9A-Z]{16}\b'
  '\bre_[A-Za-z0-9]{20,}\b'
)

found=0
while IFS= read -r -d '' file; do
  for pattern in "${PATTERNS[@]}"; do
    if grep -EnI "$pattern" "$file" > /tmp/secret-scan-hit.$$ 2>/dev/null; then
      echo "possible secret in $file:"
      sed 's/^/  /' /tmp/secret-scan-hit.$$
      found=1
    fi
    rm -f /tmp/secret-scan-hit.$$
  done
done < <(git ls-files -z -- . ':!:package-lock.json')

if [ "$found" -ne 0 ]; then
  echo "error: possible committed secret(s) found above" >&2
  exit 1
fi

echo "secret scan: clean"
