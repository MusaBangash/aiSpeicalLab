/** Holistic student metrics — exam/attendance stats shown alongside (not blended with) teacher journal entries. */
import type { JournalCategory } from "@prisma/client";
import { db } from "./db";
import { getAvgExamScorePercent } from "./dashboard";
import { getTermAttendancePercent } from "./attendance";

export const JOURNAL_CATEGORIES: JournalCategory[] = ["PARTICIPATION", "BEHAVIOUR", "EXTRA_ACTIVITY"];

// ACTIVE counts toward category averages and is the default view. SUPERSEDED
// means a later correction now stands in for it. RETRACTED is a soft-delete.
// Computed on read, never stored.
export type JournalEntryStatus = "ACTIVE" | "SUPERSEDED" | "RETRACTED";

export type StudentMetrics = {
  avgScorePercent: number;
  attendancePercent: number;
  categoryAverages: Record<JournalCategory, number | null>;
  entries: {
    id: string;
    category: JournalCategory;
    rating: number;
    note: string | null;
    createdAt: Date;
    teacherId: string;
    teacherName: string;
    status: JournalEntryStatus;
    correctedFromRating: number | null;
  }[];
};

export async function getStudentMetrics(studentId: string, today: Date = new Date()): Promise<StudentMetrics> {
  const [avgScorePercent, attendancePercent, rawEntries] = await Promise.all([
    getAvgExamScorePercent(studentId),
    getTermAttendancePercent(studentId, today),
    // Always fetch every entry (active + retracted + superseded) so the
    // teacher-facing "show history" toggle needs no second round-trip.
    db.journalEntry.findMany({
      where: { studentId },
      orderBy: { createdAt: "desc" },
      include: { teacher: { select: { name: true } } },
    }),
  ]);

  // "Active" = retractedAt is null AND not superseded by a later correction.
  // The superseded-id set is built from not-retracted rows only — that's what
  // makes retracting a correction "revive" whatever it corrected.
  const notRetracted = rawEntries.filter((e) => e.retractedAt === null);
  const supersededIds = new Set(notRetracted.map((e) => e.supersedesId).filter((id): id is string => id !== null));
  const byId = new Map(rawEntries.map((e) => [e.id, e]));

  const statusOf = (e: (typeof rawEntries)[number]): JournalEntryStatus =>
    e.retractedAt !== null ? "RETRACTED" : supersededIds.has(e.id) ? "SUPERSEDED" : "ACTIVE";

  const activeRows = rawEntries.filter((e) => statusOf(e) === "ACTIVE");
  const categoryAverages = Object.fromEntries(
    JOURNAL_CATEGORIES.map((category) => {
      const rows = activeRows.filter((e) => e.category === category);
      const avg = rows.length > 0 ? Math.round((rows.reduce((sum, r) => sum + r.rating, 0) / rows.length) * 10) / 10 : null;
      return [category, avg];
    })
  ) as Record<JournalCategory, number | null>;

  const entries = rawEntries.map((e) => ({
    id: e.id,
    category: e.category,
    rating: e.rating,
    note: e.note,
    createdAt: e.createdAt,
    teacherId: e.teacherId,
    teacherName: e.teacher.name,
    status: statusOf(e),
    correctedFromRating: e.supersedesId ? byId.get(e.supersedesId)?.rating ?? null : null,
  }));

  return { avgScorePercent, attendancePercent, categoryAverages, entries };
}

/** Below this on either exam average or attendance, a student is
 *  flagged "at risk" — shared by the /teacher/students toggle and the
 *  console's proactive at-risk list, so the two surfaces can never
 *  silently drift onto different thresholds. */
export const RISK_THRESHOLD_PERCENT = 60;

export type StudentSummary = {
  id: string;
  name: string;
  email: string;
  avgScorePercent: number;
  attendancePercent: number;
};

export async function getAllStudentsSummary(today: Date = new Date()): Promise<StudentSummary[]> {
  const students = await db.user.findMany({ where: { role: "STUDENT" }, orderBy: { name: "asc" } });
  return Promise.all(
    students.map(async (s) => ({
      id: s.id,
      name: s.name,
      email: s.email,
      avgScorePercent: await getAvgExamScorePercent(s.id),
      attendancePercent: await getTermAttendancePercent(s.id, today),
    }))
  );
}
