import type { Mood } from "@prisma/client";
import { db } from "./db";
import { startOfDay } from "./attendance";

export type CheckInRow = { id: string; date: Date; mood: Mood; note: string | null; updatedAt: Date };

/** One row per day — reuses startOfDay() (src/lib/attendance.ts) for the
 *  same UTC-truncation-safe day bucketing Attendance already relies on.
 *  Upsert, not create-only: resubmitting the same day updates mood/note
 *  rather than being blocked, since the student owns their own entry. */
export async function submitCheckIn(
  studentId: string,
  mood: Mood,
  note: string | undefined,
  at: Date = new Date()
): Promise<void> {
  const date = startOfDay(at);
  await db.wellbeingCheckIn.upsert({
    where: { studentId_date: { studentId, date } },
    update: { mood, note },
    create: { studentId, date, mood, note },
  });
}

export async function getTodayCheckIn(studentId: string, at: Date = new Date()): Promise<CheckInRow | null> {
  return db.wellbeingCheckIn.findUnique({ where: { studentId_date: { studentId, date: startOfDay(at) } } });
}

/** Newest-first, for the teacher-facing history card. */
export async function getCheckInsForStudent(studentId: string): Promise<CheckInRow[]> {
  return db.wellbeingCheckIn.findMany({ where: { studentId }, orderBy: { date: "desc" } });
}
