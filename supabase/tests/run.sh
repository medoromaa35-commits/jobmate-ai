#!/usr/bin/env bash
# Applies the migration to a throwaway local Postgres DB (with a minimal Supabase stub) and runs RLS tests.
set -euo pipefail
cd "$(dirname "$0")/../.."
DB=${DB:-jm_test}
psql -q -c "drop database if exists $DB" -c "create database $DB"
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/stub_supabase.sql -f supabase/migrations/*.sql >/dev/null
psql -q -v ON_ERROR_STOP=1 -d "$DB" -f supabase/tests/rls_test.sql | grep "PASSED"
