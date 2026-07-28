# Go-live checklist — first real deploy to the R730

Everything in this list has been verified as far as it *can* be verified
without the real hardware — a local dry-run of `deploy/docker-compose.yml`
found and fixed 3 real bugs (missing `.dockerignore`, undocumented
`DB_PASSWORD`, an Auth.js `trustHost` production-mode failure), and a
whole-codebase security/permissions audit found no HIGH/MEDIUM
vulnerabilities. What's left is the category that only real hardware and
real people can close. Do these in order — each step reduces the risk of
the next one.

Mechanical install steps (Docker install, `.env` setup, `docker compose
up -d`) are already documented in `deploy/README.md` — this checklist
doesn't repeat them, it wraps around them.

## 1. First real boot on the R730

- [ ] Follow `deploy/README.md` steps 1-4 on the actual R730 (Ubuntu 24.04),
      not a local dry-run substitute.
- [ ] Generate real secrets for this deployment — do not reuse anything
      from a dry-run or dev `.env`:
      - `DB_PASSWORD`: `openssl rand -hex 24` (must be hex, not base64 —
        base64's `/`/`+`/`=` break the connection string; this was a real
        bug found and fixed during the dry-run round).
      - `AUTH_SECRET`: `openssl rand -base64 32`.
      - `AGENT_API_KEY`: any string, but it must exactly match what gets
        put in every lab PC's `agent/config.json`.
      - `NEXT_PUBLIC_APP_URL`: the R730's real LAN IP, e.g.
        `http://192.168.1.10:3000`.
- [ ] Confirm `docker compose ps` shows all 3 services (`db`, `app`,
      `backup`) `Up`, not restarting.
- [ ] Confirm migrations applied automatically — `docker compose logs app`
      should show "All migrations have been successfully applied."
- [ ] Seed the fresh database exactly once:
      `docker compose exec app npx prisma db seed`.
- [ ] Log in for real, from a real browser on the LAN (not just curl) —
      confirm the teacher account works end to end: dashboard loads,
      a page navigation works, no `UntrustedHost` or other 500s.
- [ ] Apply the `ufw` rules from `docs/03-network.md` and confirm the app
      is still reachable from a lab PC's IP *after* enabling the firewall
      (not just before) — a firewall rule that looks right on paper can
      still lock out the wrong subnet.

## 2. Backup: prove the log, then prove a real restore

- [ ] Let the `backup` service run its first automatic nightly cycle
      (or force one — see `deploy/README.md`'s "Verifying backups"
      section) and confirm `backups/backup.log` shows a real
      `OK`/`VERIFY OK` pair against the R730's own data, not a dry-run's.
- [ ] **Do one supervised, human-run restore drill** on the real
      deployment before relying on it in an emergency — walk through
      `deploy/README.md`'s "Restoring from a backup" section by hand,
      end to end, with whoever will actually be the on-call person for
      this school. A script printing "RESTORE OK" during a dry-run is not
      the same as a person successfully following the runbook under
      pressure the one time it actually matters.
- [ ] Do the first weekly offsite copy (`deploy/README.md`'s "Copying
      backups offsite" section) for real, and confirm whoever's
      responsible for it knows where the drive lives and how often.

## 3. Decide on TLS — consciously, not by default

The app currently runs plain HTTP over the LAN (confirmed: no TLS
termination anywhere in `deploy/docker-compose.yml`). Login credentials
and session cookies travel in cleartext. The existing threat model
(`docs/03-network.md`) treats the LAN as trusted and firewalls WiFi away
from it — a defensible position for a first pilot, but it should be a
decision made once, explicitly, not an accidental omission:

- [ ] Either explicitly accept plain HTTP for this pilot (write the
      decision down somewhere, e.g. here or in `docs/03-network.md`), or
- [ ] Add a TLS-terminating reverse proxy (e.g. Caddy) in front of `app`
      — if you do this, `trustHost: true` in `src/lib/auth.ts` will need
      revisiting (a reverse proxy changes what "trusted host" means;
      likely needs `AUTH_URL` set explicitly plus forwarded-header
      handling instead of blanket trust).

## 4. Prove the lab agent works from a real second machine

Every previous round's agent verification ran against this same dev
machine — never a genuinely separate PC talking to the R730 over the
real network.

- [ ] Install `agent/` on one real lab PC (not the R730 itself), fill in
      `agent/config.json` with the real `AGENT_API_KEY` and the R730's
      real LAN IP.
- [ ] Confirm a heartbeat actually lands — check the teacher-facing
      attendance/activity views show that PC's real activity, not just
      that the agent process didn't crash.
- [ ] Confirm the lockdown/screen-view flow (if in use) end to end from
      that same real PC.
- [ ] Only after this works from one real PC, roll out to the remaining
      lab PCs.

## Already verified, not blocking go-live

- Automated test suite (98 tests) + CI gate green on GitHub Actions.
- Backup/restore *mechanics* (dump, restore, drill-verify) — proven
  against real data in a local dry-run; step 2 above is about proving
  the *process*, not the code, on the real box.
- Security/permissions audit — no HIGH/MEDIUM findings across all 55 API
  routes, the 3 file-serving subsystems, and the agent shared-secret
  mechanism.
