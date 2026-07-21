# STLab — AI Engineering Lab System

The learning system for the Special Technician AI Lab at Muslim Hands, Wazirabad.
Runs entirely on the lab's own Dell R730 server (Ubuntu 24.04 + Docker).
Serves 12 student PCs, the teacher console, and the projector wall display over LAN.

## What's in this repo

| Folder            | What it is                                                        |
|-------------------|-------------------------------------------------------------------|
| `src/`            | The web app — Next.js 15 + TypeScript. Student portal, teacher console, and all APIs |
| `prisma/`         | Database schema (PostgreSQL) and seed data                        |
| `agent/`          | Python lab agent installed on each of the 12 student PCs — heartbeat, session tracking, exam lockdown |
| `dashboard-wall/` | Read-only projector view (live pulse grid) shown on the classroom wall |
| `deploy/`         | Docker Compose setup for the R730 — app + PostgreSQL + backups    |
| `scripts/`        | Operational scripts (database backup, PC registration)            |
| `docs/`           | Specs and design references, including the approved HTML mockups  |

## Current build focus (v1)

1. **Exams** — MCQ, taken on lab PCs, agent lockdown, teacher-set timer and
   cooldown, question bank with random draw, auto-save per answer, crash-resume,
   pass at 82%, latest score official with full attempt history. Spec: `docs/02-exam-spec.md`
2. **Attendance** — automatic from agent heartbeats, manual override for excused absences
3. **Settings** — profile, language (English/Urdu), preferences

Everything else (curriculum, exercises, progress, Socratic tutor, pulse grid)
is scaffolded but comes after these three are solid.

## Quick start (development)

```bash
cp .env.example .env        # fill in DATABASE_URL
npm install
npx prisma migrate dev      # creates the database tables
npx prisma db seed          # loads demo lab, students, and one exam
npm run dev                 # http://localhost:3000
```

## Production (on the R730)

See `deploy/README.md` — one `docker compose up -d` brings up the app,
PostgreSQL, and nightly backups.
