# STLab — orientation for Claude Code

Read this first. `docs/01-vision.md` through `docs/05-implementation-notes.md`
hold the specs and decisions; this file is the "what's actually built and
where things stand right now" summary, kept current across sessions.

## What this is

Learning system for a 12-PC AI Engineering Lab (Muslim Hands, Wazirabad),
Next.js 15 App Router + TypeScript + Prisma/PostgreSQL, running on a LAN
server that may be offline. Two roles: STUDENT and TEACHER.

## Status: v1 core is built and working, plus three rounds of exam-management upgrades, plus all 4 phases of an advanced-attendance initiative (complete), plus phases 1-6 and 8 of a 10-phase "AI Learning DNA" roadmap (there is no phase 7 in the locked numbering)

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

**"AI Learning DNA" roadmap — phase 1 (Classes/Sections, 2026-07-22)**:
the first of a new 10-phase initiative (full plan in the auto-memory
file `stlab_phase5_roadmap.md` — read that before starting phase 2+).
Teachers can now group students into `Class`es instead of one flat
all-students list — new nav item "Classes" (`/teacher/classes` →
`/teacher/classes/[classId]`), the existing flat `/teacher/students`
page deliberately left untouched (confirmed decision, not an oversight).
A student belongs to exactly **one active enrollment at a time**, but
`ClassEnrollment` history is never overwritten or deleted — enrolling a
student into a new class automatically sets `leftAt` on their previous
active enrollment (if any) and creates a fresh row, mirroring the exact
"application-level, not DB-constraint" pattern already used for
`Session.endedAt`/`ScreenViewSession.endedAt` (no partial-unique-index
trickery). Re-enrolling into the *same* class a student is already
active in is a deliberate no-op — confirmed live: no duplicate row
created. `src/lib/classes.ts` centralizes all of this (`enrollStudent`,
`unenrollStudent`, `requireOwnedClass` for the shared ownership guard).
One new icon added (`people`, `Icon.tsx`) since none of the existing 22
icons was a real "group of people" glyph — deliberately not repurposing
an ill-fitting one. Class rename is supported; **delete is deliberately
out of scope this phase** — a meaningful delete/archive story depends on
later-phase concepts (per-class attendance history, phase 3) not built
yet. Live-verified end-to-end via curl: create two classes → enroll a
student into Class A → enroll the *same* student into Class B →
confirmed in the DB that Class A's row got `leftAt` set (preserved, not
deleted) while Class B's is fresh and active → confirmed both rosters
reflect the move → re-enroll into Class B again → confirmed zero new
rows (idempotent) → unenroll → confirmed the row survives with `leftAt`
set → cross-teacher 403 on rename/enroll/unenroll → student role 401 →
`/teacher/students` confirmed rendering identically, untouched.

**"AI Learning DNA" roadmap — phase 2 (student enrollment profiles +
console stats, 2026-07-22)**: teachers can now enroll new students
directly in-app (`POST /api/students`, `src/lib/students.ts`'s
`createStudent`) instead of only via the one-time `prisma/seed.ts`
script — full profile (father's name, contact, address, gender, course
type incl. free-text "other", paying/orphan/staff/other category,
day-scholar/hostelized residency, education level/status), an optional
photo, and an optional class assignment, all in one form
(`EnrollStudentForm.tsx` → `/teacher/students/new`). New 1:1
`StudentProfile` model (kept separate from `User` since none of these
fields apply to teachers) plus 4 new enums (`CourseType`,
`StudentCategory`, `Residency`, `Gender`). Password is auto-generated
(`generatePassword()`, CSPRNG via `node:crypto`'s `randomInt`, charset
excludes visually-ambiguous characters since a teacher reads it once off
a screen) and shown exactly once in a confirmation panel — never stored
in plaintext, never re-shown, no email system exists to send it instead.
Email uses the **same** `firstname.lastname@student.stlab.local`
convention as the seed script, but with a **global** regex replace
(`.replace(/\s+/g, ".")`) — the seed script's `.replace(" ", ".")` only
replaces the *first* space and silently breaks on 3+-word names; the new
code was confirmed live against a real 3-word name ("Zeeshan Tariq
Malik") to produce the fully-dotted email.

**Photo storage** (`src/lib/studentPhotoStorage.ts`) follows phase 4's
screen-recording precedent exactly: flat files on disk outside
`public/`/`.next/` (`var/student-photos/`, overridable via
`STUDENT_PHOTOS_DIR`), metadata-only (`photoPath`/`photoMimeType`) in
Postgres, served through `GET /api/students/[studentId]/photo`
(`runtime="nodejs"`, `readFile().catch(()=>null)` → 404). Deliberately
**not** re-encoded (no image-processing library exists in this stack)
and **not** ownership-restricted like screen recordings are — any
teacher can view any student's photo, matching the existing
profile-page's open-to-all-teachers convention. `.me-avatar` (initials)
is left untouched everywhere it already renders — the real photo only
appears on the two new surfaces (the enrollment form's live preview and
a new profile card on `/teacher/students/[studentId]`).

**A real ownership gap was found and closed during planning**:
`enrollStudent()` (from phase 1) does no ownership check on the class
being enrolled into — only the `/api/classes/[classId]/enroll` route
checks via `requireOwnedClass`. Left as-is, a teacher could have enrolled
a brand-new student straight into *another* teacher's class by passing
its `classId`. Fixed by calling `requireOwnedClass(classId, teacherId)`
as the first step inside `createStudent`, before any DB writes — live-
verified: a second teacher account attempting this via curl (passing the
`classId` directly, bypassing the picker) gets a 403.

**Console stats**: `getTeacherConsole` gained `girlsCount`/`boysCount`/
`hostelizedCount`/`dayScholarCount` (via `db.studentProfile.groupBy`),
rendered as a second row of 4 mini-cards on `/teacher/console`.
`Gender.OTHER` counts toward `studentCount` but not the girls/boys
buckets (one code comment, not user-facing). **Known, accepted
divergence, labeled in code**: these 4 counts only reflect students with
a `StudentProfile` row — the 12 pre-existing seeded students have none,
so they count toward `studentCount` but not toward any of the 4 new
stats; confirmed live (14 total students, only the 2 enrolled through
this new form appear in the gender/residency breakdowns).

Live-verified end-to-end via curl + direct DB checks: enrollment with a
photo and a real 3-word name (correct email, `bcrypt.compare` against
the returned plaintext password succeeds); photo round-trips
byte-identical through the serving route; a second enrollment assigning
a class produces a real `ClassEnrollment` row; cross-teacher 403 on
class assignment; `courseType=OTHER` without `courseTypeOther` correctly
400s; console stats match direct DB queries; `/teacher/students` and
`/teacher/students/[studentId]` render correctly with the new
button/profile card added. All test students, their profiles/photos,
and the temporary second teacher account used for the 403 check were
deleted after verification.

**"AI Learning DNA" roadmap — phase 3 (class schedules + automatic
on-time/late detection, 2026-07-22)**: each `Class` gained an optional
`scheduledStartMinutes` field (`Int?`, minutes since local midnight —
`prisma/schema.prisma`, migration `add_class_schedule`) — same start
time every weekday, no per-day-of-week granularity, null = opt-out
(existing behavior, always PRESENT). This is the **first time LATE gets
set automatically anywhere in the app** — until now it only ever came
from a manual teacher override (the `AttendanceStatus` enum already had
`LATE`, unused by any auto-mark path). A new pure helper
`determineAutoStatus(at, scheduledStartMinutes)` (`src/lib/attendance.ts`)
decides PRESENT vs LATE by comparing `at`'s local minutes-since-midnight
against the schedule plus a new `LATE_GRACE_MINUTES = 10` constant —
strictly-after the grace window, not at-or-after. `markPresentIfUnset`
now looks up the student's active `ClassEnrollment`'s class before its
existing create-only upsert and feeds the schedule into
`determineAutoStatus`; **neither of its two callers needed any change**
(`src/lib/auth.ts`'s login trigger, `src/app/api/agent/heartbeat/route.ts`)
since the schedule lookup lives entirely inside the function. Status is
still decided exactly once, at the first auto-mark event of the day,
never recalculated later that day — unchanged, deliberate semantics.
`getTermAttendancePercent`/`computeStreak` already treated LATE as
PRESENT-equivalent before this phase, so neither needed changes, and the
manual-override route (`src/app/api/attendance/override/route.ts`) is
completely untouched — it never calls `markPresentIfUnset`.

**Confirmed correct, not a timezone bug**: this deployment's server
clock is fixed Asia/Karachi (UTC+5, no DST — `docs/05-implementation-notes.md`),
and the whole app already treats JS `Date` local getters as authoritative
for "what time/day is it right now" (`startOfDay`, `isWeekend`,
`computeStreak`'s day-of-week logic). `determineAutoStatus` follows the
same convention (`at.getHours()*60 + at.getMinutes()`) — no `@db.Time`
column, no timezone conversion needed.

**Teacher UI**: `PATCH /api/classes/[classId]` (previously rename-only,
confirmed to have zero frontend callers before this phase) widened to a
tri-state `scheduledStartTime` field — key omitted leaves it untouched,
an `"HH:MM"` string sets it, `null` explicitly clears it back to
unscheduled. New `ClassScheduleForm.tsx` (native `<input type="time">`,
Save + a conditional Clear button) wired into
`/teacher/classes/[classId]`, reusing the existing `.journal-entry-form`/
`.btn`/`.btn ghost`/`.field-error` classes — no new CSS.

Live-verified end-to-end via curl + direct DB checks, all against the
real dev-machine clock (genuinely Asia/Karachi): a class scheduled well
in the past → an enrolled student's login auto-marked `LATE`/`AUTO`; a
class scheduled minutes-ago (within grace) → `PRESENT`; a student with
no active class enrollment → `PRESENT` regardless of time; an enrolled
student whose class has no schedule set → `PRESENT`; clearing a
previously-set schedule back to `null` → a subsequent late-in-the-day
login for that class now correctly yields `PRESENT` again; manual
override (`status: "LATE"`) still always-overwrites with
`source: "MANUAL"`, unaffected; the schedule form renders pre-filled
correctly and the Clear button only appears when a schedule is actually
set. All test classes/students/enrollments/attendance rows created for
verification were deleted afterward.

**"AI Learning DNA" roadmap — phase 4 (live class activity + bulk
attendance, 2026-07-22)**: the class detail page
(`/teacher/classes/[classId]`) gained two stacked sections between the
Phase 3 schedule form and the roster. **Live activity**: a new batch
`getClassActivity(studentIds)` (`src/lib/activity.ts`) — the batch
counterpart to the existing single-student `getStudentActivity` —
relies on `recordActivity`'s invariant that a student has at most one
`endedAt: null` `ActivitySegment` at a time, so one query
(`{ studentId: { in }, endedAt: null }`) covers the whole class, no N+1.
`toClassActivityPayload` centralizes the roster+activity → JSON mapping
so the server-rendered initial prop and the client poll response are
byte-identical in shape. `GET /api/classes/[classId]/activity` (new,
`requireOwnedClass`-guarded) is the poll target; `ClassLivePanel.tsx`
(new) mirrors `LiveScreenViewer`'s self-rescheduling `setTimeout` +
`cancelled`-flag pattern at a ~12s interval (vs. that component's 1.5s,
since this is a status poll, not a video stream) and embeds the
existing `<ScreenViewPanel studentId={...} />` unmodified per student
card as the "View screen" shortcut — no new screen-view route needed,
it was already a reusable inline component. `STALE_MINUTES` (5 min) went
from module-private to exported so both functions share one staleness
definition.

**Bulk attendance**: new `getClassAttendanceRows(classId, at)`
(`src/lib/attendance.ts`) composes `getClassRoster` + a scoped
`Attendance.findMany` into rows shaped exactly like
`AttendanceOverrideRow`'s existing props, so that component renders
completely unmodified inside the new `ClassAttendanceSection.tsx`. New
`POST /api/classes/[classId]/attendance/bulk` (`requireOwnedClass`-guarded,
`PRESENT`/`ABSENT` only, never bulk-LATE/EXCUSED) runs a
`db.$transaction([...])` **array** of independent per-student `upsert`s
(not the interactive callback form — no shared counter or
read-before-write dependency between students, unlike the exam
bulk-question-create route) and deliberately **omits `note` from the
update data**, so an existing note is never clobbered by a bulk
overwrite — confirmed live: a student manually set to `LATE` with a note
via the existing single-override route came out `PRESENT`/`ABSENT` after
a bulk action with the note fully intact. `ConfirmSheet` (existing,
reused unmodified) gates both buttons, `confirmVariant="leaf"` for
mark-all-present / `"coral"` for mark-all-absent. Date-range navigation
is explicitly out of scope this phase — the section always shows today
only (a later phase's job).

**One draft-plan correction made before implementation**: `.screenview-badge`
(`dashboard.css:872`) is `position: absolute`, meant to overlay the
screen-view frame image, not a general-purpose banner — the live
panel's "poll may be stale" notice uses plain inline-styled text
instead, avoiding a layout bug that would have shipped otherwise.

Live-verified end-to-end via curl + direct DB checks: an inserted open
`ActivitySegment` correctly reports `online:true` with the right
app/idle state; bumping `idleSeconds` past `IDLE_THRESHOLD_SECONDS`
flips `idle:true`; a segment whose `lastSeenAt` ages past
`STALE_MINUTES` correctly flips back to `online:false` (confirmed twice
— once by an intentional backdate, once *unintentionally* when a slow
test step let real time pass, both giving the same correct answer); a
student with zero segments ever also reports offline (the
default-map-entry path); bulk-present created a row for a
previously-unmarked student and overwrote a previously-`LATE` student to
`PRESENT` with the note preserved; bulk-absent repeated the same with
`ABSENT`; cross-teacher 403 on both new routes; the flat
`/teacher/attendance` page, `/api/attendance/override`, and a student
profile page's activity feed all confirmed rendering exactly as before
(only additive exports were made to `activity.ts`/`attendance.ts`); the
live panel and attendance section both confirmed rendering correctly in
the browser. All test classes/students/segments/attendance
rows/teacher accounts created for verification were deleted afterward.

**"AI Learning DNA" roadmap — phase 5 (attendance month view + student
journey page, 2026-07-22)**: two pieces, both built after resolving one
open design question with the user (month heatmap + jump-to-day, not a
bare date input or a full date-range mode).

**Attendance month view** (`/teacher/attendance`): a lab-wide month
heatmap sits above the existing, completely unchanged single-day
Prev/Next + `AttendanceGridClient` view. New `getLabMonthAttendanceCells`
(`src/lib/attendance.ts`) computes present-count ÷ total-student-count
per day, bucketed into the *same* `.hcell` `.p`/`.late`/`.a` classes the
per-student heatmap already used — reinterpreted as turnout magnitude,
not individual status (own legend wording to avoid conflating the two
meanings). A new `AttendanceDateJump.tsx` (native `<input type="date">`,
first date-picker anywhere in this app) and Prev/Next-**month** links sit
alongside it; every day cell links to `?date=` on the same page.

**Student profile page** (`/teacher/students/[studentId]`) gained, below
the existing snapshot `hero-grid`: a `StudentSummaryStrip` (joined date,
total days present, longest-ever streak, exams taken/passed), a
full-enrollment-history attendance heatmap (one `MonthHeatmapGrid` block
per calendar month from the student's real join date through today,
most-recent-first — no time cap), an `ExamScoreTrend` (hand-rolled inline
SVG polyline, no charting library — this app has none and none was
added), and a `JournalTimeline` (reuses the existing `JournalEntryCard`
unmodified, ACTIVE entries only — the full audit view still lives in
`JournalHistoryList` further down the same page, so active entries now
intentionally appear in two places).

**Shared presentational component**: `MonthHeatmapGrid.tsx` renders
either data source (lab-wide or per-student) without caring which —
it only ever sees `{ day, className, href? }[]`. `getStudentMonthAttendanceCells`
was extracted byte-identical from what used to be inline logic in
`/student/attendance/page.tsx`; that page now **fully delegates** its
month-card rendering to `MonthHeatmapGrid` too (not just the
cell-computation loop), so the card/grid markup is no longer duplicated
between the student-facing and teacher-facing heatmaps.

**Two genuinely new pieces of math, not reused from anywhere**:
`computeLongestStreak` (`src/lib/attendance.ts`) — a full **forward**
scan for the best-ever historical run of consecutive PRESENT/LATE
weekdays, deliberately separate from the existing `computeStreak` (which
only walks **backward** from today and stops at the first gap) — live-
verified to genuinely diverge: a student with a 10-day present run in a
past month and nothing recent shows `longestStreak: 10` while their
*current* streak is 0. **`getStudentJoinDate`** (`src/lib/classes.ts`)
uses `MIN(ClassEnrollment.joinedAt)` across **all** of a student's
enrollment rows, not their current active one and not `User.createdAt`
— live-verified: a student backdated to a June enrollment, then
re-enrolled into a different class in July (closing the June row via
`leftAt`, per existing `enrollStudent` behavior, never deleting it),
still correctly shows "Joined: 1 Jun 2026", and the profile page renders
two stacked month-heatmap blocks (July, then June) rather than just one.

**Exam score trend deliberately uses `ExamRecord`, not `ExamAttempt`**:
one point per exam (the "official record," consistent with how
`avgScorePercent` is already computed elsewhere), not every retry.
`getExamCounts` (`src/lib/dashboard.ts`) is a new sibling function, not a
reshape of the existing `getAvgExamScorePercent` — that function's plain
`number` return is already depended on by three other call sites.

Live-verified end-to-end via curl + direct DB checks: the extracted
per-student cell logic produces byte-identical status classes to a
manual DB cross-check (present/late/absent/excused all confirmed on
specific days); the lab-wide month view's turnout color matched a
hand-computed percentage (92.3% → high-turnout class) and a real weekend
day correctly showed no status modifier; the exam trend rendered a real
data point (not the empty state) for a student with a genuine
`ExamRecord`; the journal timeline rendered with correct CSS structure
alongside the untouched `JournalHistoryList` below it; both untouched
pages (`/teacher/attendance`'s single-day view, `/student/attendance`)
and the profile page all confirmed still rendering correctly after
cleanup. All test students/classes/enrollments/attendance rows created
for verification were deleted afterward.

**"AI Learning DNA" roadmap — phase 6 (one-way teacher → student
messaging, 2026-07-22)**: teachers can now send one-way announcements
(no reply/chat) to one specific student, one whole class, or all
students, with three urgency levels (normal/important/urgent). New
`Message` (the compose event — urgency, target type, body,
`retractedAt` for soft-delete) + `MessageRecipient` (one row per actual
recipient, with its own independent `readAt`) — the **first**
"one row per (broadcast, recipient)" junction table in this schema.
Audience is resolved and **materialized at send-time** into real
`MessageRecipient` rows (`src/lib/messages.ts`'s `sendMessage`, exact
fan-out shape as the Phase 4 bulk-attendance route:
`requireOwnedClass`/`getClassRoster` for a class target,
`db.$transaction([...].map(create))`, not `updateMany`) — never
recomputed dynamically on read, which is also what lets each recipient
carry their own read state. **Retraction only, no edit** (deliberately
narrower than `JournalEntry`'s full edit-supersede audit trail — this
feature's locked scope never asked for editing): a teacher can
soft-delete a sent message (`retractedAt`, row never removed, still
visible in the teacher's own sent-history for audit), reusing
`ConfirmSheet` exactly as `JournalEntryCard`'s own retraction already
does. Viewing the student inbox bulk-marks all currently-unread
messages read server-side on page load — no per-message click needed.

**Urgency visual treatment deliberately avoids `Chip.tsx`** (its
existing variants — `star`, `locked` — already carry unrelated meaning
on journal entries) — a small shared `URGENCY_STYLE`/`URGENCY_LABEL` map
(`src/components/messages/urgency.ts`) drives a colored left-border +
text label on both the student's `MessageCard` and the teacher's
`SentMessageRow`, one source of truth for both sides.

**A real bug was found and fixed before it shipped, not after**: the
draft plan called for mounting a new `UnreadMessagesToast` alongside the
existing `AttendanceToast`, but both independently rendered their own
`.toast-stack` wrapper (`position: fixed; top: 20px; right: 20px`) —
two toasts firing at once would have rendered fully overlapping, not
stacked. Fixed by having `AttendanceToast.tsx` stop owning that outer
wrapper (it now returns just its inner `.toast` card) and
`student/layout.tsx` render a single shared `.toast-stack` around both
components — confirmed live via a direct HTML count
(`<div class="toast-stack">` appears exactly once in the rendered page).

**Nav badge dormant-field activation**: `NavItem`'s `badge?: number`
field and `.nav-badge` CSS already existed (unused, pre-built) — Phase 6
is the first feature to actually populate it
(`getUnreadCount(session.user.id)` computed alongside the existing
`student/layout.tsx` calls), no new CSS needed. New `megaphone` icon
authored (bullhorn silhouette — deliberately not mail/envelope, which
implies two-way correspondence) following the exact inline-SVG
convention used for Phase 1's `people` icon.

Live-verified end-to-end via curl + direct DB checks: send-to-one-student
creates exactly 1 recipient row; send-to-class creates one row per
**currently enrolled** roster student only (confirmed by unenrolling a
student first and checking their absence — `leftAt`-filtered roster, not
stale membership); send-to-all creates one row per every student in the
system (`recipientCount` matched `SELECT COUNT(*) FROM "User" WHERE
role='STUDENT'` exactly); cross-teacher 403 targeting a class not
owned, confirmed zero rows created for the rejected attempt; retraction
confirmed hides a message from every recipient's inbox while the row
stays visible (marked retracted) in the sending teacher's own history;
cross-teacher 403 on retraction; double-retraction correctly 400s;
sending an urgent message then retracting it **before** the recipient
ever viewed their inbox confirmed the unread count never counted it (no
badge inflation from a retracted-but-unread message); viewing the inbox
confirmed bulk-marks all unread rows read and the unread-count endpoint
drops to 0 immediately after; all 3 urgency levels confirmed rendering
visually distinct border colors on the same student's inbox; nav badge
confirmed showing the correct count before a visit and clearing after.
All test students/teacher/class/messages created for verification were
deleted afterward.

**"AI Learning DNA" roadmap — phase 8 (homework/assignments,
2026-07-22)**: teachers can now create checklist-based homework
assignments (title, description, due date) targeted at one whole class
OR one specific student — a two-way choice, unlike messaging's
three-way student/class/all (homework has no "all students" broadcast).
An assignment holds multiple checklist items, each independently either
a self-checked soft task ("watch a movie") or one requiring a real
overall submission (text + optional link + optional file). Teachers
grade/give feedback; a submission or checklist-completion after the due
date is automatically flagged late, computed on read.

**Extended the previously-100%-dead `Exercise`/`Submission` models in
place** rather than building parallel tables (confirmed via full-codebase
grep: zero references anywhere in `src/` before this phase, zero rows,
nothing to migrate) — `CurriculumModule`/`ProgressRecord` are a
**separate, actively-used system** (student dashboard's progress ring,
teacher exam-creation module picker) and were **not touched**.
`Exercise.moduleId` is now nullable — null means generic class homework
(this phase's actual use), non-null remains the original
curriculum-linked-exercise concept (still unused, left intact for the
future). `Exercise` gained a required `teacherId` (needed for "my
assignments" scoping and creator-only grading — nothing previously
identified who authored a non-curriculum exercise), plus `classId`/
`targetStudentId` (exactly one set — no `targetType` enum needed, unlike
`Message`, since which FK is non-null fully encodes the two-way target).
New `AssignmentItem` (checklist rows, `requiresSubmission` flag, `order`
mirroring `Question.order`'s up/down-swap precedent) and
`AssignmentItemCheck` (**first-of-its-kind gap avoided on purpose**:
keyed by `(itemId, studentId)`, not `(itemId, submissionId)` — a student
can check a soft item without ever creating an overall `Submission`,
since submission only matters for `requiresSubmission` items; keying off
a submission id that may not exist yet would have been a chicken-and-egg
bug). `Submission` gained a proper `@@unique([exerciseId, studentId])`
(it had **none** before — would have silently allowed duplicate
submission rows per student per assignment), split its single
overloaded `content` string into `body`/`linkUrl`/`attachmentPath`/
`attachmentMimeType`, and gained `gradedAt` (lets the UI flag "resubmitted
since last graded" without ever silently wiping a prior grade).

**No `MessageRecipient`-style fan-out table for targeting** — unlike
messaging (which needs an independent per-recipient `readAt` surviving
even after a student leaves a class), "who is this assigned to" is
resolved dynamically at read time via the existing `getClassRoster`,
exactly like Phase 4's bulk-attendance roster resolution.

**Scoping split, matching existing precedent exactly**: a teacher's own
assignment list is owner-scoped (matches `getSentMessagesForTeacher`);
the assignment detail/roster page is **open to any teacher** to view
(matches the existing "any teacher can view any student's
profile/journal" precedent); **grading is creator-only** (matches
`retractMessage`'s sender-only rule); the **attachment file route is
open to the submitting student or any teacher** — deliberately not the
stricter owner-only screen-recording pattern, since a homework submission
isn't surveillance-adjacent.

**File storage** (`src/lib/assignmentAttachmentStorage.ts`) follows the
established `studentPhotoStorage.ts`/`screenStorage.ts` convention
exactly: flat files outside `public/`/`.next/`, metadata-only in
Postgres, served through an authenticated route, its own
`ASSIGNMENT_ATTACHMENTS_DIR` env var and `assignment_attachments` Docker
volume added alongside the existing `screen_recordings`/`student_photos`
ones.

**Migration hit the same non-interactive confirmation wall as earlier
phases** (adding the `@@unique([exerciseId, studentId])` constraint
triggered Prisma's "would fail on existing duplicates" warning, even
though the table was confirmed empty) — used the documented workaround
(`migrate diff --script` → hand-written migration folder → `migrate
deploy` → `generate`), after first confirming live via direct DB count
that both `Exercise` and `Submission` genuinely had zero rows.

Live-verified end-to-end via curl + direct DB checks: a class-targeted
assignment created the right `AssignmentItem` rows with correct `order`;
a student in the class checked a soft item and — critically — this
created zero `Submission` rows (the chicken-and-egg decoupling holding);
the same student's full submission (body + link + a real test file)
created exactly one `Submission` row with the file landing on disk and
serving back byte-identical through the attachment route; a student
outside the class was absent from the list and got 403 on both mutation
routes (defense in depth, not just UI hiding); an individually-targeted
assignment was visible only to its one named student; lateness computed
correctly both directions purely from `submittedAt`/`checkedAt` vs
`dueDate` comparisons, with zero stored "late" column anywhere;
resubmission with different content kept the row count at 1 (the new
unique constraint + upsert doing its job); grading persisted correctly
for the creating teacher and correctly 403'd for a different teacher,
while that same different teacher could still view the roster page and
fetch the attachment (200) — confirming the "view open, grade
creator-scoped" split; cross-teacher 403 targeting a class not owned,
zero rows created; the student dashboard's progress ring and the
teacher exam-creation module picker both confirmed rendering exactly as
before, proving `CurriculumModule`/`ProgressRecord` were completely
unaffected by the `Exercise`/`Submission` reshape. All test
classes/students/teacher/assignments/files created for verification
were deleted afterward.

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
  `add_journal_entry_audit_trail`, `add_screen_view_sessions`,
  `add_classes`, `add_student_profiles`, `add_class_schedule`,
  `add_messages`, `add_homework_assignments` — all additive, no renames.
- `var/student-photos/` (phase 2 enrollment photos) is gitignored and
  needs its own Docker volume in production, same as
  `var/screen-recordings/` — flat one-file-per-student, original format
  preserved, never re-encoded.
- Postgres runs in a Docker container (`stlab-db`) that does **not**
  auto-start with the machine — if `prisma migrate`/the app can't reach
  `localhost:5432`, check `docker ps -a` and `docker start stlab-db`
  before assuming something is actually broken.
- `var/screen-recordings/` (saved screen-recording JPEGs, phase 4) is
  gitignored and needs its own Docker volume in production — see
  `deploy/docker-compose.yml`'s `screen_recordings` volume. Never treat
  it as disposable/regeneratable — it's the only copy of saved
  recordings, kept indefinitely by design.
- `var/assignment-attachments/` (homework submission attachments, phase
  8) is gitignored and needs its own Docker volume in production — see
  `deploy/docker-compose.yml`'s `assignment_attachments` volume. Same
  flat one-file-per-submission convention as the other two `var/`
  directories, keyed by `submissionId` so a resubmission overwrites the
  same file rather than accumulating history.
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
