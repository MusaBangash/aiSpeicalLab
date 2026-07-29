# STLab — orientation for Claude Code

Read this first. `docs/01-vision.md` through `docs/05-implementation-notes.md`
hold the specs and decisions; this file is the "what's actually built and
where things stand right now" summary, kept current across sessions.

## What this is

Learning system for a 12-PC AI Engineering Lab (Muslim Hands, Wazirabad),
Next.js 15 App Router + TypeScript + Prisma/PostgreSQL, running on a LAN
server that may be offline. Two roles: STUDENT and TEACHER.

## Status: v1 core is built and working, plus three rounds of exam-management upgrades, plus all 4 phases of an advanced-attendance initiative (complete), plus all 10 phases of the "AI Learning DNA" roadmap (complete — there is no phase 7 in the locked numbering, so it ran 1-6 and 8-10)

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

**"AI Learning DNA" roadmap — phase 9 (Q&A/doubt-tracking, 2026-07-25)**:
the reverse direction of Phase 6's messaging — a student, stuck on
something, submits a question tagged to a `CurriculumModule`; any
teacher can see it in an inbox, answer it, and mark it resolved. Module
tagging is required (confirmed with the user), not optional. Only
Phase 10 (rank system) remains on the roadmap after this.

New `Doubt` model, deliberately not named `Question` — that name is
already taken by the exam engine's MCQ `Question`/`QuestionOption`
models. Three named relations to `User` (`"DoubtStudent"`,
`"DoubtAnsweredBy"`, `"DoubtResolvedBy"`) and one additive back-relation
on `CurriculumModule` (`doubts Doubt[]`) — `CurriculumModule`'s other
fields and `ProgressRecord` untouched. Status
(unanswered/answered/resolved) is derived from which of two nullable
timestamps (`answeredAt`, `resolvedAt`) are set, never stored — the
same convention as `JournalEntry`'s computed status and homework's
`isLate()`, chosen over a new enum since this is a simple two-milestone
lifecycle, not a genuinely multi-value workflow.

**No fan-out/recipient table, unlike `Message`.** A `Doubt` has a single
asker and no audience — closer in shape to `JournalEntry` than to
`Message`/`MessageRecipient`. **No ownership scoping on answer or
resolve, unlike `Message`/`Exercise`.** Both of those are
teacher-authored, so mutation is scoped to the authoring teacher; a
`Doubt` is **student**-authored, so there is no teacher-creator to scope
to — any teacher (role check only) may answer or resolve any doubt,
matching the existing "any teacher can view any student's
profile/homework roster" precedent for content with no natural
single-teacher owner. Live-verified directly: a second, independent
teacher account can see and act on a doubt asked while only the first
teacher had touched it.

**`answeredAt` is first-wins, direct analogy to `markPresentIfUnset`'s
create-only semantics** — set once on the first answer
(`doubt.answeredAt ?? new Date()`) and never overwritten, preserving
response-time measurement, while `answerBody`/`answeredById` stay
freely overwritable so a teacher can correct or take over an existing
answer. **Live-verified with two distinct teacher accounts, not just a
re-save by the same teacher** — Teacher A answered a doubt, Teacher B
then edited the answer with different text: `answeredById` moved to
Teacher B and `answerBody` changed, but `answeredAt` stayed
byte-identical to the original timestamp.

**Resolving requires an existing answer** — `resolveDoubt` rejects
(400) a doubt with no `answeredAt` yet, confirmed live. **Resolving is
idempotent**, not a 400-on-double-resolve like `retractMessage`'s
double-retract guard — calling it again on an already-resolved doubt is
a no-op success (`if (doubt.resolvedAt) return { ok: true }`), also
confirmed live with `resolvedAt` unchanged across both calls.

**No toasts anywhere for this feature** — explicit scope-discipline
decision. The teacher-side nav badge (unanswered count) is the only
passive notification surface, reusing the dormant `NavItem.badge`
mechanism Phase 6 first activated for students — confirmed live: the
badge showed the correct unanswered count and disappeared entirely
once that last doubt was answered. A new `question` icon (speech
bubble + `?` glyph) was added to `Icon.tsx` since no existing icon fit
"ask a question" — `megaphone` was deliberately not reused (implies
broadcast, the wrong direction). Both student and teacher nav items
share one i18n key, `nav.questions: "Questions"` (added to both
`en.ts`/`ur.ts`), rather than a verb-only label that would misfit the
teacher-facing inbox.

**Reused `ModuleField`/`resolveModuleId` (`src/components/exams/ModuleField.tsx`)
unmodified** for the student ask-question form — same
autocomplete-by-typed-name UX already used by exam creation/editing.
Server-side `askDoubt` independently re-validates the submitted
`moduleId` against a real row (never trusts the client's own
resolution) — confirmed live: a request with a nonexistent `moduleId`
correctly 404s. Teacher inbox UI (`DoubtInboxList.tsx`) mirrors
homework's `AssignmentRosterTable.tsx`/`GradeSubmissionForm.tsx` inline
pattern — one card per doubt with an inline answer form, no separate
detail page. Student UI (`AskDoubtForm.tsx` + `DoubtHistoryCard.tsx`)
mirrors `JournalEntryForm.tsx`/`JournalEntryCard.tsx`'s same-page
form-above-history shape. No new CSS — reuses `.journal-entry-form`,
`Card`, `Chip` (`"coral"` Unanswered / `"active"` Answered / `"done"`
Resolved) exactly as prior phases did for equivalent UIs.

Live-verified end-to-end via curl + direct DB checks: ask with a real
module → one `Doubt` row, both timestamps null; ask with a bogus
`moduleId` → 404; any teacher (confirmed with a temporary second
teacher account) can view and answer a doubt neither of them created;
first-wins `answeredAt` proven across two distinct teachers editing the
same answer; resolve-without-answer → 400; resolve → then resolve again
→ 200 idempotent no-op; nav badge count matched `getUnansweredCount()`
before answering and correctly disappeared after; a student's
`/student/doubts` showed only their own doubts (a second student saw
none of them); role-guard 401s in both directions (student POSTing to
answer/resolve, teacher POSTing to ask); regression-checked
`/student/dashboard`'s progress ring, `/teacher/exams/new`'s module
picker, and both homework pages (`/student/exercises`,
`/teacher/homework`) all rendering exactly as before, confirming
`CurriculumModule`/`ProgressRecord`/`Exercise.moduleId` were
unaffected. All test doubts and the temporary second teacher account
created for verification were deleted afterward.

**"AI Learning DNA" roadmap — phase 10 (rank & promotion system,
2026-07-25) — final phase, roadmap complete.** The capstone: a 6-rank
ladder (Recruit → Apprentice → Builder → Engineer → Architect → Master
Engineer) a student climbs automatically via tenure + points, plus an
8-badge trophy shelf (6 auto-awarded, 2 teacher-awarded). Two design
questions — the points formula/rank thresholds, and whether badges are
repeatable — were resolved with the user via `AskUserQuestion` before
planning; both recommended options were confirmed as-is.

**Points are computed live on every read, never stored** — same
convention as lateness/streaks/`JournalEntryStatus`: +10 per exam
passed, +1 per 2 days present (all-time), +5 per high-rated (≥4) ACTIVE
journal entry in Participation/Behaviour, +20 per badge earned (badges
compound points on top of whatever raw stat earned them). Rank is also
computed on read (`src/lib/rank.ts`'s `computeRank`) via a **top-down
scan** of the ladder, not a sequential climb — necessary because
Architect's and Master Engineer's extra gates (a badge, a nomination)
are independent facts, not monotonic with tenure/points, while
`minTenureMonths`/`minPoints` themselves are. Live-verified with 9
boundary cases including both extra-gate-independence scenarios (met
tenure/points but missing the badge/nomination correctly caps rank at
the highest fully-satisfied tier).

**Badges are stored rows** (`StudentBadge`, `@@unique([studentId,
type])` — confirmed once per type, not repeatable), the opposite
convention from points/rank — the correct precedent here is
`ProgressRecord`/`JournalEntry`/`Message` (point-in-time facts needing
a timestamp that shouldn't silently un-earn), not the compute-on-read
style. `awardedById` is set only for the two teacher-awarded badges
(`PROJECT_COMPLETE`, `MASTER_ENGINEER_NOMINATION`); null for the six
auto-awarded ones. **Any teacher may award either manual badge to any
student** — no ownership/class-scoping — matching the same precedent
already established for journal entries and `Doubt` answering (no
natural single "owning" teacher per student in this schema).

**Exam-completion badges hook into `finishAttempt`'s single choke
point** (`src/lib/exam.ts`) — critically, only in the fresh-computation
branch, never the idempotent early-return branch hit every time a
finished result is re-viewed. **Live-verified the trickiest correctness
point directly**: took a real exam end-to-end via curl (drew questions,
looked up correct `QuestionOption` rows directly in the DB, submitted
all 8 correct answers, finished at 100%) → exactly one `PERFECT_SCORE`
row created; **re-invoked finish on the same now-`SUBMITTED` attempt**
(hitting the early-return branch) → still exactly one row, `earnedAt`
byte-identical — confirming the hook placement is correct, not just
theoretically reasoned about.

**Login-trigger badges** (the 3 streak badges, `TEAM_PLAYER`) hook into
`auth.ts`'s `authorize()`, same try/catch-never-blocks-login discipline
as `markPresentIfUnset`. **A real gap was reasoned through during
planning, not left implicit**: this app's JWT session strategy doesn't
re-invoke `authorize()` on every page load, so a student who logs in
once and stays logged in for days would never get streak/Team-Player
(re-)checked again even as their attendance keeps growing via the lab
heartbeat. Fixed by also hooking `student/dashboard/page.tsx` (the
single most-visited student page) — deliberately **not** also hooking
`student/progress/page.tsx`, since one well-chosen page-load check is
enough and a second would just be redundant idempotent writes.
Live-verified: `TEAM_PLAYER` correctly auto-awarded on a real seeded
student's login (3 qualifying journal entries, avg ≥ 4) from
already-existing data — not manufactured for the test — then confirmed
idempotent across a second login and a dashboard page visit (same row,
same `earnedAt` both times).

**`nominateMasterEngineer` re-checks eligibility server-side**, never
trusting the client's disabled-button state — live-verified via raw
curl (bypassing the UI entirely) both ways: a real student below the
24-month/400-point threshold → 409 with zero rows created; a
fabricated-eligible test student (25 months tenure via a backdated
`ClassEnrollment`, 430 points via a mix of fake `ExamRecord` rows —
confirmed `ExamRecord.examId`/`latestAttemptId` have no DB-level FK, so
no real `Exam`/`ExamAttempt` rows were needed — plus attendance and
badge rows) → 200, nomination badge created, rank correctly became
"Master Engineer"; calling nomination again → 200 idempotent no-op, row
count unchanged.

**UI**: a new "Rank & Badges" `Card` section (shared `RankLadderCard`/
`BadgeShelf` components, the same shared-component role
`MonthHeatmapGrid` plays across Phase 5's two surfaces) inserted right
after `StudentSummaryStrip` on the teacher student-profile page and
between the `hero-grid` and "Entry history" on `/student/progress` —
confirmed via direct file reads this was the correct insertion point
(not a 5th card crammed into `StudentSummaryStrip`'s weighted
`.hero-grid`, which would have wrapped awkwardly). `BadgeAwardActions`
(teacher-only) mirrors `JournalEntryCard.tsx`'s confirm-before-fire
pattern exactly, reusing `ConfirmSheet` unmodified. A real duplicate was
found and fixed during planning: the teacher profile page's inline
`totalDaysPresent` filter was identical to what the new points logic
needed — extracted into `countDaysPresent()` (`src/lib/attendance.ts`),
now called from both places instead of being computed twice.

**No dormant CSS existed for this** (unlike most prior phases) — new
`.rank-*`/`.badge-tile*` classes were added to `dashboard.css`, all
using the pre-existing `--gold*` token family (already a natural fit
for achievement/rank styling) rather than inventing new tokens. One new
icon, `medal` (for the two teacher-awarded badges); the four
auto-awarded badge types deliberately reuse existing icons whose
underlying CONCEPT already matches exactly (`trophy`→Perfect Score,
`award`→Exam Ace, `flame`→streaks, `star`→Team Player, `shield`→generic
rank-tier icon) rather than adding icons for concepts the app already
visualizes elsewhere.

Live-verified end-to-end via curl + direct DB checks + a `tsx`-run
pure-function cross-check: points formula matched a hand-computed total
against a real seeded student's actual exam/attendance/journal rows;
all 9 `computeRank` boundary/extra-gate cases passed; exam-finish badge
fired exactly once across a real 100%-scored attempt and a subsequent
re-view; login-trigger idempotency across 2 logins + 1 dashboard visit;
any-teacher badge-award confirmed with a temporary second teacher
account with no relationship to the target student; nomination's
server-side gate rejected an ineligible real student and accepted a
fabricated-eligible one, both via raw curl bypassing the UI; role-guard
401s in both directions on the new routes; regression-checked 10
untouched pages (dashboard, exams, console, students list, module
picker, homework ×2, doubts, classes, attendance) all rendering
unchanged. All test students (including the fabricated-eligible one and
its backdated class/enrollment), the temporary second teacher account,
and a test-awarded `PROJECT_COMPLETE` badge placed on two real seeded
students purely for the any-teacher check were deleted/reverted after
verification — the one `TEAM_PLAYER` badge left on a real seeded
student was deliberately **not** reverted, since it reflects that
student's genuine pre-existing journal-entry data, not test pollution.

## Post-roadmap work — teacher password reset + per-question topic tagging (2026-07-25)

Two gaps identified during a full-system review, fixed as one unit of
work outside the (now-complete) 10-phase roadmap.

**Teacher-initiated password reset**: a student's password was
previously only ever set once, at enrollment — no way to recover it if
forgotten, short of wrongly re-enrolling a duplicate account (this app
has no email/SMS infra — offline-LAN constraint — so any fix had to be
entirely in-app). Confirmed during planning that self-service
change-password already existed (`PATCH /api/settings/password`,
requires the current password) — the gap was exclusively "forgot it
entirely." New `resetStudentPassword` (`src/lib/students.ts`) reuses
`generatePassword()`/`bcrypt.hash(_, 10)` exactly as `createStudent`
does, returning the new plaintext password once. `User` gained a
lightweight audit trail (`passwordResetAt`/`passwordResetById`, a
self-relation on `User` shaped like `JournalEntry`'s
`supersedesId`/`supersedes` pair) — matches this app's established
who/when tracking for sensitive teacher actions. **Any teacher may
reset any student's password** (no ownership scoping), same precedent
as journal entries/Doubt answering/badge awards — live-verified with a
second, unrelated teacher account. `ResetPasswordAction.tsx`
(`src/components/students/`) bridges `BadgeAwardActions`' confirm-flow
pattern with `EnrollStudentForm`'s one-time-reveal pattern, inserted on
`/teacher/students/[studentId]` as its own always-rendered section
(deliberately **not** nested inside the profile-info card, which is
conditional on a `StudentProfile` row existing — some seeded students
have none and must still be resettable; confirmed live on both). The
confirm dialog explicitly surfaces the known JWT-session limitation
("any device already logged in stays logged in") — an honest,
pre-existing constraint (no server-side session revocation list; the
self-service change-password flow has the identical limitation
already), not a new gap.

**Per-question topic tagging + strength/weakness map**: exam questions
previously weren't tagged by curriculum topic at all — only whole
exams were (`Exam.moduleId`), so performance was only ever visible in
aggregate. `Question` gained an optional `moduleId` (nullable,
`CurriculumModule?` relation) — **zero backfill needed**: a question's
effective topic is `question.moduleId ?? question.exam.moduleId`, so
every pre-existing question already inherits its exam's module by
default; teachers only need to hand-tag questions in exams that
deliberately mix multiple topics. `ModuleField.tsx` (reused from exam
creation and Phase 9's Doubts) gained an optional `required?: boolean`
prop (default `true`, every existing caller unaffected) so it could be
reused for optional per-question tagging in `QuestionForm`
(`QuestionBankEditor.tsx`) — unresolvable typed module names now show
an inline `.field-error`, matching this app's established validation
convention, rather than silently blocking the submit button.
**Bulk-paste and PDF-import are completely untouched** — no parser
changes; both already create questions with `moduleId` implicitly
`null` via Prisma's default-omit behavior, confirmed live.

**One design question resolved with the user via `AskUserQuestion`
before planning**: the breakdown aggregates across **all of a
student's exam attempts ever** (every retry), not just the
latest/official attempt per exam — a deliberate, confirmed departure
from the `ExamRecord`-latest-attempt convention `getAvgExamScorePercent`/
`getExamCounts` use elsewhere. This is a historical
struggle-frequency view ("which topics has this student struggled with
over time"), not a current-standing view. New
`getStudentTopicBreakdown` (`src/lib/exam.ts`, next to
`getAttemptScoreBreakdown`, reusing its existing `questionIdsOf`
helper) — **live-verified the two trickiest correctness points in a
single fabricated-data test**: two attempts on the same exam by one
student, wrong-then-right on the same explicitly-tagged question,
correctly produced `1/2 (50%)` under the *tagged* module (not the
exam's own default module) — proving both the all-attempts aggregation
and the tag-override-beats-exam-default fallback simultaneously.
`TopicBreakdown.tsx` (`src/components/students/`) reuses the `.bar`/
`.bar-fill` classes Phase 10's rank progress bar introduced — no new
CSS, no charting library (matches `ExamScoreTrend.tsx`'s existing
hand-rolled-SVG precedent, which this component sits directly beside
on both profile pages). **Confirmed via direct read, not assumed**:
`ExamScoreTrend` didn't previously appear on `/student/progress` at
all (a much thinner page than the teacher one) — added alongside
`TopicBreakdown` there too, since the component has no internal
ownership check and giving students the same exam-trend visibility
teachers already had was low-risk and clearly in scope for "alongside."

Live-verified end-to-end via curl + direct DB checks + a `tsx`-run
pure-function check: password reset — old password fails/new succeeds
after reset, audit fields populate correctly, any-teacher confirmed,
role-guard 401s in both directions, UI renders for students with and
without a `StudentProfile`; topic tagging — pre-existing untouched
questions render with the exam-default fallback caption, explicit
per-question tagging overrides it, leaving the tag field blank
produces `moduleId: null` (not an error), a full real exam attempt
mixing tagged and untagged questions scored 100% byte-identical to
pre-change behavior, bulk-paste unaffected. All test
students/questions/teacher accounts created for verification were
deleted, and the one real pre-existing question tagged during testing
was reverted back to `null` afterward.

## Post-roadmap work — automated tests + screen-recording retention + bulk CSV import (2026-07-25)

Three more gaps closed as one unit of work, outside the (now-complete)
10-phase roadmap. Confirmed staying English-only — Urdu translation
work is explicitly out of scope.

**Automated test suite (previously zero tests anywhere)**: **Vitest**
chosen over Jest specifically because `tsconfig.json` already commits to
`moduleResolution: "bundler"`/`module: "esnext"`/`isolatedModules: true`
— Vite's native resolution model, not Jest's CJS-first transform. Path
alias (`@/*`) is read automatically via `vite-tsconfig-paths`, so it
can never drift from `tsconfig.json`. **Co-located `*.test.ts` files**
(e.g. `src/lib/attendance.test.ts`), not a parallel `__tests__`/`tests/`
tree — this codebase has zero precedent for mirrored test directories,
everything lives beside what it tests. 12 unit-test files cover every
pure, DB-free function across the codebase (`computeStreak`,
`computeRank`, `parseQuestionTemplate`, `resolveModuleId`, `isLate`,
`isIdle`, `generatePassword`, `initials`, CSV helpers, i18n, etc.) — 60
tests. `tests/integration/` (separate directory — different execution
profile, needs a live DB) covers the 5 trickiest stateful correctness
properties that were previously only manually curl-verified:
`markPresentIfUnset` idempotency, `resetStudentPassword`,
`getStudentRankStatus` (cross-checked against the pure `computeRank`),
`getStudentTopicBreakdown` (multi-attempt aggregation + tag-override),
and — the single most important test in the suite —
**`finishAttempt`'s idempotent early-return path**: takes a real
attempt to 100%, calls `finishAttempt` twice, and asserts the badge
count and `ExamRecord` row count don't change on the second call. **The
regression-detection was itself verified, not just assumed**: the
early-return branch was temporarily disabled, the idempotency test was
confirmed to fail, then the fix was restored and the suite re-confirmed
green.

A separate **`stlab_test` database** (same Postgres container as dev,
different DB name — no new Docker infra) is migrated via
`scripts/migrate-test-db.ts` (`prisma migrate deploy` against
`TEST_DATABASE_URL` from a gitignored `.env.test`). `tests/setup.ts`
redirects `DATABASE_URL` to the test DB **before** any test file's own
`import { db } from "@/lib/db"` resolves, since that singleton
constructs `PrismaClient` at module-load time — this requires zero
changes to any production `src/lib/*.ts` file. Every integration test
creates its own fixtures (via `tests/integration/helpers.ts`'s
`createTestLab`/`createTestTeacher`/`createTestStudent`/`createTestExam`)
and cleans up exactly what it created in FK-safe order in an
`afterEach` — confirmed live: `npm test` run twice back-to-back leaves
both the test DB and the real dev DB completely clean, zero leakage
either direction. One real config gap hit and fixed: Vitest 4's default
transform is `oxc`, not `esbuild` — `vitest.config.ts` needed
`oxc: { jsx: { runtime: "automatic" } }` (not the `esbuild.jsx` option)
to let `ModuleField.test.ts` import from a `.tsx` file despite
`tsconfig.json`'s `"jsx": "preserve"`. One dead branch in
`questionParser.ts` was discovered while writing tests (a bare `"Q:"`
line with no trailing content never starts a question block at all,
since `.trim()` strips the whitespace the regex requires before it can
match) — not fixed, since it's out of scope for this work, but the test
was written to assert the real behavior instead of the originally
assumed one.

**Screen recording retention (90 days, confirmed via `AskUserQuestion`
before planning)** — replaces the indefinite-retention decision from
Phase 4. `sweepExpiredRecordings` (`src/lib/screenView.ts`, alongside
`closeStaleScreenViewSessions`) deletes the on-disk frame directory
**before** the DB rows — confirmed necessary, not just cautious: a
crash between the two leaves an orphaned DB row whose `createdAt` is
still past the cutoff, so the next sweep run picks it right back up
(`rm(..., { force: true })` makes the already-gone directory a safe
no-op); the reverse order would permanently leak files with nothing
left to ever find them. **`ScreenRecordingFrame`'s FK is confirmed
`ON DELETE RESTRICT`** (checked directly against the migration SQL, not
assumed) — frames are deleted explicitly before the recording row,
never relying on cascade. Wired into the existing `/api/cron/sweep`
`Promise.all` as a new `recordingsDeleted` count. One-line UI addition
on the recording detail page only (`· auto-deleted after {N} days`,
threaded from the exported `RECORDING_RETENTION_DAYS` constant so copy
can't drift from the env var) — deliberately not added to the busier
student-profile recordings list. The schema comment that used to say
"retention is indefinite by confirmed decision" was corrected, since it
was about to become actively false. Live-verified: a 100-day-old
recording (real on-disk JPEG + DB rows) was fully deleted by one sweep
call while a 10-day-old one survived untouched; a second sweep call
was a no-op (`recordingsDeleted: 0`); a simulated crash (DB row present,
disk directory already gone) was swept without error on the next call.

**Bulk CSV student import** — mirrors the existing bulk-paste-questions
flow exactly (parse client-side → review table with per-row
removal/warnings → one commit POST), via a new hand-rolled,
quoted-field-aware CSV parser (`src/lib/csvImport.ts`'s `parseCsv`,
RFC4180 semantics — a comma or newline inside a quoted field is data,
not a delimiter, and `""` is an escaped literal quote) since student
addresses routinely contain literal commas and a naive `.split(",")`
would corrupt them. Header columns matched case-insensitively and
order-independently (teachers reorder columns in Excel/Sheets).
`POST /api/students/bulk` (`src/app/api/students/bulk/route.ts`) is
**not one transaction** — loops calling the existing `createStudent`
once per row (each row already has its own internal transaction), so
one bad row (a duplicate email only detectable at commit time) never
rolls back its neighbors; returns a per-row `{ok, ...}` result array.
An unresolvable `className` (typo) is a soft warning, not a row
rejection — the student still imports, just unassigned to a class.
`resolveClassId` (`src/lib/classes.ts`) is the direct clone of
`ModuleField.tsx`'s `resolveModuleId`, same case-insensitive
exact-match shape. `rowsToCsv` (`src/lib/csvExport.ts`) turned out to
be hardcoded to the exam-results row shape, not literally reusable as
originally assumed — added a generic sibling `toCsv` (plus exporting
the previously-private `csvField`) instead of duplicating the escaping
logic in a new file; `downloadCsv` was already generic and is reused
unmodified for both the post-commit credentials CSV and the
"Download CSV template" button. Live-verified end-to-end: a batch of 2
valid rows (one with a comma-containing address, one with a class
assignment) plus 1 row colliding with a real seeded student's email —
confirmed exactly 2 `User`/`StudentProfile` rows created, the
comma-containing address stored intact, the class enrollment correctly
assigned, the colliding row correctly 409'd with `createStudent`'s
exact error message and no duplicate created; logged in as one
newly-created student with its returned password to confirm the bcrypt
hash round-trips through the bulk path exactly as the single-student
path already does; role-guard 401 confirmed on the bulk route with no
session.

Live-verified end-to-end via `npm test` (82 tests, 18 files, unit +
integration together) + curl + direct DB/disk checks for all three
pieces. All test students/teachers/labs/PCs/recordings/sessions created
for verification were deleted afterward; the one pre-existing real
screen recording in the dev DB was left untouched.

## Post-roadmap work — CI/git hooks + unified "Learning DNA" summary + notification center (2026-07-25)

Three more gaps closed as one unit of work, directly following the
previous round (tests, retention, bulk-import). The test suite built
last round only ran if a developer remembered to type `npm test` — no
automated gate existed. The original "AI Learning DNA" vision called
for one composite, narrative student profile, but attendance/exams/
journal/rank/doubts still lived as separate sections across separate
pages (Doubts wasn't even visible on the teacher's per-student page at
all). Toasts and nav badges for attendance/messages/doubts were three
independent, uncoordinated mechanisms with no unified inbox. One scope
question was resolved with the user via `AskUserQuestion` before
planning: the DNA view **enhances the existing profile pages** (a new
card at the top of each), not a new separate route.

**CI + git hooks**: `package.json` gained `typecheck` (`tsc --noEmit`)
and `prepare` (`husky`) scripts, plus `husky` as a devDependency.
`.husky/pre-commit` runs `typecheck` + `test:unit` (fast, no DB
dependency); `.husky/pre-push` runs the full suite (`test:db:migrate`
then `npm test` — a push is the natural "about to be seen by CI"
checkpoint, by which point the developer's local Postgres is already
running). New `.github/workflows/ci.yml`: a `postgres:17` service
container (matches prod's image exactly), `npm ci` → **`npx prisma
generate`** (required — `npm ci` alone doesn't generate the client, no
`postinstall` hook exists) → `npx prisma migrate deploy` against the
service's `TEST_DATABASE_URL` (supplied directly as a workflow env var,
**not** `npm run test:db:migrate`, which hardcodes reading a local
`.env.test` that won't exist in CI — `tests/setup.ts`'s
`dotenv.config()` silently no-ops on a missing file without touching
`process.env`, which is exactly what makes this work) → `typecheck` →
`npm test`. No `next build` step — deliberately out of scope, keeps the
gate fast.

**Unified "Learning DNA" summary**: new `src/lib/dna.ts` — pure, zero
DB imports, mirrors `rank.ts`'s `computeRank` convention ("takes
already-fetched stats, no DB access") and is genuinely unit-testable
(`dna.test.ts`, 14 tests). `computeScoreTrend` compares the latest
`ExamRecord` score against the average of everything before it (±3pp
treated as flat); `pickWeakestTopic` reuses `getStudentTopicBreakdown`'s
existing weakest-first sort, skipping any topic under a
`MIN_TOPIC_SAMPLE_SIZE = 3` answered-question floor so one lucky/unlucky
question can't look like a real weak spot; `countDoubtsOnTopicThisTerm`
matches `Doubt.moduleTitle` against the current calendar month (same
"term" definition as `getTermAttendancePercent`); `generateDnaSummary`
composes all of it into one deterministic, template-based sentence —
**explicitly not an LLM call**, per this app's offline-LAN constraint.
The "independence signal" the original roadmap notes asked about is
folded directly into the sentence (`INDEPENDENCE_THRESHOLD = 3`
this-term doubts on the weakest topic flips the clause from "tackled
mostly independently" to "leans on help with X"); "learning velocity"
(attempts-to-mastery per topic) is explicitly scoped out — `ExamRecord`/
`ExamAttempt` are keyed to whole exams, not topics, so it needs new
per-topic attempt-sequencing logic beyond what exists today.

New `DnaSummaryCard.tsx` (narrative paragraph + a stat-highlights row —
average score, attendance, current streak, rank, and weakest topic if
any — reusing the `.legend`/`.lg` classes already built for the
attendance-heatmap legend, zero new CSS) and `RecentDoubtsCard.tsx`
(last 5 doubts via the already-existing, already-sorted
`getDoubtsForStudent`, reusing `DoubtHistoryCard` per row unmodified,
a "View all" link to the full doubts page) sit right after
`PageHeader` on both `/teacher/students/[studentId]` and
`/student/progress` — confirmed live to render the **byte-identical**
narrative sentence on both pages for the same student, proving actual
unification rather than two similar-looking cards. `TopicBreakdown.tsx`
was refactored from self-fetching (`{studentId}` prop, its own internal
`getStudentTopicBreakdown` call) to prop-driven (`{rows}`), since both
pages now need those same rows for the summary calculation anyway —
avoids a duplicate 5-query fetch, and was safe since the component had
exactly two call sites, both now updated.

**Notification center (student-facing only, deliberately asymmetric)**:
teachers never receive messages (`Message` is teacher-authored,
one-way) and already have a working doubts-count nav badge, so a
teacher-side notification center would be redundant — this is
intentionally student-side only. `AttendanceToast` stays completely
untouched (an ephemeral same-login confirmation, not a persistent
actionable item); `UnreadMessagesToast` also stays untouched — only its
underlying "unread messages" signal gets folded into the new unified
badge, confirmed live via a rendered-HTML count that `.toast-stack`
still wraps both toasts exactly once (no regression of the wrapper bug
fixed back in Phase 6).

Schema gained two nullable, no-default columns (migration
`add_notification_seen_tracking`, applied cleanly non-interactively —
plain nullable additions don't trigger Prisma's confirmation-prompt
wall): `Doubt.studentSeenAt` (named to disambiguate from
`answeredAt`/`resolvedAt`, which are teacher-side event timestamps on
the same model) and `StudentBadge.seenAt`. **Confirmed, not assumed**:
neither `answerDoubt` nor `awardBadgeIfMissing`/
`checkAndAwardExamBadges`/`checkAndAwardLoginBadges` needed any code
change — their `data:` objects never reference these fields, so rows
are created with them staying `NULL` until the notifications page later
sets them.

New `src/lib/notifications.ts`: `getNotificationsForStudent` merges
`getInboxForStudent` + `getDoubtsForStudent` (filtered to answered) +
`getBadgeShelf` (filtered to earned) into one newest-first list — full
history always returned, never filtered by seen/unseen, same
"everything visible, only the badge signals what's new" convention
already used by messages/doubts. `getUnseenNotificationCount` sums
`getUnreadCount` (reused from `messages.ts`) + unseen-answered-doubts +
unseen-earned-badges. `markAllNotificationsSeen` bulk-marks all three in
parallel, called once on `/student/notifications` page load — same
fetch-then-mark-read-on-every-load convention already used by
`/student/messages`. New `bell` icon in `Icon.tsx`; the student nav's
Messages item lost its own badge (would otherwise double-count against
the unified one) in favor of a new Notifications item placed right
before it.

Live-verified end-to-end via `npm test` (98 tests, 20 files, including
a new 2-test integration suite seeding one unread message + one
answered-unseen doubt + one earned-unseen badge, asserting the count is
exactly 3 then 0 after marking seen while the full-history list still
returns all 3 both times) + `tsc --noEmit` + curl against the real
running dev server logged in as a real seeded teacher and student
(`bangash@stlab.local` / `ahmad.ali@student.stlab.local`): the DNA
narrative sentence rendered identically on both the teacher-profile and
student-progress pages using this student's genuine exam/attendance/
doubts/rank data; `TopicBreakdown`'s prop-driven refactor rendered the
same weakest-topic row (`Neural network basics`, 2/8, 25%) the summary
sentence referenced; the nav badge showed `1` (this student's real,
pre-existing `TEAM_PLAYER` badge from the Phase 10 write-up, correctly
still unseen) and dropped to `0` immediately after visiting
`/student/notifications`, whose full history correctly still showed
all 3 signals (badge + 2 messages) after the count cleared; cross-role
307 redirects confirmed in both directions
(`/teacher/students`→student, `/student/notifications`→teacher); zero
runtime errors in the dev server log across every request. No new test
rows were created in the dev database during this verification — only
a real, already-existing student's `seenAt`/`studentSeenAt` fields were
set, which is the feature working as intended, not test pollution.

## Post-roadmap work — backup restore procedure + verification + offsite runbook (2026-07-28)

CI was verified green on real GitHub Actions (pushed the prior round's
work — hit and fixed a one-time `gh`/OAuth `workflow`-scope rejection on
the push, resolved via `gh auth refresh -h github.com -s workflow`).
Next priority: a Postgres backup strategy. Research found the backup
itself **already existed and worked** — `deploy/docker-compose.yml` has
a `backup` service doing a nightly `pg_dump` with 30-day local retention,
plus a manual `scripts/backup-now.sh` — but this had never been
chronicled here. The real, confirmed gaps were narrower than "build a
backup strategy from scratch": no restore procedure existed anywhere; the
backup loop had no error handling (a failed `pg_dump` — bad password, DB
unreachable, disk full — would silently fall through to `sleep` with zero
logging); nothing verified a dump actually restores cleanly (a truncated
or empty file would go unnoticed until the day it's needed); and the
offsite-copy step was a vague one-liner ("copy them off the server
weekly") with no runbook. Confirmed via `AskUserQuestion`: keep the
offsite step **local-only/manual** (no cloud, no remote sync, no
staging-export helper) — matches this app's offline-LAN philosophy and
avoids inventing infrastructure (a second server? cloud storage?) not
confirmed to exist for this lab.

**New `scripts/restore-backup.sh`** — destructive restore of a `.sql`
dump into the live `db` service: drops and recreates the `stlab`
database (the existing dump is plain SQL, no `--clean`/`--create`, so
restoring into a non-empty DB either errors or duplicates rows —
drop+recreate is the only way to guarantee the dump is the whole truth,
which is also why this needs to be loudly destructive). Requires typing
the literal word `yes` at an interactive prompt by default (`-y`/`--yes`
bypasses it for a deliberate, scripted DR drill) — the first script in
this repo with an interactive confirmation, justified by this being a
rarely-run, genuinely destructive admin operation. `-v ON_ERROR_STOP=1`
on every `psql` call is the detail that makes a corrupt dump surface as
a nonzero exit instead of `psql` silently chewing through errors and
still exiting 0 — this is the mechanism that actually closes the
"nothing verifies a dump restores cleanly" gap.

**New `scripts/verify-backup.sh`** — proves a given dump restores
cleanly **without touching the real `stlab` database**: restores into a
disposable `stlab_verify_drill` database on the same instance,
sanity-checks the `User` table has rows, then drops the drill database
(`trap cleanup EXIT` guarantees this happens even on a failed run
partway through). Kept as a separate, standalone, on-demand script —
recommended monthly, against the newest file on the offsite drive, to
prove the *copy* survived intact, which the automated nightly check
below can never do (it only ever sees tonight's own dump).

**Hardened the `backup` service** in `deploy/docker-compose.yml`: the
old inline `sh -c 'while true; do ... done'` one-liner (no error
handling, no logging) was extracted into a new version-controlled
`scripts/backup-loop.sh`, bind-mounted read-only and used as the
entrypoint — no `Dockerfile` change needed, `backup` stays the plain
`postgres:17` image. Every cycle now: dumps, confirms the file is
non-empty, restores it into the same `stlab_verify_drill` throwaway
database directly over `-h db` (this container has no Docker CLI/socket,
so it cannot itself shell out to `verify-backup.sh` — the ~10 lines of
`psql` calls are deliberately duplicated across the two execution
contexts rather than forcing a shared script across an environment that
can't support it), sanity-checks it, then drops it — logging every
step's outcome (`OK`/`FAILED`/`VERIFY OK`/`VERIFY FAILED`, greppable, no
parser needed) to `/backups/backup.log`. `set -u` (not `set -e`) is
deliberate — the loop must survive one bad night and keep running so
tomorrow's dump still gets attempted, rather than crash-looping via
`restart: unless-stopped` with no clearer signal than before.

**`deploy/README.md`** gained three concrete sections replacing the old
one-liner: a restore procedure (stop the app → run
`restore-backup.sh` → restart → confirm the app actually shows the
restored data, since a script printing "RESTORE OK" isn't the same as
the app working), a verification section (pointing at the automatic
nightly drill's log plus the monthly manual offsite-drive check), and an
explicit weekly offsite-copy runbook (which files, from where, onto what
media, how to confirm later it actually happened by checking the newest
copied file's date) — replacing the previous single vague sentence.

Live-verified end-to-end against the real local `stlab-db` container
(both new scripts read `DB_CONTAINER`/`DB_USER`/`DB_NAME` overrides
specifically so they can target it directly instead of
`deploy/docker-compose.yml`, which isn't running locally): a real
`pg_dump` from local dev (13 `User` rows, confirmed before touching
anything) → `verify-backup.sh` reported "VERIFY OK ... 13 row(s)" →
confirmed no leftover drill database afterward; two negative tests — a
garbage-content file correctly failed with a nonzero exit instead of
silently passing, and a 0-byte file was caught before ever touching
Postgres; `restore-backup.sh -y` against a throwaway database name
reported "RESTORE OK" and the restored copy had the correct 13 rows;
the interactive prompt was confirmed to genuinely block restoration when
answered "no" (nonzero exit, target database never created); every test
database and temp file was cleaned up, and the real dev `stlab` database
was confirmed unchanged (still 13 rows) throughout. `docker compose
-f deploy/docker-compose.yml config` confirmed the edited YAML still
parses cleanly (both the `../backups` bind mount and the new
`../scripts/backup-loop.sh:ro` mount resolve correctly). `npx tsc
--noEmit` and the full `npm test` suite (98 tests) stayed clean — this
work has zero interaction with the app's TypeScript or test suite.

## Post-roadmap work — production deploy dry-run, 3 real bugs found and fixed (2026-07-28)

`deploy/docker-compose.yml` (`db`/`app`/`backup`) had never actually
been stood up and tested end-to-end — only written, across several
prior rounds. Before it ever touches the real R730, this round dry-ran
the full stack locally: built the image, brought up all three services,
ran migrations, seeded, logged in for real through the container, and
forced one backup cycle — all inside an isolated `-p stlab-dryrun`
Compose project with a throwaway `deploy/.env.dryrun` (gitignored), so
the developer's real root `.env`, local `next dev`, and the standalone
dev `stlab-db` container were never touched. **This single dry-run
found three real, independently-confirmed bugs** — exactly why "written
but never run" isn't the same as "working," and consistent with this
project's whole-history bias toward live-verifying over assuming.

**Bug #1 — no `.dockerignore`, confirmed real overwrite risk.**
`deploy/Dockerfile`'s build stage runs `RUN npm ci` (fresh Linux-native
`node_modules` inside the image) then `COPY . .` — with `context: ..`
in `docker-compose.yml` and no `.dockerignore` anywhere in the repo, the
entire build context (including the real, 882MB/~17,711-file
`node_modules/` sitting at the repo root) would get copied in afterward,
overwriting the container's fresh Linux binaries with the host's.
**Confirmed conclusively, not just theorized**: after adding
`.dockerignore` (new, repo root — Docker only honors one at the build
context's root) excluding `node_modules`/`.next`/`.git`/`var`/`backups`/
`.env*`/etc., the built image was inspected directly —
`node_modules/@prisma/engines/libquery_engine-linux-musl-openssl-3.0.x.so.node`,
with genuine ELF magic bytes (`7f 45 4c 46`), proving a real Linux
binary made it in, not a Windows one leaked from the host. One edge case
checked directly rather than assumed: excluding `.git` doesn't break
`npm ci`'s `husky` `prepare` hook — `node_modules/husky/index.js` just
prints a harmless message and returns if `.git` is missing, it doesn't
throw.

**Bug #2 — `.env.example` never documented `DB_PASSWORD`, which
`deploy/docker-compose.yml` requires standalone** (used in `db`'s
`POSTGRES_PASSWORD`, `app`'s constructed `DATABASE_URL`, and `backup`'s
`PGPASSWORD`). Following `deploy/README.md`'s literal documented steps
would have left it completely undefined — Compose hard-fails immediately
on `:?set in .env`. Fixed by adding a `DB_PASSWORD` block to
`.env.example`, styled like its neighbors.

**Bug #3 — found only by actually generating a real password and
running the stack**: the fix for bug #2 originally suggested `openssl
rand -base64 24`, matching this file's existing `AUTH_SECRET` guidance.
But `docker-compose.yml` interpolates `${DB_PASSWORD}` directly into
`app`'s `DATABASE_URL` (`postgresql://stlab:${DB_PASSWORD}@db:5432/stlab`)
with **no URL-encoding** — a base64-generated password containing `/`
or `+` (confirmed: the dry-run's own generated password was
`Y5U3yGh801BwPuZ3+GYemrGqs+Ck5uA/`) breaks the connection string outright
(Prisma error `P1013: invalid port number in database URL` — the `/`
gets parsed as a path separator). Fixed `.env.example`'s guidance to
`openssl rand -hex 24` instead — hex output is always URL-safe, no
encoding question ever arises. This would have silently broken a real
first-time deploy if an admin had followed the (now-corrected)
documented generation method verbatim.

**Bug #4 — Auth.js v5 `UntrustedHost` error, 500 on every auth route in
production.** `next dev` trusts `localhost` unconditionally, so this was
never visible in three-plus months of local development — it only
surfaces under `next start` (what the Docker image actually runs).
Confirmed via app-container logs: `[auth][error] UntrustedHost: Host
must be trusted`. Fixed with one line in `src/lib/auth.ts`'s
`NextAuth({...})` config: `trustHost: true` — safe here specifically
because this deployment has no reverse proxy in front (the container is
the LAN-facing endpoint directly, confirmed against `docs/03-network.md`'s
topology), so the incoming Host header genuinely is trustworthy. Chosen
over setting `AUTH_TRUST_HOST=true` as an env var so the fix can't be
silently missed by an `.env` that forgets it.

**Everything else confirmed already correct**: migrations run
automatically on every `app` container start (`CMD ["sh","-c","npx
prisma migrate deploy && npm start"]`) — all 18 existing migrations
applied cleanly to a genuinely fresh database with zero manual
intervention. Seeding is deliberately NOT automatic and NOT idempotent
(`prisma/seed.ts` has no existence checks) — confirmed it must be
triggered manually, exactly once (`docker compose exec app npx prisma db
seed`), which is what this dry-run did. `docs/03-network.md` (ufw,
lab-subnet rules) is correctly inapplicable to a local dry-run and was
skipped entirely.

**The `backup` service's first real cycle inside the actual Compose
network** (previously only exercised against the standalone dev
`stlab-db` container via env-var overrides, never against the `db`
Compose service by its internal hostname) was forced rather than waiting
24h — confirmed `backups/backup.log` showed a clean
`OK dump=...size=98735` immediately followed by `VERIFY OK
dump=...rows=13` (13 = 1 seeded teacher + 12 seeded students, exactly
matching `prisma/seed.ts`'s output). **Unplanned bonus verification**:
the log also captured two earlier `FAILED` entries from real container
startup races (the `backup` service starting before Postgres was ready
to accept connections during this session's password-mismatch
recreate/rebuild cycle) — proving the hardened loop's "log the failure
and keep running rather than crash" design (from the prior backup round)
genuinely works under a real failure, not just in theory. Same
"accidentally-then-deliberately verified" precedent as Phase 5's
staleness-sweep finding.

Live-verified end-to-end: real teacher login
(`bangash@stlab.local`/`change-me-123`) through the fully containerized
stack returned a 302 and a session with `"role":"TEACHER"`; full
teardown (`down -v`) confirmed via `docker ps -a` (only the pre-existing
`stlab-db` remained), `docker volume ls` (zero `stlab-dryrun_*` volumes
left), and the real dev `stlab` database's row count unchanged (13) and
the repo-root `.env`'s mtime unchanged throughout. `npx tsc --noEmit`
and the full `npm test` suite (98 tests) stayed clean afterward — none
of this round's fixes touch application logic paths covered by existing
tests. All dry-run artifacts (`deploy/.env.dryrun`, the `backups/`
directory created during the test, the built `stlab-dryrun-app` image)
were deleted after verification.

## Post-roadmap work — student Stars, quick in-class recognition feeding rank (2026-07-28)

New feature, outside the (complete) 10-phase roadmap: a teacher can now
give any enrolled student a "star" with one tap during a live class —
recognizing a correct answer, good homework, a great idea, attendance,
or anything else, with no per-reason tracking. Design was clarified
through conversation before building (all confirmed): one shared running
total (no categories), stars fold into the **existing** rank/points
formula rather than becoming a second parallel progression track, and
awarding is **quick-tap with no undo** — the opposite of `JournalEntry`'s
audit trail, deliberately, since this is meant to be fast and casual
during a lesson, not a formal corrigible record.

**`Star` is the first model of its exact shape in this schema**: unbounded
rows per student, plain `create`, zero correction/audit fields, from a
teacher-initiated action. Closest precedents were `StudentBadge` (capped
at one row per type — wrong shape, stars repeat) and `JournalEntry`
(right "many rows, no cap" shape, but carries full audit machinery this
feature explicitly doesn't need). New `src/lib/stars.ts` — `awardStar`/
`getStarCount`, mirroring `badges.ts`'s `awardBadgeIfMissing`/
`getBadgeShelf` pair but simpler (no upsert, since stars aren't capped).

**Point value calibrated deliberately low — confirmed via direct
discussion, not guessed**: the existing formula (10/exam pass, 0.5/day
present, 5/journal entry, 20/badge) already values *rare, deliberate*
signals highly and *frequent* ones (attendance) low. An initial instinct
of 3 points/star was revised down to **`STAR_POINT_VALUE = 1`**
specifically because stars are meant to be given often and casually —
at 3 points, a generous teacher handing out a couple per class would let
stars dwarf every other signal within a single week, making rank
reflect "how generous is your teacher" rather than the holistic picture
the formula was built for. `src/lib/rank.ts`'s `PointsBreakdown` gained
`starPoints`, computed alongside the other three point sources in
`getPointsBreakdown`'s existing `Promise.all` and folded into `total` —
**`computeRank`/`RANK_LADDER` needed zero changes**, since they only ever
consume the scalar `total`.

**New `POST /api/classes/:classId/stars`** mirrors
`classes/[classId]/enroll/route.ts` almost exactly (auth guard,
`requireOwnedClass`, single-row create, no transaction/bulk shape) plus
a student existence/role check matching the badge-award routes' pattern.
**New `ClassStarSection.tsx`** reuses `getClassRoster`'s already-fetched
`RosterEntry[]` (zero new server-side query on the class page) and
mirrors `AttendanceOverrideRow.tsx`'s own-state-per-row/transient-"Saved"
pattern — simpler than attendance's row since there's no persisted
per-row status to load and no bulk action needing a `ConfirmSheet` (a
single star isn't destructive enough to warrant one). Wired into
`/teacher/classes/[classId]` as a new "Give stars" section, stacked
after the existing "Attendance — today" section — no new top-level nav
item, matching the existing precedent that per-class quick actions live
as sections on the class detail page.

**Display reuses `RankLadderCard.tsx` unmodified in structure** — just a
5th `.rpb-row` alongside the existing Exams/Attendance/Journal/Badges
breakdown. Since `STAR_POINT_VALUE = 1`, `points.starPoints` doubles as
the literal star count, so no separate count field was needed anywhere.
**Zero changes needed to either profile page**
(`/teacher/students/[studentId]` or `/student/progress`) — both already
pass `rankStatus` into `RankLadderCard` untouched, so the new row appears
identically on both surfaces automatically, the same "same component,
same data, both surfaces" convention already used for
`DnaSummaryCard`/`TopicBreakdown`/`ExamScoreTrend`.

Live-verified end-to-end via `npm test` (100 tests, 21 files — 2 new,
confirming `awardStar`→`getStarCount`→`getPointsBreakdown`'s `starPoints`
all agree, and that a star-less student correctly gets `starPoints: 0`;
the pre-existing `getStudentRankStatus` integration test, which asserts
an exact `points.total`, needed zero changes and still passed unmodified
— confirming the new term is correctly additive, not a breaking
recompute) + `tsc --noEmit` + curl against the real running dev server
logged in as the real seeded teacher: awarded 3 real stars to a real
enrolled student (Ahmad Ali, in "Morning Batch B") via the actual API,
repeated 3× with no error (no unique constraint blocking multiples);
confirmed cross-teacher 403 with a temporary second teacher account,
404 on a nonexistent `studentId`, and 401 on a student-role POST; and
confirmed the teacher's profile page, the student's own progress page,
and the class detail page's new "Give stars" section all rendered
correctly, with the profile pages showing byte-identical "Stars: 3" rows.
All 3 test stars and the temporary teacher account were deleted after
verification, confirmed reverted to 0 afterward.

## Post-roadmap work — class-wide topic mastery map (2026-07-28)

First of an agreed 7-feature sequence (early-warning at-risk list,
wellbeing check-in, class topic mastery, unlockable profile
customization, certificates, most-improved leaderboard, study-buddy
pairing — sequenced cheapest/most-reuse-first). Teachers previously only
saw per-student topic strength/weakness (`TopicBreakdown` on each
student's own profile page) — no whole-class view existed to tell a
teacher "this class collectively struggles with X" for lesson planning.
Needed **zero new data collection or schema** — purely a different
aggregation of exam-attempt data that already existed.

**`getStudentTopicBreakdown` (`src/lib/exam.ts`) was ~45 lines of
querying/tallying logic for one student** — a class-wide version needed
the identical logic scoped to `studentId: { in: studentIds } }` instead
of a single id. Copy-pasting the whole function would have been real
duplication (not the "three similar lines" this codebase tolerates), so
the shared body was extracted into a private `computeTopicBreakdown(studentIds:
string[])`, with `getStudentTopicBreakdown` becoming a one-line wrapper
(`computeTopicBreakdown([studentId])`) and a new `getClassTopicBreakdown(studentIds)`
calling the same helper directly — the exact "batch counterpart" shape
`getClassActivity` already has relative to `getStudentActivity`.
`getStudentTopicBreakdown`'s public signature, behavior, and every
existing caller are completely unchanged.

**`TopicBreakdown.tsx` needed no new component at all** — since
`getClassTopicBreakdown` returns the identical `TopicBreakdownRow[]`
shape the existing component already renders, the same component serves
both surfaces. Only its two hardcoded strings ("Topic strength &
weakness" / "No exam attempts yet.") became optional `title`/`emptyMessage`
props, defaulting to those exact strings — zero visual change on either
existing profile page, confirmed live. Wired into
`/teacher/classes/[classId]` right after the existing "Attendance —
today" section (no new `<h2>` wrapper — the component's own internal
`.feed-title` is the heading, matching how the two profile pages already
use it), fed by adding `getClassTopicBreakdown(roster.map(r =>
r.studentId))` to the page's existing `Promise.all` fetch block
alongside `getClassActivity`/`getClassAttendanceRows` — no new query
round-trip pattern introduced.

Live-verified end-to-end via `npm test` (102 tests, 22 files — 2 new,
confirming cross-student aggregation produces ONE combined row per
topic rather than one row per student, an empty roster returns `[]`
without querying, and — critically — the pre-existing
`getStudentTopicBreakdown` integration test still passes completely
unmodified, proving the extraction didn't change that function's
behavior) + `tsc --noEmit` + curl against the real running dev server:
loaded a real class ("Morning Batch B," one real enrolled student,
Ahmad Ali) and confirmed the new "Class topic mastery" card rendered
"Neural network basics — 2/8 (25%)" — byte-identical to what that same
student's own profile page independently shows in "Topic strength &
weakness," proving the aggregation is correct at n=1; confirmed both
existing profile pages still render the unchanged default title. No
test data was created or needed cleanup — this feature only reads
already-existing exam-attempt data.

## Post-roadmap work — early-warning at-risk list (2026-07-28)

Second of the agreed 7-feature sequence. Teachers previously had to open
`/teacher/students` and toggle an existing client-side "at risk" filter
(`StudentsGridClient.tsx`, threshold `avgScorePercent < 60 ||
attendancePercent < 60`, no trend or weakest-topic signal) to see who
needed attention. New: a **proactive** "At-risk students" card at the
top of `/teacher/console` — the post-login landing page, confirmed
previously purely lab-wide aggregate counts with zero per-student
content — combining attendance %, exam-score trend, and weakest topic,
so a teacher sees it without going to look for it.

**Deliberately reuses the existing risk trigger rather than inventing a
second one**: `RISK_THRESHOLD_PERCENT` was a local const inside
`StudentsGridClient.tsx` — extracted to `src/lib/metrics.ts` (next to
`getAllStudentsSummary`/`StudentSummary`, its natural home) as the one
shared source of truth, imported by both the existing toggle (zero
behavior change, confirmed live) and the new list. The new signals
(trend, weakest topic) only ever *add context* to help a teacher act on
an already-established definition of "at risk" — they don't change who
qualifies.

**Two real design risks were found and designed around before writing
any code, not discovered afterward**:

1. **A real N+1 risk.** `getStudentTopicBreakdown`'s shared
   `computeTopicBreakdown` helper (added last round for the class topic
   mastery feature) already batches many students into one ~5-query
   set — but it *collapses* them into one combined tally, which is
   `getClassTopicBreakdown`'s whole point. Calling the per-student
   function once per at-risk student would re-run that same batch N
   times. Fixed with a genuinely new `getWeakestTopicByStudent`
   (`src/lib/exam.ts`) that keeps the batching but tallies into a
   *nested* Map keyed by student — the same relationship
   `getClassActivity` already has to `getStudentActivity`, just a third
   variant of the pattern. It additionally traces each answer back to
   its student via `attemptId` (added to a `select`, which the
   collapsing helper never needed), so it's a genuinely different
   aggregation, not a parameterization of the existing one — kept as
   its own function rather than forcing `computeTopicBreakdown` to
   support both shapes.
2. **A real import-cycle risk.** `exam.ts` already imports `badges.ts`
   (for `checkAndAwardExamBadges`), and `badges.ts` already imports
   `metrics.ts` (for `getStudentMetrics`). Putting the new
   at-risk-composition logic in either `metrics.ts` or `dashboard.ts` —
   both natural-seeming homes — and having it import the new
   weakest-topic-by-student helper from `exam.ts` would have completed
   a cycle (`metrics.ts`/`dashboard.ts` → `exam.ts` → `badges.ts` →
   `metrics.ts`). Fixed by putting the composition in a **new,
   leaf-only file**, `src/lib/atrisk.ts`, that nothing else in `src/lib/`
   ever imports from — only the console page does — so it can safely
   depend on `metrics.ts`, `dashboard.ts`, and `exam.ts` without ever
   completing a cycle. Same "compose at the top, keep lower modules
   independent" role `dna.ts` already plays. (Separately, `exam.ts`
   importing a value from `dna.ts` — which itself already imports a
   *type* from `exam.ts` — was confirmed safe, since a TypeScript
   `import type` is erased at compile time and creates no runtime
   circular `require`.)

Also cost-conscious by construction: `getAtRiskStudents()` first
resolves who qualifies from the already-existing `getAllStudentsSummary`
data (2 queries per student, an existing, tolerated pattern at this
app's scale — not something this round touched or optimized, out of
scope), then only runs the new batched trend/topic queries against
*that* subset — a lab where nobody currently qualifies never touches
the more expensive queries at all.

`AtRiskStudentsCard.tsx` reuses `.feed-item`/`.feed-title`/`.feed-s`/
`.feed-empty` (same convention as `RecentDoubtsCard`/the notifications
page) and the existing `Chip variant="coral"` "At risk" styling and
`target` icon — zero new CSS, zero new icon.

**A real test bug was caught and fixed during verification, not shipped
blind**: the first test draft dated attendance fixtures to a different
calendar month than the `today` value passed into
`getAtRiskStudents(today)` (mirroring an earlier test's now-inapplicable
fixed-date convention) — `getTermAttendancePercent` scopes strictly to
`today`'s own calendar month, so the fixture rows were silently invisible
to the function under test and a "fully present" student came back
"39% attendance" instead. Fixed by dating every attendance fixture
within the same month as the explicit `today` argument, and — a second,
related bug — covering **every** day from the 1st through `today`'s date
rather than an arbitrary handful, since any weekday with no row at all
is counted as absent, not skipped.

Live-verified end-to-end via `npm test` (105 tests, 23 files — 3 new,
including the corrected date-alignment fixtures — confirming: an
at-risk student is flagged with correct trend/weakest-topic while a
genuinely healthy student never appears; two different at-risk
students' weakest topics come back correctly distinct, not collapsed;
and a lab with nobody at risk returns cleanly with no error) + `tsc
--noEmit` + curl against the real running dev server logged in as the
real seeded teacher: `/teacher/console` rendered a real "At-risk
students" card above the existing stat grids — Ahmad Ali (25% avg, 62%
attendance, weakest topic "Neural network basics" at 25%) and Ayesha
Noor (0% avg, 52% attendance) both appeared correctly with working
links to their profiles; `/teacher/students`'s pre-existing "At risk"
toggle still rendered correctly after the constant extraction. No test
data required cleanup — this feature only reads already-existing data.

## Post-roadmap work — wellbeing check-in (2026-07-29)

Third of the agreed 7-feature sequence. A quick, optional student-side
"how are you feeling today" self-report — deliberately separate from the
teacher-authored `JournalEntry` system (participation/behaviour/
extra-activity ratings). Confirmed via research this is genuinely new:
`getStudentMetrics` and the full schema had zero mood/wellbeing overlap
to fold into. `JournalEntry` was the wrong direction (teacher-authored);
`Doubt` was the closest "student creates a row" precedent but carries a
full teacher answer/resolve lifecycle this feature doesn't need — a
check-in needs zero teacher-side mutation, purely read/informational.
`Attendance`'s `@@unique([studentId, date])` daily-bucket shape (and its
`startOfDay()` UTC-truncation-safe helper) was the right pattern to
copy instead.

**New `Mood` enum** (`GREAT`/`GOOD`/`OKAY`/`LOW`/`STRUGGLING`) rather
than a plain 1-5 int like `JournalEntry.rating` — a genuinely separate
signal reads more clearly as named values than a bare number a teacher
has to interpret, and this schema already uses small discrete enums for
this kind of state (`AttendanceStatus`, `JournalCategory`). New
`WellbeingCheckIn` model: one row per student per day
(`@@unique([studentId, date])`), **deliberately simpler than
`JournalEntry`** — no audit trail, no supersede/retract machinery.
Resubmitting the same day **updates** the row (`db.wellbeingCheckIn.upsert`)
rather than being blocked — a student correcting "I said Low this
morning but I'm actually okay now" is the normal case here, unlike
`Attendance`'s create-only-by-policy semantics. Does **not** feed
`src/lib/rank.ts`'s points formula (unlike Stars) and does **not** fold
into the `dna.ts` narrative summary — an intentionally non-gamified,
teacher-visibility-only signal.

New `src/lib/wellbeing.ts` (`submitCheckIn`/`getTodayCheckIn`/
`getCheckInsForStudent`) and `POST /api/wellbeing/checkin`
(student-only, zod-validated mood enum). **`CheckInWidget.tsx`**
(new, client) sits at the very top of `/student/dashboard` — before the
existing `.hero-grid`, since it needs an interactive mood-picker rather
than a stat tile, and "the first thing a student sees" matches the
"quick daily prompt" framing — five mood buttons pre-populated with
today's existing submission if one exists, so reloading the dashboard
shows "already checked in" state (confirmed live) rather than a blank
form every time. **`WellbeingHistoryCard.tsx`** (new) is a plain
read-only list — no status chip, no lifecycle, unlike
`DoubtHistoryCard` — inserted on `/teacher/students/[studentId]` right
after the existing "Journal timeline" card. Deliberately **no new
student-facing history page and no new nav item** — the dashboard
widget's own "already checked in" state is enough for the student side;
history is meant for the *teacher* to see, not for the student to browse.

Live-verified end-to-end via `npm test` (107 tests, 24 files — 2 new,
confirming: no check-in returns `null`; a submission creates a row;
resubmitting the *same* day updates that exact row rather than creating
a duplicate — confirmed by row-id equality, not just row count; a
different day creates a genuinely separate row; the optional note can
be omitted cleanly) + `tsc --noEmit` + curl against the real running
dev server: a valid mood submission returned `{ok:true}`, an invalid
mood value correctly 400'd, a teacher-role POST correctly 401'd;
reloading the student dashboard after submitting showed the "Good"
button highlighted gold with the saved note pre-filled, confirming the
"already checked in today" state persists across page loads; the
teacher's student-profile page showed "🙂 Good — feeling productive
today, 29 Jul 2026" in the new Wellbeing card in the correct position.
The one real check-in row created during manual verification was
deleted afterward.

## Post-roadmap work — unlockable profile customization (2026-07-29)

Fourth of the agreed 7-feature sequence, and the smallest so far: a
colored ring around a student's avatar that escalates as they climb the
existing 6-tier rank ladder (`src/lib/rank.ts`) — no new database
field, no picker/selection UI, purely derived from the already-computed
`rankStatus.rank.currentRank`.

**A real placement tradeoff was surfaced and resolved with the user
before writing any code, not discovered afterward**: neither page that
already computes rank (`/student/progress`, the teacher's per-student
profile page) renders an avatar at all today — only `AppShell.tsx`'s
nav header does, and that renders on *every* page navigation for both
roles. Tinting the nav header would mean running `getStudentRankStatus`
(confirmed: ~7 DB round-trips via `getPointsBreakdown`'s 5 parallel
queries plus 2 more) on every single student page load, purely to color
an avatar ring. Resolved via `AskUserQuestion`: add a **new** avatar to
the two pages that already fetch rank instead, at zero additional query
cost, rather than pay that cost globally for a purely cosmetic feature.

New `RANK_AVATAR_RING` (`src/lib/rank.ts`) maps each of the 6 rank names
to a color, escalating green (`--muted` → `--leaf-soft` → `--leaf`) into
gold (`--gold-soft` → `--gold` → `--gold-deep`) — reusing only existing
CSS tokens already confirmed real in `src/styles/tokens.css`, matching
this app's established "gold = achievement" convention rather than
inventing new ones. New `RankAvatar.tsx` reuses the existing
`.me-avatar` CSS class (so it still looks like every other avatar in
the app) and adds the ring via inline `box-shadow` only — **the other 6
existing `.me-avatar` render sites** (`AppShell`, `StudentsGridClient`,
`ClassStarSection`, `ClassLivePanel`, `AttendanceOverrideRow`) don't
import this new component and were confirmed live to render completely
unchanged (no `box-shadow`, plain `class="me-avatar"`).

Wired into both `/student/progress` and
`/teacher/students/[studentId]`'s existing "Rank & Badges" card headers
— `rankStatus` and the student's name were already in scope on both
pages, so this needed zero new fetches anywhere.

Live-verified end-to-end via `npm test` (108 tests, 24 files — 1 new
completeness check confirming every `RANK_LADDER` entry has a
corresponding `RANK_AVATAR_RING` color, guarding against a typo
silently rendering `undefined` in a `box-shadow`) + `tsc --noEmit` +
curl against the real running dev server: a real seeded student's own
`/student/progress` page rendered their avatar ("AA") with a
`var(--muted)` ring matching their genuine current rank (Recruit); the
teacher's view of the same student's profile page rendered a
byte-identical avatar and ring; the six pre-existing `.me-avatar` sites
(spot-checked via `/teacher/students`) confirmed visually unchanged. No
test data was created or needed cleanup — this feature is purely
presentational, reading data that already existed.

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
- **Tests**: `npm test` runs the full suite (unit + integration).
  `npm run test:unit` / `npm run test:integration` run just one half.
  Integration tests need a one-time-per-machine `stlab_test` database on
  the same Postgres container (`docker exec -it stlab-db psql -U stlab
  -c "CREATE DATABASE stlab_test;"`), a `TEST_DATABASE_URL` in a
  gitignored `.env.test` (see `.env.example`), and `npm run
  test:db:migrate` to apply migrations to it — same container as
  `DATABASE_URL`, never the dev database itself.
- **Git hooks are live** (Husky v9, `.husky/pre-commit` +
  `.husky/pre-push`) — `npm install` runs `prepare` automatically, which
  wires them up. Pre-commit runs typecheck + unit tests only (fast, no
  DB); pre-push runs the full suite including integration tests, so
  local Postgres must be reachable before pushing. CI
  (`.github/workflows/ci.yml`) runs the same full gate against a fresh
  `postgres:17` service container on every push/PR to `main`.

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
  `add_messages`, `add_homework_assignments`, `add_doubts`,
  `add_student_badges`, `add_password_reset_and_question_topics`,
  `add_notification_seen_tracking`, `add_student_stars`,
  `add_wellbeing_checkins` — all additive, no renames.
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
- Saved screen recordings (phase 4) are **no longer** retained
  indefinitely — a 90-day auto-delete policy (`sweepExpiredRecordings`,
  `src/lib/screenView.ts`) was added in the automated-tests/retention/
  bulk-import round (2026-07-25) and is wired into `/api/cron/sweep`.
  This note is stale as a "known gap" — kept only as a pointer to where
  the policy lives, in case the retention window itself needs revisiting
  before a real 200+-school rollout.

## Where to look for more detail

- `docs/02-exam-spec.md` — the locked exam rules spec.
- `docs/05-implementation-notes.md` — decisions made during the build
  that the specs didn't cover (routing restructure, the Postgres
  `@db.Date` UTC-truncation bug and its fix, JWT/Edge-runtime
  constraint, etc.) — read this before touching auth, dates, or
  attendance.
- `docs/design/*.html` — the approved visual mockups everything is
  ported from.
- `docs/06-go-live-checklist.md` — the ordered checklist for the first
  real deploy to the R730 (secrets generation, ufw firewall verification,
  a supervised restore drill, the TLS decision, and the first real
  multi-PC lab-agent test) — everything that only real hardware and real
  people can verify, as opposed to what's already been proven via the
  local deploy dry-run and security audit.
