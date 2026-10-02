#!/usr/bin/env bash
# Applies every Supabase migration to a throw-away Postgres database on top of a
# minimal emulation of Supabase's `auth` and `storage` schemas, then runs the
# RLS assertions in supabase/tests. Uses standard PG* environment variables.
set -euo pipefail

DB="${TEST_DB_NAME:-leblond_test}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PSQL=(psql -v ON_ERROR_STOP=1 -q -X)

"${PSQL[@]}" -d postgres -c "DROP DATABASE IF EXISTS ${DB};" -c "CREATE DATABASE ${DB};"

echo "→ Supabase platform emulation"
"${PSQL[@]}" -d "$DB" -f "$ROOT/supabase/tests/supabase-emulation.sql"

shopt -s nullglob
for f in "$ROOT"/supabase/migrations/*.sql; do
  echo "→ migration $(basename "$f")"
  "${PSQL[@]}" -d "$DB" -f "$f"
done

for f in "$ROOT"/supabase/tests/*.test.sql; do
  echo "→ test $(basename "$f")"
  "${PSQL[@]}" -d "$DB" -f "$f"
done

echo "✓ database checks passed"
