# Implementation notes (v1, plus rounds 2–3)

Decisions made during the build that the brief and specs didn't pin down,
plus structural bugs found and fixed along the way. Read this before
changing routing, auth, dates, the exam engine, or the question bank.
The v1 section below covers the original build; rounds 2–3 (teacher
exam-management upgrades, exam integrity/polish) are appended after it.

## Routing restructure (blocking fix, not a choice)

The scaffold used Next.js route groups — `src/app/(student)/...` and
`src/app/(teacher)/...`. Route groups don't add a URL segment, so
`(student)/exams` and `(teacher)/exams` both resolved to `/exams` (same
for `/attendance`). This is a hard Next.js error ("You cannot have two
parallel pages that resolve to the same path") that broke the entire app,
including `/login`. Fixed by converting both groups into real path
segments: `src/app/student/**` and `src/app/teacher/**`. Route protection
now lives in `src/middleware.ts` with a plain `matcher` on those prefixes.

## Date handling — the one thing to get right

`Attendance.date` is `@db.Date` (no time, no timezone). Prisma/pg
serialize a JS `Date`'s **UTC** calendar date into that column, not its
local one. This deployment's server clock is Asia/Karachi (UTC+5, per
`docs/03-network.md`), so `new Date(y, m, d)` (local-timezone
construction) silently stored as the *previous* day — verified live
during implementation (an override made for "today" landed on
"yesterday"). Fixed with two rules, enforced by `src/lib/attendance.ts`:

- **`startOfDay(d)`** is the only way to build an attendance-day bucket.
  It reads `d`'s local Y/M/D (so "what day is it right now" is correct)
  and reconstructs via `Date.UTC(...)` (so the value round-trips through
  Postgres without shifting). Never hand-roll `new Date(y, m, d)` for
  anything that touches the `Attendance` table.
- **`toDateParam` / `parseDateParam`** convert between that bucket and a
  `"YYYY-MM-DD"` string using local getters — not `toISOString()`, which
  has the same UTC-shift problem.
- Anywhere a `Date` was read back from the DB (e.g. building a lookup map
  keyed by day), it's used as-is — it's already a correct bucket — rather
  than run through `startOfDay` a second time, which would re-extract
  local getters from an instant that may no longer be local midnight.

This is correct for the actual deployment target (a fixed positive UTC
offset, no DST in Pakistan). It is not fully timezone-agnostic — a
negative-offset deployment would need the day-of-week logic in
`computeStreak`/`isWeekend` re-verified. Not a concern for this single-lab
server, but worth knowing if the code is ever reused elsewhere.

## `sweepExpired` / stale-session sweep

One `GET /api/cron/sweep` route, key-protected with `AGENT_API_KEY`,
calling both `sweepExpired()` (exam.ts) and `closeStaleSessions()`
(attendance.ts). Driven externally — an OS cron entry on the R730 in
production, and the dev heartbeat simulator (`scripts/simulate-heartbeats.ts`)
hits it every 60s in dev. Deliberately not `instrumentation.ts` +
`setInterval`: that pattern spawns a duplicate interval on every dev-server
file-save reload, which is confusing to read and doesn't generalize past a
single Node process.

## Auth.js JWT callback — no DB reads in `jwt()`

`middleware.ts` runs Auth.js's `jwt` callback on the **Edge runtime** by
default. An earlier version of `src/lib/auth.ts` re-queried the DB there
(to make Settings changes take effect immediately) and it broke
authentication outright — Prisma's Node query engine throws
`PrismaClientValidationError` on Edge. Reverted: the `jwt` callback is a
pure token pass-through, populated only at sign-in. **Consequence:** a
language or role change made in Settings takes effect on the next
sign-in, not immediately. Acceptable for a 13-user lab; revisit with
`next-auth`'s `session.update()` client trigger (no DB read needed) if
instant reflection ever matters.

## Preferences: columns, not a model

`examReminders`, `streakAlerts`, `showOnWall` are plain `Boolean` columns
on `User` (migration `add_user_preferences`), not a separate
`UserPreference` model — three fixed, well-known 1:1 toggles don't
justify a key-value table. The brief explicitly allowed either approach.

## i18n coverage

`src/lib/i18n/{en,ur}.ts` + `getDictionary()` exist and are wired into
the sidebar nav labels (the highest-traffic, most-shared copy). `ur.ts`
currently mirrors `en.ts`'s English strings — real Urdu translation is
explicitly out of scope for v1 per the brief. The rest of the UI (page
titles, buttons, exam-flow copy) still uses plain string literals; the
dictionary module and pattern exist so extending coverage later is
additive, not a rewrite.

## Term percentage & attendance definitions

- "Attendance this term" = present/late weekdays ÷ weekdays elapsed
  month-to-date (no `Term` model exists; month-to-date was the simplest
  reasonable stand-in).
- "Total lab hours logged" = sum of all `Session` durations, all-time (not
  scoped to the current month).
- Streak walks backward day-by-day; a weekend with no `Attendance` row
  doesn't break it (the lab isn't in session then) but a missing weekday
  does.

## Session lifecycle (no agent login/logout in v1)

`POST /api/agent/session` stays a 501 stub — the brief marks real agent
lockdown out of scope, only the heartbeat contract needs to work. So
`Session` open/close is inferred entirely from heartbeats: same PC touches
`lastHeartbeat`; a different PC closes the old session and opens a new
one; and `closeStaleSessions()` (called by the sweep cron) closes anything
that's gone quiet for 5+ minutes.

## Other

- `pcHostname` on a fresh `ExamAttempt` is looked up from the student's
  currently-open lab `Session`, falling back to an optional
  client-supplied hostname (useful for dev/testing without a real agent
  session) and then `null`.
- Publish-time validation (bank size ≥ `questionsShown`, exactly one
  correct option per active question) is enforced server-side in
  `PATCH /api/exams/:id`, independent of whatever the UI already checked —
  the UI's Publish button can be wrong or bypassed, the route can't.
- `isCorrect` is never selected into any API response a student can reach
  — verified directly against the live `/start` response during
  implementation, not just by code review.

---

# Round 2 — teacher exam management upgrades

Filters/edit/delete/archive/duplicate on the exam list, bulk question
input (paste + PDF), results search/export, mobile responsive pass.

## Delete vs. archive — the actual guard

Hard `DELETE` is only allowed when `exam.status === "DRAFT" &&
attempts.count === 0` (checked via the existing `Exam.attempts` relation,
`_count.select.attempts` — no extra query). Everything else must be
archived instead. This isn't a UI nicety — the schema has **no cascade
deletes** anywhere on `Question`/`QuestionOption`/`ExamAttempt`/
`ExamRecord`, so a hard delete against an exam with real history would
hit a Postgres FK error, and even if it didn't, the exam spec's "ALL
attempts kept for audit" rule would be violated. Deleting a DRAFT with
zero attempts still requires a manual cascade in dependency order
(`QuestionOption` → `Question` → `Exam`) inside one transaction.

## `pdf-parse` — the installed version wasn't the one assumed while planning

Planning assumed the classic v1.x `pdf-parse` API
(`pdf(buffer).then(...)`, with a known `serverExternalPackages` +
"import from `lib/pdf-parse.js`" workaround for a debug-file ENOENT bug).
What actually installed was **v2.4.5** — a full TypeScript rewrite with a
class-based API (`new PDFParse({ data: uint8Array }).getText()`) that
explicitly targets Next.js/Vercel. The v1 workaround doesn't apply; used
the real v2 API instead. `serverExternalPackages: ["pdf-parse"]` was kept
in `next.config.mjs` anyway as a defensive measure against pdfjs-dist
bundling quirks.

**Real bug found in that route**: `pdf-parse` always appends a
`"-- N of N --"` page-separator string to `result.text`, even for a
completely blank/scanned page — so `!text.trim()` as an "is this PDF
unreadable" check silently passed on a genuinely empty PDF (12
non-whitespace characters survive the trim). Fixed by checking
`result.pages[].text` (per-page, separator-free) instead of the
concatenated string. Verified against a hand-built zero-text-layer PDF
before and after the fix.

## CSV / print export — client-side, no new routes

Both `ResultsTable`'s CSV download and `PrintExamPaper`'s handout/answer-
key both run entirely in the browser (`Blob` + anchor click for CSV,
`window.print()` + a `.print-only`/`.no-print` stylesheet for the PDF
path) — the pages already server-fetch everything needed, so a server
export endpoint would just re-run the identical query for no benefit at
this scale (~13 users, one lab). `src/styles/print.css` is the shared
infrastructure both features (and the round-3 exam-paper printout) build
on.

## Module field: datalist, not free-create

The exam create/edit forms use a text `<input list="…">` (native browser
autocomplete) instead of a `<select>`, but the typed name is still
resolved back to a real `CurriculumModule.id` on submit
(`resolveModuleId` in `ModuleField.tsx`) — a name that doesn't match an
existing module is rejected with an inline error, not auto-created. This
was an explicit choice over free-text-creates-a-module, to avoid typos
("Nueral Network") silently producing duplicate modules.

---

# Round 3 — exam integrity, preview, bank polish, analytics, scheduling

## Option-order randomization — no schema change

`seededShuffle()` in `exam.ts` is a small deterministic PRNG (mulberry32,
seeded by hashing `attemptId + questionId`) — same seed always produces
the same shuffle, so a resumed attempt shows the same order every time,
but two different students (different `attemptId`) see different orders
for the same question. Applied only in the `/start` response; grading
(`saveAnswer`/`finishAttempt`) already matches by `optionId`, not
position, so nothing else needed to change. This closes a real gap: with
a fixed option order, "the answer is C" is trivially shareable between
students taking the exam back-to-back on the same PCs.

## Teacher preview — verified to create zero attempts

`/teacher/exams/:id/preview` is a plain read-only render of the active
bank (correct answers marked, since it's teacher-only) — no timer, no
click handlers, no `resumeOrStart` call. Confirmed live by counting
`ExamAttempt` rows before and after loading the page.

## Question reordering — up/down swap, not drag-and-drop

Added `Question.order` (`Int @default(0)`, migration
`add_question_order`, backfilled once by numbering each exam's existing
questions by `id` ascending — cuid()s are lexicographically time-ordered,
so this matches creation order without needing `createdAt`). Reordering
is an up/down swap between adjacent **active** questions only (retired
ones don't participate in ordering) — chosen over drag-and-drop
specifically to avoid a new dependency, consistent with earlier
"simple over clever" calls in this build (see the mobile-nav
pure-CSS-checkbox rejection below and in round 2's notes).

## Exam availability window — the one rule that matters

`Exam.opensAt`/`closesAt` (both nullable `DateTime`, migration
`add_exam_availability_window`) gate **starting a new attempt only**.
An attempt already `IN_PROGRESS` when `closesAt` passes keeps resuming
to completion — same principle as the per-attempt timer, which already
runs independently of anything else. This was verified live, not just
reasoned about: started an attempt, closed the window while it was still
open, confirmed `/start` still returned the same attempt/questions/
`expiresAt` afterward. The check exists in both `canStartAttempt` (the
read-only advisory check the UI uses) and inside `resumeOrStart`'s
transaction (defense in depth — the actual gate).

## Mobile nav focus/keyboard — why a real component, not pure CSS

`MobileNav.tsx` owns real `useState` rather than a CSS-only
checkbox-toggle drawer, because the sidebar lives in a layout that
persists across client-side route changes — a checkbox's checked state
wouldn't reset on navigation, leaving the drawer open after tapping a
link. This was flagged during round 2 planning and carried through to
round 3's accessibility pass (Escape-to-close, focus moved into the
drawer on open, focus returned to the hamburger button on close).

## Accessibility pass — scope actually covered

Not a full WCAG audit (flagged up front as out of scope for the size of
this app). What's actually done: `ConfirmSheet`/`FinishConfirmSheet` got
`role="dialog"` + `aria-modal` + a real focus trap + Escape-to-close +
focus restored to the triggering element on close; `Toggle` switched
from `aria-pressed` to `role="switch"` + `aria-checked`; `MobileNav` gets
keyboard dismissal and focus management. Spot-checking recently-added
inputs turned up two real bugs (not just theoretical gaps): the PDF
upload's file input and the paste-questions textarea both had a
`<label>` with no `htmlFor`/`id` pairing, so a screen reader would never
announce them on focus. Fixed both.

## Unsaved-changes warning — the deliberate gap

`useUnsavedChangesWarning` only covers `beforeunload` (tab close/
refresh). Next.js App Router has no simple built-in hook to intercept
in-app `<Link>`/`router.push` navigation, and building a real router-
level confirmation guard is more machinery than this warranted — noted
as a known, deliberate limitation rather than quietly shipped as if it
covered everything.
