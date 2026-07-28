#!/usr/bin/env bash
# Prove that a given dump file actually restores cleanly — WITHOUT
# touching the real `stlab` database. Restores into a disposable "drill"
# database on the same Postgres instance, sanity-checks it, then drops it.
#
# Usage:
#   bash scripts/verify-backup.sh <dump-file.sql>
#
# Targets deploy/docker-compose.yml's `db` service by default, via
# `docker compose exec`. To target a container directly (e.g. local dev's
# standalone `stlab-db` container), set DB_CONTAINER:
#   DB_CONTAINER=stlab-db bash scripts/verify-backup.sh <dump-file.sql>
set -euo pipefail

DUMP_FILE="${1:-}"
if [ -z "$DUMP_FILE" ]; then
  echo "Usage: $0 <dump-file.sql>" >&2
  exit 1
fi
if [ ! -f "$DUMP_FILE" ]; then
  echo "Error: dump file not found: $DUMP_FILE" >&2
  exit 1
fi
if [ ! -s "$DUMP_FILE" ]; then
  echo "VERIFY FAILED: $DUMP_FILE is empty (0 bytes)." >&2
  exit 1
fi

DB_USER="${DB_USER:-stlab}"
DRILL_DB="stlab_verify_drill"
COMPOSE_FILE="$(dirname "$0")/../deploy/docker-compose.yml"

if [ -n "${DB_CONTAINER:-}" ]; then
  psql_exec() { docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" "$@"; }
else
  psql_exec() { docker compose -f "$COMPOSE_FILE" exec -T db psql -v ON_ERROR_STOP=1 -U "$DB_USER" "$@"; }
fi

cleanup() {
  psql_exec -d postgres -c "DROP DATABASE IF EXISTS \"$DRILL_DB\";" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Creating throwaway database '$DRILL_DB'..."
psql_exec -d postgres -c "DROP DATABASE IF EXISTS \"$DRILL_DB\";"
psql_exec -d postgres -c "CREATE DATABASE \"$DRILL_DB\" OWNER \"$DB_USER\";"

echo "Restoring '$DUMP_FILE' into '$DRILL_DB'..."
if ! psql_exec -d "$DRILL_DB" < "$DUMP_FILE"; then
  echo
  echo "VERIFY FAILED: $DUMP_FILE did not restore cleanly." >&2
  exit 1
fi

echo "Sanity check: 'User' table exists and has rows..."
if ! ROW_COUNT="$(psql_exec -d "$DRILL_DB" -tA -c 'SELECT COUNT(*) FROM "User";' 2>&1)"; then
  echo
  echo "VERIFY FAILED: could not query 'User' table in restored dump ($DUMP_FILE):" >&2
  echo "$ROW_COUNT" >&2
  exit 1
fi
ROW_COUNT="$(printf '%s' "$ROW_COUNT" | tr -d '[:space:]')"

if [ -z "$ROW_COUNT" ] || ! [ "$ROW_COUNT" -gt 0 ] 2>/dev/null; then
  echo
  echo "VERIFY FAILED: 'User' table has 0 rows in restored dump ($DUMP_FILE)." >&2
  exit 1
fi

echo
echo "VERIFY OK: $DUMP_FILE restores cleanly, User table has $ROW_COUNT row(s)."
