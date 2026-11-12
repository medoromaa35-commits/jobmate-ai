#!/usr/bin/env bash
# Applies the migration to a throwaway local Postgres DB (with a minimal Supabase stub) and runs RLS tests.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=${DB:-jm_test}
psql -q -c "drop database if exists $DB" -c "create database $DB"
args=(-f supabase/tests/stub_supabase.sql); for f in supabase/migrations/*.sql; do args+=(-f "$f"); done
psql -q -v ON_ERROR_STOP=1 -d "$DB" "${args[@]}" >/dev/null 2>&1
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/rls_test.sql | grep "PASSED"
