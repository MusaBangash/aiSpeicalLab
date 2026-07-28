#!/bin/sh
# Nightly backup loop for the `backup` service in deploy/docker-compose.yml.
# Runs inside a plain postgres:17 container with no Docker CLI/socket — it
# can only reach Postgres over the network (`-h db`), it cannot spin up
# other containers or call scripts/verify-backup.sh (which needs `docker`
# on the host). This is the in-container equivalent of that same drill.
#
# Each cycle: dump -> confirm non-empty -> restore into a disposable
# "drill" database on the same Postgres instance -> sanity-check it ->
# drop the drill database -> log every step's outcome to /backups/backup.log
# so `cat backups/backup.log` on the host shows history without needing
# `docker logs backup`.
set -u

LOG=/backups/backup.log
DRILL_DB=stlab_verify_drill

log() {
  printf '%s %s\n' "$(date -Iseconds)" "$1" >> "$LOG"
}

while true; do
  DUMP_FILE="/backups/stlab-$(date +%F).sql"

  if pg_dump -h db -U stlab stlab > "$DUMP_FILE" 2>>"$LOG" && [ -s "$DUMP_FILE" ]; then
    log "OK dump=$DUMP_FILE size=$(stat -c%s "$DUMP_FILE")"

    dropdb -h db -U stlab --if-exists "$DRILL_DB" 2>>"$LOG"
    if createdb -h db -U stlab -O stlab "$DRILL_DB" 2>>"$LOG" \
        && psql -h db -U stlab -v ON_ERROR_STOP=1 -d "$DRILL_DB" < "$DUMP_FILE" >>"$LOG" 2>&1; then
      ROW_COUNT=$(psql -h db -U stlab -tA -d "$DRILL_DB" -c 'SELECT COUNT(*) FROM "User";' 2>>"$LOG")
      if [ -n "$ROW_COUNT" ] && [ "$ROW_COUNT" -gt 0 ] 2>/dev/null; then
        log "VERIFY OK dump=$DUMP_FILE rows=$ROW_COUNT"
      else
        log "VERIFY FAILED dump=$DUMP_FILE (User table missing or empty)"
      fi
    else
      log "VERIFY FAILED dump=$DUMP_FILE (restore into drill DB failed)"
    fi
    dropdb -h db -U stlab --if-exists "$DRILL_DB" 2>>"$LOG"
  else
    log "FAILED dump=$DUMP_FILE (pg_dump error or empty output)"
  fi

  find /backups -name "stlab-*.sql" -mtime +30 -delete
  sleep 86400
done
