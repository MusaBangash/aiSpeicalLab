#!/usr/bin/env bash
# Manual on-demand database backup (in addition to the daily container).
set -e
docker compose -f "$(dirname "$0")/../deploy/docker-compose.yml" exec db \
  pg_dump -U stlab stlab > "backup-manual-$(date +%F-%H%M).sql"
echo "Backup written."
