# Network notes

Topology: main router -> core switch -> { R730 server, WiFi router,
4 lab switches (2 labs each, 8 labs total) }. AI Lab = 12 wired PCs on switch 1.

Known risk: WiFi shares the flat network with the server. Personal devices
can currently reach it. Fix before go-live:
1. ufw on the R730 — allow port 3000 only from lab subnets (see deploy/README.md)
2. Move WiFi onto a guest/isolated network or VLAN when router access allows

iDRAC: connected on its dedicated port; keep its IP off the WiFi-reachable
range, change default credentials.
