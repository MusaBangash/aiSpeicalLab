#!/usr/bin/env bash
# Restore a .sql dump into the running Postgres database.
#
# *** DESTRUCTIVE: drops and recreates the target database, permanently
# discarding whatever is currently in it. Only run this when you actually
# mean to replace live data with the contents of the dump file. ***
#
# Usage:
#   bash scripts/restore-backup.sh <dump-file.sql>       # interactive confirm
#   bash scripts/restore-backup.sh <dump-file.sql> -y    # skip the prompt
#
# Targets deploy/docker-compose.yml's `db` service by default, via
# `docker compose exec`. To target a container directly instead (e.g.
# local dev's standalone `stlab-db` container), set DB_CONTAINER:
#   DB_CONTAINER=stlab-db bash scripts/restore-backup.sh <dump-file.sql>
#
# DB_USER / DB_NAME also override (default: stlab / stlab).
#
# Before restoring in production, stop the app first (see deploy/README.md)
# so it can't hold open connections or write during the restore.
set -euo pipefail

DUMP_FILE="${1:-}"
CONFIRM_FLAG="${2:-}"

if [ -z "$DUMP_FILE" ]; then
  echo "Usage: $0 <dump-file.sql> [-y]" >&2
  exit 1
fi
if [ ! -f "$DUMP_FILE" ]; then
  echo "Error: dump file not found: $DUMP_FILE" >&2
  exit 1
fi

DB_USER="${DB_USER:-stlab}"
DB_NAME="${DB_NAME:-stlab}"
COMPOSE_FILE="$(dirname "$0")/../deploy/docker-compose.yml"

if [ -n "${DB_CONTAINER:-}" ]; then
  psql_exec() { docker exec -i "$DB_CONTAINER" psql -v ON_ERROR_STOP=1 -U "$DB_USER" "$@"; }
else
  psql_exec() { docker compose -f "$COMPOSE_FILE" exec -T db psql -v ON_ERROR_STOP=1 -U "$DB_USER" "$@"; }
fi

echo "About to restore:  $DUMP_FILE"
echo "Into database:     $DB_NAME"
echo "THIS WILL PERMANENTLY DELETE ALL CURRENT DATA in '$DB_NAME' and replace it with the dump."
echo

if [ "$CONFIRM_FLAG" != "-y" ] && [ "$CONFIRM_FLAG" != "--yes" ]; then
  read -r -p "Type 'yes' to proceed: " ANSWER
  if [ "$ANSWER" != "yes" ]; then
    echo "Aborted — no changes made."
    exit 1
  fi
fi

echo "Terminating other connections to '$DB_NAME'..."
psql_exec -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '$DB_NAME' AND pid <> pg_backend_pid();" \
  || true   # fine if there were none, or the DB doesn't exist yet

echo "Dropping and recreating '$DB_NAME'..."
psql_exec -d postgres -c "DROP DATABASE IF EXISTS \"$DB_NAME\";"
psql_exec -d postgres -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\";"

echo "Restoring dump into '$DB_NAME'..."
if psql_exec -d "$DB_NAME" < "$DUMP_FILE"; then
  echo
  echo "RESTORE OK: $DUMP_FILE is now live in '$DB_NAME'."
else
  echo
  echo "RESTORE FAILED: '$DB_NAME' may be partially restored and inconsistent." >&2
  echo "Do not consider the app safe to use until this is resolved." >&2
  exit 1
fi
