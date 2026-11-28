#!/usr/bin/env bash
# Run the integration tests (tests/db) against the local Supabase stack.
# Needs `supabase start` first; never points at a hosted project.
set -euo pipefail

status="$(supabase status -o env 2>/dev/null)" || {
  echo "Local Supabase isn't running. Start it with: supabase start" >&2
  exit 1
}
value() { printf '%s\n' "$status" | sed -n "s/^$1=\"\(.*\)\"$/\1/p"; }

export TEST_DATABASE_URL="$(value DB_URL)"
export TEST_SUPABASE_URL="$(value API_URL)"
export TEST_SUPABASE_PUBLISHABLE_KEY="$(value PUBLISHABLE_KEY)"

exec npx vitest run tests/db "$@"
