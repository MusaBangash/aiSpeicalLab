/** Attendance rules — not part of the locked exam spec, so they live separately from exam.ts. */
import type { Attendance, AttendanceStatus } from "@prisma/client";
import { db } from "./db";
import { getClassRoster } from "./classes";

/**
 * Reduces any Date to the UTC-midnight instant matching its LOCAL calendar
 * day. This is the one bucket-shape all `Attendance.date` (`@db.Date`)
 * values must share: Prisma/pg serialize a Date's UTC calendar date into
 * that column, not its local one, so `new Date(y, m, d)` (local midnight)
 * silently stores as the PREVIOUS day on any server ahead of UTC (e.g.
 * this deployment's Asia/Karachi, UTC+5) — verified live during
 * implementation. Always go through this function before storing or
 * querying a day bucket; never construct one by hand.
 */
export function startOfDay(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

/**
 * Local calendar date as "YYYY-MM-DD", for URL params and API payloads.
 * NOT `toISOString().slice(0,10)` — that converts to UTC first, which
 * shifts the date by a day for any timezone-and-time-of-day combination
 * where local and UTC calendar dates differ (e.g. just after midnight in
 * UTC+5, as on the R730's local clock).
 */
export function toDateParam(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** Inverse of toDateParam — parses "YYYY-MM-DD" as a LOCAL date, not UTC midnight. */
export function parseDateParam(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function isWeekend(d: Date): boolean {
  const day = d.getDay();
  return day === 0 || day === 6;
}

/** Grace period after a Class's scheduledStartMinutes before an auto-mark becomes LATE instead of PRESENT. */
export const LATE_GRACE_MINUTES = 10;

/**
 * Decides PRESENT vs LATE for an auto-mark at instant `at`, given a
 * class's optional scheduledStartMinutes. Pure function, no DB access.
 * Returns PRESENT whenever scheduledStartMinutes is null/undefined —
 * zero-regression default for every class that hasn't opted into a
 * schedule, and for a student with no active class enrollment at all.
 */
export function determineAutoStatus(
  at: Date,
  scheduledStartMinutes: number | null | undefined
): "PRESENT" | "LATE" {
  if (scheduledStartMinutes == null) return "PRESENT";
  const minutesNow = at.getHours() * 60 + at.getMinutes();
  return minutesNow > scheduledStartMinutes + LATE_GRACE_MINUTES ? "LATE" : "PRESENT";
}

/** Monday = 0 ... Sunday = 6 — for laying out a week-starts-Monday grid. */
export function mondayIndex(d: Date): number {
  return (d.getDay() + 6) % 7;
}

/** Present/late weekdays ÷ weekdays elapsed month-to-date, for `today`'s month. */
export async function getTermAttendancePercent(studentId: string, today: Date): Promise<number> {
  const day0 = startOfDay(today);
  const monthStart = startOfDay(new Date(today.getFullYear(), today.getMonth(), 1));
  const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  const monthRecords = await db.attendance.findMany({
    where: { studentId, date: { gte: monthStart } },
  });
  const byDay = new Map(monthRecords.map((r) => [new Date(r.date).getTime(), r]));

  let weekdaysElapsed = 0;
  let weekdaysPresent = 0;
  for (let d = 1; d <= day0.getDate() && d <= daysInMonth; d++) {
    const day = startOfDay(new Date(today.getFullYear(), today.getMonth(), d));
    if (day > day0) break;
    if (mondayIndex(day) >= 5) continue; // weekend
    weekdaysElapsed++;
    const rec = byDay.get(day.getTime());
    if (rec && (rec.status === "PRESENT" || rec.status === "LATE")) weekdaysPresent++;
  }
  return weekdaysElapsed > 0 ? Math.round((weekdaysPresent / weekdaysElapsed) * 100) : 0;
}

/**
 * Walks backward from `today`, counting consecutive PRESENT/LATE days.
 * A weekend with no row is skipped (doesn't break the streak, doesn't
 * count as absent) since the lab isn't in session then.
 */
export function computeStreak(records: Attendance[], today: Date): number {
  // r.date is already a UTC-midnight bucket (it came from the DB) — key on it directly.
  const byDate = new Map(records.map((r) => [new Date(r.date).getTime(), r]));
  let streak = 0;
  const cursor = startOfDay(today);

  while (true) {
    const record = byDate.get(cursor.getTime());
    if (record) {
      if (record.status === "PRESENT" || record.status === "LATE") {
        streak++;
      } else {
        break; // ABSENT or EXCUSED breaks the streak
      }
    } else if (!isWeekend(cursor)) {
      break; // a missing weekday with no record at all means "not here yet"
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Closes Sessions whose agent has gone quiet for longer than `staleMinutes`. */
export async function closeStaleSessions(staleMinutes = 5): Promise<number> {
  const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
  const result = await db.session.updateMany({
    where: { endedAt: null, lastHeartbeat: { lt: cutoff } },
    data: { endedAt: new Date() },
  });
  return result.count;
}

/**
 * Marks a student PRESENT or LATE for `at`'s local day if no Attendance
 * row exists yet (create-only — never overwrites a teacher's override or
 * a prior auto-mark). Status is decided once, at this first auto-mark
 * event of the day, via determineAutoStatus against the student's active
 * class's scheduledStartMinutes (or PRESENT if they have no active class
 * or it has no schedule set). Shared by the login trigger (auth.ts, no
 * sessionId — a web login isn't tied to a PC Session) and the lab-agent
 * heartbeat (passes its Session id) — whichever fires first each day wins
 * and its timestamp/status is what's recorded.
 *
 * `sessionId`, if given, is backfilled onto the day's row even when the
 * row already existed (e.g. login fired first, with no session yet, and
 * a heartbeat arrives later) — but only while it's still unset, so it
 * always reflects the first Session known to overlap with this day's
 * auto-mark, never overwritten by a later one.
 */
export async function markPresentIfUnset(studentId: string, at: Date = new Date(), sessionId?: string): Promise<void> {
  const enrollment = await db.classEnrollment.findFirst({
    where: { studentId, leftAt: null },
    include: { class: { select: { scheduledStartMinutes: true } } },
  });
  const status = determineAutoStatus(at, enrollment?.class.scheduledStartMinutes);

  await db.attendance.upsert({
    where: { studentId_date: { studentId, date: startOfDay(at) } },
    update: {},
    create: { studentId, date: startOfDay(at), status, checkedInAt: at, source: "AUTO", sessionId },
  });

  if (sessionId) {
    await db.attendance.updateMany({
      where: { studentId, date: startOfDay(at), sessionId: null },
      data: { sessionId },
    });
  }
}

/** One class's attendance rows for a given day, shaped exactly as
 *  AttendanceOverrideRow expects, so it renders unmodified. */
export type ClassAttendanceRow = {
  studentId: string;
  studentName: string;
  date: string;
  initialStatus: Attendance["status"] | null;
  initialNote: string | null;
  initialSource: Attendance["source"] | null;
  initialCheckedInAt: string | null;
};

export async function getClassAttendanceRows(classId: string, at: Date): Promise<ClassAttendanceRow[]> {
  const roster = await getClassRoster(classId);
  if (roster.length === 0) return [];

  const day = startOfDay(at);
  const dateParam = toDateParam(at);
  const records = await db.attendance.findMany({
    where: { studentId: { in: roster.map((r) => r.studentId) }, date: day },
  });
  const byStudent = new Map(records.map((r) => [r.studentId, r]));

  return roster.map((r) => {
    const rec = byStudent.get(r.studentId);
    return {
      studentId: r.studentId,
      studentName: r.name,
      date: dateParam,
      initialStatus: rec?.status ?? null,
      initialNote: rec?.note ?? null,
      initialSource: rec?.source ?? null,
      initialCheckedInAt: rec?.checkedInAt ? rec.checkedInAt.toISOString() : null,
    };
  });
}

export type MonthCell = { day: number; className: string; href?: string };

/** Thresholds for the lab-wide aggregate month view — reuses the .p/.late/.a
 *  hcell classes for MAGNITUDE (turnout) rather than per-student STATUS. */
const HIGH_ATTENDANCE_THRESHOLD = 90;
const MID_ATTENDANCE_THRESHOLD = 70;

/** Lab-wide per-day aggregate for the teacher attendance page's month view:
 *  present-count ÷ total-student-count, bucketed into the shared hcell
 *  classes reinterpreted as turnout magnitude. Weekends get no modifier
 *  (falls through to the default mist background, same implicit
 *  "weekend/holiday" treatment the per-student heatmap already has). Days
 *  after `today` get "future". Each cell links back to this page's `?date=`. */
export async function getLabMonthAttendanceCells(
  year: number,
  month: number,
  today: Date = new Date()
): Promise<MonthCell[]> {
  const monthStart = startOfDay(new Date(year, month, 1));
  const monthEndExclusive = startOfDay(new Date(year, month + 1, 1));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day0 = startOfDay(today);

  const [totalStudents, records] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.attendance.findMany({ where: { date: { gte: monthStart, lt: monthEndExclusive } } }),
  ]);

  const presentByDay = new Map<number, number>();
  for (const r of records) {
    if (r.status !== "PRESENT" && r.status !== "LATE") continue;
    const key = new Date(r.date).getTime();
    presentByDay.set(key, (presentByDay.get(key) ?? 0) + 1);
  }

  const cells: MonthCell[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = startOfDay(new Date(year, month, d));
    let className = "hcell";
    if (date > day0) {
      className += " future";
    } else if (isWeekend(date)) {
      // no modifier — same implicit "weekend/holiday" mist as the per-student heatmap
    } else if (totalStudents > 0) {
      const percent = ((presentByDay.get(date.getTime()) ?? 0) / totalStudents) * 100;
      if (percent >= HIGH_ATTENDANCE_THRESHOLD) className += " p";
      else if (percent >= MID_ATTENDANCE_THRESHOLD) className += " late";
      else className += " a";
    }
    cells.push({ day: d, className, href: `/teacher/attendance?date=${toDateParam(date)}` });
  }
  return cells;
}

/** One student's per-day status cells for an arbitrary month — extracted
 *  byte-identical from the inline loop in student/attendance/page.tsx,
 *  parameterized instead of hardcoded to session.user.id + "this month". */
export async function getStudentMonthAttendanceCells(
  studentId: string,
  year: number,
  month: number,
  today: Date = new Date()
): Promise<MonthCell[]> {
  const monthStart = startOfDay(new Date(year, month, 1));
  const monthEndExclusive = startOfDay(new Date(year, month + 1, 1));
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day0 = startOfDay(today);

  const monthRecords = await db.attendance.findMany({
    where: { studentId, date: { gte: monthStart, lt: monthEndExclusive } },
  });
  const byDay = new Map(monthRecords.map((r) => [new Date(r.date).getTime(), r]));

  const cells: MonthCell[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const date = startOfDay(new Date(year, month, d));
    let className = "hcell";
    if (date > day0) {
      className += " future";
    } else {
      const rec = byDay.get(date.getTime());
      if (rec?.status === "PRESENT") className += " p";
      else if (rec?.status === "LATE") className += " late";
      else if (rec?.status === "ABSENT") className += " a";
      else if (rec?.status === "EXCUSED") className += " excused";
    }
    cells.push({ day: d, className });
  }
  return cells;
}

/**
 * Full FORWARD scan of a student's entire Attendance history for the
 * best-ever run of consecutive PRESENT/LATE weekdays — unlike
 * computeStreak (backward from today, stops at the first gap), this can
 * find a historical run that is no longer current. Pure function, same
 * mixed pattern as computeStreak — caller fetches ALL-time records (no
 * date floor), this just walks them.
 */
export function computeLongestStreak(records: Attendance[]): number {
  if (records.length === 0) return 0;
  const byDate = new Map(records.map((r) => [startOfDay(new Date(r.date)).getTime(), r]));
  const sortedTimes = [...byDate.keys()].sort((a, b) => a - b);

  let longest = 0;
  let current = 0;
  const cursor = new Date(sortedTimes[0]);
  const last = sortedTimes[sortedTimes.length - 1];

  while (cursor.getTime() <= last) {
    const record = byDate.get(cursor.getTime());
    if (record) {
      if (record.status === "PRESENT" || record.status === "LATE") {
        current++;
        longest = Math.max(longest, current);
      } else {
        current = 0; // ABSENT or EXCUSED breaks the run
      }
    } else if (!isWeekend(cursor)) {
      current = 0; // missing weekday, no row at all — a real gap
    }
    // weekend with no row: skip, run continues unaffected
    cursor.setDate(cursor.getDate() + 1);
  }
  return longest;
}

/** All-time count of PRESENT/LATE rows — same definition StudentSummaryStrip's
 *  "Total days present" stat and the rank system's attendance points both use. */
export function countDaysPresent(records: { status: AttendanceStatus }[]): number {
  return records.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;
}

/** Every {year, month} from `start`'s month through `end`'s month
 *  inclusive, most-recent-first — drives the profile page's stacked
 *  month-heatmap blocks without hardcoding "current month only". */
export function listMonthsDescending(start: Date, end: Date): { year: number; month: number }[] {
  const months: { year: number; month: number }[] = [];
  const cursor = new Date(end.getFullYear(), end.getMonth(), 1);
  const stop = new Date(start.getFullYear(), start.getMonth(), 1);
  while (cursor.getTime() >= stop.getTime()) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
    cursor.setMonth(cursor.getMonth() - 1);
  }
  return months;
}
