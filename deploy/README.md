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
Backups land in `backups/` daily, kept 30 days. Copy them off the server weekly.
