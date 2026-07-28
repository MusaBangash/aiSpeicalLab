# Deploying on the R730 (Ubuntu 24.04)

1. Install Docker: `curl -fsSL https://get.docker.com | sh`
2. Clone this repo to `/opt/stlab`
3. `cp .env.example .env` and fill DB_PASSWORD, AUTH_SECRET, AGENT_API_KEY
4. `cd deploy && docker compose up -d`
5. Firewall (the WiFi-isolation fix from docs/03-network.md):
   ```bash
   ufw default deny incoming
   ufw allow from 192.168.1.0/24 to any port 3000   # lab subnet only
   ufw allow OpenSSH
   ufw enable
   ```
Backups land in `backups/` daily, kept 30 days, and are automatically
restore-tested the moment each one is created (see "Verifying backups" below).

### Dry-run before go-live

Before running this on the real R730, validate the stack locally first —
see CLAUDE.md's dated entry for the exact throwaway-env, `-p stlab-dryrun`
dry-run procedure (build-context size check, auto-migration, one manual
seed, a real login, and one forced backup cycle).

## Restoring from a backup

**This permanently overwrites all current data — only do this when you actually
intend to replace live data with an older backup** (disaster recovery, or undoing
a bad migration).

1. Stop the app so it can't write during the restore:
   ```bash
   cd /opt/stlab/deploy
   docker compose stop app
   ```
2. Run the restore script from the repo root, pointing at the dump to restore
   (dumps live in `backups/`, named `stlab-YYYY-MM-DD.sql`):
   ```bash
   cd /opt/stlab
   bash scripts/restore-backup.sh backups/stlab-2026-07-27.sql
   ```
   Type `yes` when prompted. Only use `-y` instead of the interactive prompt when
   you're scripting this deliberately (e.g. a rehearsed DR drill).
3. Restart the app:
   ```bash
   cd deploy && docker compose start app
   ```
4. Confirm the app actually shows the restored data (log in, check a known record) —
   a script printing "RESTORE OK" is not the same as the app actually working.

## Verifying backups

Every nightly dump is automatically restore-tested the moment it's created —
`scripts/backup-loop.sh` (run by the `backup` service) restores each night's dump
into a disposable "drill" database on the same Postgres instance (never touching
the real `stlab` database), confirms the `User` table exists with rows, then drops
the drill database. Results land in `backups/backup.log`:
```bash
cat /opt/stlab/backups/backup.log
```
A `FAILED` or `VERIFY FAILED` line means that night's dump is not trustworthy —
investigate immediately (disk space, `docker compose logs backup`, whether `db`
was reachable that night) rather than waiting until a real restore is needed.

To manually verify any specific dump file on demand — recommended **once a month,
against the newest file on the offsite drive** (see below), to prove the *copy*
survived intact, not just what's still on the R730's disk:
```bash
cd /opt/stlab
bash scripts/verify-backup.sh backups/stlab-2026-07-20.sql
```

## Copying backups offsite (weekly, manual)

A backup only protects against data loss if a copy exists somewhere other than
the R730 itself. This is deliberately manual and local — no cloud, no network
sync (this app runs fully offline).

Every week:

1. Plug in the dedicated offsite USB drive.
2. Copy the dump files across:
   ```bash
   cp /opt/stlab/backups/stlab-*.sql /media/<usb-drive-name>/stlab-backups/
   ```
   (copying everything still on disk, not just the newest, is fine — `cp` won't
   duplicate a filename already copied in a prior week.)
3. Confirm the copy actually landed before unplugging the drive:
   ```bash
   ls -la /media/<usb-drive-name>/stlab-backups/ | tail -5
   ```
   The newest file's date should match today's (or yesterday's) dump.
4. Unplug the drive and store it somewhere physically separate from the
   server — a different room or building. A copy sitting next to the R730
   doesn't protect against fire, theft, or a hardware failure taking out both
   at once.
5. Record that this happened, e.g. append a line to a log file kept on the
   drive itself:
   ```bash
   echo "$(date -Iseconds) copied by <name>" >> /media/<usb-drive-name>/stlab-backups/copy.log
   ```

To confirm later that this has actually been happening (not just assumed):
plug the drive in and check the newest filename's date —
```bash
ls -t /media/<usb-drive-name>/stlab-backups/stlab-*.sql | head -1
```
If it's more than ~10 days old, the weekly copy has been missed and needs to
happen now.
