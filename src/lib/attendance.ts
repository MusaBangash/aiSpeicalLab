/** Attendance rules — not part of the locked exam spec, so they live separately from exam.ts. */
import type { Attendance } from "@prisma/client";
import { db } from "./db";

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
 * Marks a student PRESENT for `at`'s local day if no Attendance row exists
 * yet (create-only — never overwrites a teacher's override or a prior
 * auto-mark). Shared by the login trigger (auth.ts, no sessionId — a web
 * login isn't tied to a PC Session) and the lab-agent heartbeat (passes
 * its Session id) — whichever fires first each day wins and its timestamp
 * is what's recorded.
 *
 * `sessionId`, if given, is backfilled onto the day's row even when the
 * row already existed (e.g. login fired first, with no session yet, and
 * a heartbeat arrives later) — but only while it's still unset, so it
 * always reflects the first Session known to overlap with this day's
 * auto-mark, never overwritten by a later one.
 */
export async function markPresentIfUnset(studentId: string, at: Date = new Date(), sessionId?: string): Promise<void> {
  await db.attendance.upsert({
    where: { studentId_date: { studentId, date: startOfDay(at) } },
    update: {},
    create: { studentId, date: startOfDay(at), status: "PRESENT", checkedInAt: at, source: "AUTO", sessionId },
  });

  if (sessionId) {
    await db.attendance.updateMany({
      where: { studentId, date: startOfDay(at), sessionId: null },
      data: { sessionId },
    });
  }
}
