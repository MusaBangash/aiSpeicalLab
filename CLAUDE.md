# STLab — orientation for Claude Code

Read this first. `docs/01-vision.md` through `docs/05-implementation-notes.md`
hold the specs and decisions; this file is the "what's actually built and
where things stand right now" summary, kept current across sessions.

## What this is

Learning system for a 12-PC AI Engineering Lab (Muslim Hands, Wazirabad),
Next.js 15 App Router + TypeScript + Prisma/PostgreSQL, running on a LAN
server that may be offline. Two roles: STUDENT and TEACHER.

## Status: v1 core is built and working, plus three rounds of exam-management upgrades, plus all 4 phases of an advanced-attendance initiative (complete)

Everything below has been implemented **and live-verified** (not just
written) — logged in, exercised via curl against the running dev server,
checked against the database. Nothing here is "should work."

**v1 core**: auth (Auth.js v5 credentials), the exam engine (draw/start/
resume/answer/finish/cooldown/sealing, all in `src/lib/exam.ts`), full
student exam flow (list → timed take screen → animated result), teacher
exam flow (create → question bank → results), attendance (heartbeat
auto-marking + teacher override + heatmap + dev simulator), settings
(profile/password/language/preferences), both dashboards. Design system
hand-ported from `docs/design/*.html` as plain global CSS (no Tailwind),
self-hosted fonts (no CDN).

**Round 2 — teacher exam management**: list filters/sort, edit exam
settings (previously impossible post-creation), delete (draft + zero
attempts only) vs. archive (anything with history), duplicate exam,
bulk-paste questions (`src/lib/questionParser.ts` — `Q: / A)-D) / *`
template) and PDF upload (`pdf-parse` v2, local text extraction, no
AI/network), results search + CSV export + print-to-PDF, full mobile
responsive pass (`src/components/shell/MobileNav.tsx`, 840px/560px
breakpoints).

**Round 3 — exam integrity & polish**: per-student option-order
randomization (`seededShuffle` in `exam.ts`, deterministic per
attempt+question, no schema change), teacher preview mode (creates zero
attempts), question-bank reorder/duplicate/bulk-retire, per-question
difficulty stats, exam availability window (`opensAt`/`closesAt` —
blocks *starting* new attempts only, never blocks finishing one already
in progress), printable exam paper (handout or answer-key toggle),
bank search, unsaved-changes warning (tab-close only — see limitation
below), and an accessibility pass (dialog focus-trap + Escape, switch
semantics on `Toggle`, mobile-nav focus management, two real unlabeled-
input bugs fixed).

**Advanced attendance — phase 1 (login-triggered check-in, 2026-07-21)**:
attendance is now marked the instant a student authenticates, not just on
the next 60s heartbeat — `authorize()` in `src/lib/auth.ts` calls
`markPresentIfUnset()` (`src/lib/attendance.ts`), which the heartbeat route
now also calls, so both are two callers of one create-only, first-wins-
per-day operation (never overwrites a teacher override or an earlier
same-day mark). Two new `Attendance` columns: `checkedInAt` (real
instant, deliberately **not** run through `startOfDay()` — that's only for
the `@db.Date` bucket) and `source` (`AUTO`/`MANUAL` — the override route
always sets `MANUAL`, letting the teacher UI show an "auto · HH:MM" badge
that disappears the moment a row is overridden). Gated to
`role === "STUDENT"` and wrapped in try/catch so a marking failure can
never block login. Live-verified end-to-end via curl against the running
dev server + direct DB checks: row creation, idempotency on a second
same-day login, teacher-override flipping `source`, and the heartbeat
path still working post-refactor.

**Advanced attendance — phase 2 (holistic student metrics, 2026-07-21)**:
teachers can now log dated, append-only journal entries per student
across three categories (`JournalCategory`: `PARTICIPATION`/`BEHAVIOUR`/
`EXTRA_ACTIVITY`, 1-5 rating + optional note) via a new `JournalEntry`
model, deliberately the opposite write-shape from attendance override
(plain `create`, never `upsert` — history is the point). New teacher nav
item "Students" → `/teacher/students` (roster with exam avg/attendance %)
→ `/teacher/students/[studentId]` (full profile + entry form + history).
The already-existing-but-stubbed `/student/progress` nav entry now shows
the same metrics read-only. Per an explicit scoping discussion: **no
blended overall score** — exam average, attendance %, and each category
average are shown side by side, never combined into one number; a
category average is always the mean of that student's own entries,
computed on read in `src/lib/metrics.ts` (`getStudentMetrics`,
`getAllStudentsSummary`), never stored. `getAvgExamScorePercent`
(`dashboard.ts`) and `getTermAttendancePercent`/`mondayIndex`
(`attendance.ts`) were extracted from inline duplicates so exam/attendance
math has one source of truth across dashboard, attendance page, and the
new metrics pages — confirmed byte-for-byte identical output before/after
via live curl checks. Live-verified end-to-end: entry creation (all 3
categories, with/without notes), category-average math (2+5 → 4.5,
checked against the actual rendered page), teacher/student views showing
identical numbers, 401 on a student POST to `/api/metrics/entries`, and
role-based redirect away from `/teacher/students`.

**Advanced attendance — phase 3 (app-focus/window-title activity
telemetry, 2026-07-21)**: teachers can now see, per student, what
app/window is currently focused and whether they're idle, on the same
`/teacher/students/[studentId]` profile page from phase 2. Stays strictly
within the ethics line already documented in `agent/README.md`
("application-level telemetry only... NO keystroke logging, NO
screenshots, NO webcam") — window titles are opaque strings, not URLs;
idle detection reads a single OS "time since last input" counter, not
key values. New segment-based `ActivitySegment` model (mirrors
`Session`'s open/close shape — a heartbeat matching the currently-open
segment's PC/app/title just bumps `lastSeenAt`; a different focus closes
the old segment and opens a new one), all in `src/lib/activity.ts`
(`recordActivity`, `closeStaleActivitySegments`, `getStudentActivity`).
Idle-threshold classification (`IDLE_THRESHOLD_SECONDS = 120`) lives in
TypeScript, not the Python agent, so it can change without redeploying to
12 PCs. Heartbeat route (`/api/agent/heartbeat`) gained three **optional**
fields (`focusedApp`/`windowTitle`/`idleSeconds`, all-or-nothing gated) —
fully backward compatible, confirmed live: an old-shape payload with no
telemetry fields still succeeds and writes zero `ActivitySegment` rows.

**Identity problem solved**: students roam between PCs (12 PCs, 12
students, not fixed 1:1 — different classes share the lab at different
times), so the agent can't use a fixed per-PC config. Instead it derives
the logged-in student **fresh every heartbeat** from the Windows
username, converted to an email via the exact same convention already
used in `prisma/seed.ts` (`firstname.lastname@student.stlab.local`) —
confirmed with the user that each student has their own individual
Windows account. This is read from the **foreground window's owning
process** (`agent/activity.py`), not the agent process's own owner, so it
works whether the agent runs in the student's session or as a background
service, and gives a free "nobody logged in" signal at the lock screen
(foreground window owned by SYSTEM there).

**`agent/agent.py` was a 17-line placeholder** (pseudocode + a print
statement) — now a real loop: load `config.json` → `activity.collect()`
→ POST heartbeat (10s timeout, caught `RequestException`, never crashes
the loop) → call `lockdown.enter`/`exit` per its existing contract
(`NotImplementedError` caught — `lockdown.py` itself intentionally stays
a scaffold, separate unrelated work) → sleep. `agent/requirements.txt`
gained `pywin32` (needed for `win32gui`/`win32process` foreground-window
APIs — `psutil` alone can't read window titles).

**Live-verified for real, not just type-checked**: this dev machine is
genuinely Windows, so `agent/activity.py` was actually executed
(`python -c "import activity; print(activity.collect())"` after
`pip install -r requirements.txt`) and correctly detected the real
foreground window/app/idle-time/derived-email on this machine — not a
mock. That real payload was then POSTed through the actual heartbeat
route and confirmed to create/update/close `ActivitySegment` rows
correctly (same-focus → update in place, different-focus → close +
new row), rendered correctly on the teacher profile page ("Activity" /
"Recent sessions" sections), and the dev simulator
(`scripts/simulate-heartbeats.ts`, now emitting fake telemetry) was run
end-to-end with no errors.

This is phase 3 of 4 — phase 4 (on-demand screen-view) followed and is
documented below.

**Attendance fix (`Attendance.sessionId` now actually populated,
2026-07-21)**: this field existed in the schema ("triggering session, if
auto-generated") but neither writer ever set it — a real gap, found
during a review. Fixed: `markPresentIfUnset` (`src/lib/attendance.ts`)
now takes an optional `sessionId` param, set directly on creation when
given (the heartbeat route passes its `Session.id`; the login trigger in
`auth.ts` still passes none, since a web login isn't tied to a PC session
yet), and **backfilled** onto an already-existing row that doesn't have
one yet (e.g. login fires first with no session, then a heartbeat
arrives later that day) — but only while still unset, so it always
reflects the first Session known to overlap that day's auto-mark, never
overwritten by a later one. `checkedInAt`/`status`/`source` are
untouched by this — same create-only semantics as before, just one more
field now correctly wired. Live-verified all three paths: fresh heartbeat
(sets immediately), pre-existing login-created row (backfills on next
heartbeat), and login-only with no heartbeat yet (correctly stays null).

**Attendance UI overhaul (card grids + filters + login toast,
2026-07-21)**: `/teacher/students` and `/teacher/attendance` were flat
lists with no filtering — user feedback was "hard to read... need more
visual, professional." Both are now card grids reusing the previously
**dormant** `.mod-grid`/`.mod-card` CSS (built for a "Curriculum" module
grid that was never actually used — same dormant-CSS-reuse pattern as
phase 2's `.prog-rows`). `StudentsGridClient.tsx` adds search, sort
(name/exam-avg/attendance, metric sorts lowest-first to surface at-risk
students), and an "at risk" toggle (`RISK_THRESHOLD_PERCENT = 60`, either
metric trips it). `AttendanceGridClient.tsx` adds search + a status
filter (All/Present/Late/Absent/Excused/Not marked) — filtering is based
on each row's **server-fetched initial status**, deliberately not the
live per-row state inside `AttendanceOverrideRow`, so a card never
vanishes out from under a teacher mid-edit (same simplification
`ExamListClient` already makes). `AttendanceOverrideRow.tsx` was
restyled as a card (status-color dot reusing the exact heatmap legend
mapping) with **zero logic changes** — same fetch/state as before.

Also added: a **toast notification** on student login confirming
attendance was marked, with status + date + time — non-blocking,
auto-dismissing (~5s), not a modal. Data flow (validated, not just
assumed): `LoginForm.tsx` sets a `sessionStorage` flag right before
redirecting (NextAuth's JWT/session is long-lived and would wrongly
re-fire the toast on every later page load if the fact lived there
instead — confirmed `src/app/page.tsx`'s role redirect is hardcoded with
no query-string forwarding, ruling out a query-param approach too).
`AttendanceToast.tsx` (mounted once in `student/layout.tsx`, as a sibling
of `AppShell`, not inside `{children}`, so it lives in the persistent
layout rather than remounting per navigation) reads the flag once, clears
it immediately, and fetches the new **`GET /api/attendance/today`**
route (student-only guard, read-only) for the actual current status/time
to show — never hardcodes "Present," since a teacher override could have
already changed the real status by the time of a later same-day login.

**Bug hit and fixed during this work**: importing the `initials()` avatar
helper from `AppShell.tsx` into the new client components broke the
server/client boundary — `AppShell.tsx` transitively imports
`SignOutForm.tsx`, which defines an inline `"use server"` Server Action,
and Next.js rejects that once it's pulled into a Client Component's
dependency graph (crashed every page with a 500). Fixed by extracting
`initials()` into a new dependency-free `src/lib/initials.ts`, imported
by `AppShell.tsx` and both new client components — no component should
import from `AppShell.tsx` itself except the layouts that render it.

**Journal entry edit/delete with a permanent audit trail (2026-07-21)**:
the user stated STLab's real target is 200+ schools eventually (this lab
is just the pilot), which raised the bar on this specific feature —
correcting or removing a `JournalEntry` **never** hard-mutates or
hard-deletes a row. `JournalEntry` gained `retractedAt` (soft-delete) and
`supersedesId` (self-relation, `@unique` — one entry corrects at most
one other). Editing creates a **new** row with `supersedesId` pointing at
the original; the original's fields are never touched. Deleting just
sets `retractedAt` on that exact row. An entry is "active" (counts
toward category averages, shown by default) when `retractedAt` is null
AND no other not-retracted entry supersedes it — computed in
`src/lib/metrics.ts`'s `getStudentMetrics` on every read, never stored.
**Confirmed, non-obvious behavior**: deleting a *correction* "revives"
whatever it corrected (e.g. 3/5 corrected to 5/5, then the correction is
deleted → the entry goes back to showing 3/5) — this is what the
active-set algorithm naturally produces, and was explicitly confirmed
with the user as the desired behavior, not an accident. Only the
authoring teacher can edit/delete their own entries
(`session.user.id === entry.teacherId`, enforced in
`src/app/api/metrics/entries/[entryId]/route.ts`'s `PATCH`/`DELETE`, not
just hidden in the UI) — a second teacher gets 403, a student gets 401.
Teacher UI (`JournalHistoryList.tsx`/`JournalEntryCard.tsx`) has a "Show
retracted/edited entries" toggle (client-side, no extra fetch — all
entries are always fetched, just filtered by computed status) with
"Corrected from X/5"/"Retracted"/"Edited" badges; the student's own
`/student/progress` view is deliberately unchanged — filtered to active
entries only, no history toggle, no edit/delete, so students can't reach
the audit UI at all. Live-verified end-to-end via curl: create → correct
→ confirm original row unchanged in DB → second edit on the
now-superseded original correctly 400s → cross-teacher 403 → student 401
→ delete the correction → confirm the original reverts to active with
its original rating and the category average recomputes correctly.

**Advanced attendance — phase 4 (on-demand teacher screen-viewing,
2026-07-21) — final phase, initiative complete.** The most ethically
sensitive phase: live screen-viewing is functionally continuous
screenshots, directly bordering `agent/README.md`'s prior "NO
screenshots" line. Built with explicit, non-negotiable guardrails
confirmed with the user before any code was written:

- **Mandatory on-screen student indicator, no exceptions.** Whenever a
  teacher is viewing, the agent shows an unclosable, always-on-top red
  banner ("🔴 Your screen is being viewed by a teacher") via a new
  `agent/overlay.py` (Tkinter) — renders regardless of what app the
  student has focused. No toggle to hide it in any code path.
- **Ephemeral by default.** Live frames (~1.5s polling cadence, not
  real-time video — this app has no websocket infra anywhere and one
  wasn't introduced just for this) live only in an in-memory `Map` on
  the server (`src/lib/screenView.ts`, same `globalThis`-survives-HMR
  pattern as `db.ts`'s Prisma singleton) — never touch the DB or disk
  unless a teacher clicks **"Save this session"** (explicit, one-way;
  no un-save). Only from that click forward are frames written to disk
  (`src/lib/screenStorage.ts` — **the first filesystem-writing code
  anywhere in this app**; JPEGs live outside `public/` and `.next/`,
  metadata-only in Postgres, to avoid DB/backup bloat).
- **Indefinite retention, confirmed after being shown the tradeoff** —
  no auto-delete. Flagged in code/docs as worth revisiting before a real
  200+-school rollout, not silently treated as permanent.
- **Only the saving teacher can view a saved recording** — same
  ownership pattern as journal-entry edit/delete
  (`recording.teacherId === session.user.id`).

**A real correctness bug was found and fixed during planning, not in the
original ask**: if only a teacher's own "Stop viewing" click ended a
session, closing the browser tab (crash, navigation away) would leave
the agent capturing and the mandatory overlay showing *forever* — a
genuine privacy bug, not an edge case. Fixed: the teacher's own `/live`
poll is the actual liveness signal (bumps `lastViewedAt`); the
agent-facing `/status` route self-closes a session whose `lastViewedAt`
has gone stale (~8s, or 15s if never polled) — bounding the overlay's
worst-case "stuck on" time to about one agent poll cycle. A coarser 90s
cron-sweep backstop (`closeStaleScreenViewSessions`, wired into
`/api/cron/sweep` alongside the other three stale-cleanup calls) covers
the agent itself going fully offline.

**Threading model**: `agent/agent.py` was restructured — Tkinter's
`mainloop()` now owns the main thread (required for thread-safety); the
existing 60s heartbeat loop and a new ~2s screen-view poll loop became
background daemon threads, communicating with the Tkinter thread only
via a `threading.Event`, never touching a widget cross-thread.
`agent/screen.py` captures via `PIL.ImageGrab` (Pillow was already
needed to encode JPEG, so no second capture library like `mss`) —
primary monitor only, resized to 1280px wide, quality 55.

**Live-verified for real** (same bar as phase 3): actually executed
`screen.py`'s `capture_jpeg()` on this real Windows dev machine (valid
1280×720 JPEG, correct magic bytes) and `overlay.py`'s `run()` through a
full show→hide→exit cycle with no exceptions (genuinely rendered on this
live desktop for the test's ~2.5s window — visual styling itself needs
your own eyes, no screenshot tool available here). End-to-end via curl:
full start→poll-status→upload-frame→teacher-live-poll pipeline with a
real captured JPEG (byte-identical round trip, confirmed via magic
bytes); Save → confirmed a `ScreenRecordingFrame` row *and* a file on
disk appear only from that point forward, and a frame uploaded *before*
Save creates zero DB/disk rows; the self-healing staleness fix itself
got accidentally-then-deliberately verified (a 42s gap between two
manual test polls, past the real testing session's wall-clock time,
correctly auto-closed the session); cross-teacher 409 (concurrent view
attempt) and 403 (live/save/end/frame-read on someone else's session);
student and missing-agent-key requests both correctly 401 across every
endpoint.

## Dev environment

- Postgres runs in a local Docker container (`stlab-db`), not on the host.
- `.env` is already configured with a working local `DATABASE_URL`.
- **On Windows, stop the dev server (`taskkill //F //PID <node pids>`)
  before running any `prisma migrate` — the Windows file-lock on the
  query engine DLL will EPERM the client regeneration otherwise.**
- **`npm run build` and `npm run dev` fight over `.next/` — always
  `rm -rf .next` and restart dev after a production build.**
- Login: teacher `bangash@stlab.local` / `change-me-123`; 12 students
  `firstname.lastname@student.stlab.local` / `change-me-123` (e.g.
  `ahmad.ali@student.stlab.local`) — see `prisma/seed.ts` for the full
  name list.

## Conventions to keep following

- **All exam rules live in `src/lib/exam.ts` only.** API routes and pages
  call it, never reimplement scoring/timing/retake logic.
- **Styling is plain global CSS**, classes in `src/styles/*.css`, tokens
  in `tokens.css`. No Tailwind, no CSS-in-JS, no component library.
- **No CDN / external API calls at runtime** — offline-LAN constraint.
  This killed one idea already (AI-based PDF question extraction);
  local text-extraction + a hand-written parser was used instead.
- Every teacher-only API route repeats the same inline
  `auth()` + `role !== "TEACHER"` → 401 guard — no shared middleware
  wrapper exists for this, intentionally (see `docs/05-implementation-notes.md`
  for why route-level checks were kept explicit).
- Migrations so far: `add_user_preferences`, `add_question_order`,
  `add_exam_availability_window`, `add_attendance_checkin_tracking`,
  `add_journal_entries`, `add_activity_segments`,
  `add_journal_entry_audit_trail`, `add_screen_view_sessions` — all
  additive, no renames.
- `var/screen-recordings/` (saved screen-recording JPEGs, phase 4) is
  gitignored and needs its own Docker volume in production — see
  `deploy/docker-compose.yml`'s `screen_recordings` volume. Never treat
  it as disposable/regeneratable — it's the only copy of saved
  recordings, kept indefinitely by design.
- **`prisma migrate dev` refuses to run at all in a non-interactive shell
  once it has ANY warning to confirm** (e.g. adding a unique constraint,
  even a safe one on an all-NULL nullable column) — it hard-errors
  "environment is non-interactive," not even `--create-only` gets past
  it. Workaround that worked: `npx prisma migrate diff --from-url "$DATABASE_URL" --to-schema-datamodel prisma/schema.prisma --script`
  to get the exact SQL, hand-write it into a normally-named
  `prisma/migrations/<timestamp>_<name>/migration.sql`, then
  `npx prisma migrate deploy` (non-interactive by design) to apply it,
  then `npx prisma generate`. Keeps migration history identical to what
  `migrate dev` would have produced.

## Known gaps / things to check next session

Phases H (unsaved-changes warning) and I (accessibility: focus trap,
Escape-to-close, keyboard nav, switch semantics) are fully verified as of
2026-07-21 — code-level review found no logic issues, and the user
confirmed a manual live click-through in a real browser. No longer a gap.

- In-app navigation (clicking a `<Link>`) is **not** covered by the
  unsaved-changes warning — only tab close/refresh. Documented
  limitation, not a bug.
- `src/app/api/agent/session/route.ts` is still a 501 stub by design —
  real agent lockdown is out of scope for v1; only the heartbeat
  contract (`/api/agent/heartbeat`) needs to work, and it does.
- Saved screen recordings (phase 4) are retained **indefinitely** by
  confirmed decision — no auto-delete anywhere. Worth a real retention
  policy (e.g. auto-expire after N days) before this goes to 200+
  schools; not urgent for the single-lab pilot, but don't let it slide
  silently once real deployment planning starts.

## Where to look for more detail

- `docs/02-exam-spec.md` — the locked exam rules spec.
- `docs/05-implementation-notes.md` — decisions made during the build
  that the specs didn't cover (routing restructure, the Postgres
  `@db.Date` UTC-truncation bug and its fix, JWT/Edge-runtime
  constraint, etc.) — read this before touching auth, dates, or
  attendance.
- `docs/design/*.html` — the approved visual mockups everything is
  ported from.
