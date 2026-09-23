#!/usr/bin/env bash
# Runs supabase/schema.sql against a throwaway local Postgres and executes the game tests.
# Requires a local Postgres install (initdb, pg_ctl, psql on PATH). Usage: npm run test:db
set -euo pipefail
shopt -s lastpipe 2>/dev/null || true
cd "$(dirname "$0")/.."

DIR=$(mktemp -d)
PORT=${PGTEST_PORT:-55439}
export PGHOST=127.0.0.1 PGPORT=$PORT PGUSER=postgres PGDATABASE=postgres
trap 'pg_ctl -D "$DIR" -m immediate stop >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT

initdb -D "$DIR" -U postgres -A trust >/dev/null
pg_ctl -D "$DIR" -o "-p $PORT -k '' -h 127.0.0.1" -l "$DIR/log" -w start >/dev/null

run() { PGOPTIONS="-c client_min_messages=error" psql -X -q -v ON_ERROR_STOP=1 -f "$1" >/dev/null; }
run supabase/tests/supabase_stub.sql
run supabase/schema.sql
run supabase/schema.sql   # must be re-runnable
psql -X -q -v ON_ERROR_STOP=1 -o /dev/null -f supabase/tests/game_test.sql 2>&1 | sed -E "s/^psql:[^ ]+ (NOTICE|ERROR):  //"
