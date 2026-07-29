/** Read-only aggregation for the dashboard pages — no new models, composed from existing data on read. */
import { db } from "./db";
import { computeStreak } from "./attendance";

/** Average of all ExamRecord.scorePercent for a student — 0 if they have none. */
export async function getAvgExamScorePercent(studentId: string): Promise<number> {
  const records = await db.examRecord.findMany({ where: { studentId }, select: { scorePercent: true } });
  return records.length > 0 ? Math.round(records.reduce((sum, r) => sum + r.scorePercent, 0) / records.length) : 0;
}

/** Exam attempt/pass counts for a student — sibling to getAvgExamScorePercent
 *  rather than reshaping its existing number-returning signature, which
 *  getStudentDashboard/getStudentMetrics/getAllStudentsSummary all already
 *  depend on as a plain number. */
export async function getExamCounts(studentId: string): Promise<{ examsTaken: number; examsPassed: number }> {
  const [examsTaken, examsPassed] = await Promise.all([
    db.examRecord.count({ where: { studentId } }),
    db.examRecord.count({ where: { studentId, passed: true } }),
  ]);
  return { examsTaken, examsPassed };
}

/** Batched-by-student ExamRecord fetch for feeding computeScoreTrend
 *  (src/lib/dna.ts) across many students in one query, instead of the
 *  one-at-a-time db.examRecord.findMany calls every existing caller uses. */
export async function getExamRecordsByStudent(
  studentIds: string[]
): Promise<Map<string, { scorePercent: number; updatedAt: Date }[]>> {
  const result = new Map<string, { scorePercent: number; updatedAt: Date }[]>(
    studentIds.map((id) => [id, []])
  );
  if (studentIds.length === 0) return result;

  const records = await db.examRecord.findMany({
    where: { studentId: { in: studentIds } },
    select: { studentId: true, scorePercent: true, updatedAt: true },
  });
  for (const r of records) {
    result.get(r.studentId)?.push({ scorePercent: r.scorePercent, updatedAt: r.updatedAt });
  }
  return result;
}

export type StudentDashboard = {
  progressPercent: number;
  streak: number;
  avgScorePercent: number;
  continueModule: { id: string; title: string } | null;
  feed: { text: string; sub: string; passed: boolean }[];
};

export async function getStudentDashboard(studentId: string): Promise<StudentDashboard> {
  const [moduleCount, completedCount, attendance, records, inProgress] = await Promise.all([
    db.curriculumModule.count(),
    db.progressRecord.count({ where: { studentId, status: { in: ["COMPLETE", "DEFENDED"] } } }),
    db.attendance.findMany({ where: { studentId } }),
    db.examRecord.findMany({ where: { studentId }, orderBy: { updatedAt: "desc" }, take: 5 }),
    db.progressRecord.findFirst({ where: { studentId, status: "IN_PROGRESS" }, include: { module: true } }),
  ]);

  const progressPercent = moduleCount > 0 ? Math.round((completedCount / moduleCount) * 100) : 0;
  const streak = computeStreak(attendance, new Date());
  const avgScorePercent = await getAvgExamScorePercent(studentId);

  // ExamRecord has no Prisma relation to Exam (schema doesn't declare one) — look titles up separately.
  const exams = await db.exam.findMany({ where: { id: { in: records.map((r) => r.examId) } } });
  const examTitle = (examId: string) => exams.find((e) => e.id === examId)?.title ?? "Exam";

  const feed = records.map((r) => ({
    text: `${examTitle(r.examId)} — ${r.passed ? "passed" : "attempted"} (${r.scorePercent}%)`,
    sub: r.updatedAt.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "short" }),
    passed: r.passed,
  }));

  return {
    progressPercent,
    streak,
    avgScorePercent,
    continueModule: inProgress ? { id: inProgress.module.id, title: inProgress.module.title } : null,
    feed,
  };
}

export type MostImprovedRow = {
  id: string;
  name: string;
  priorAvg: number;
  recentAvg: number;
  improvementPercent: number; // 0-100, percentage of the remaining gap closed
};

const IMPROVEMENT_WINDOW_DAYS = 30;

/** Rolling-window improvement, not a calendar term — splits each
 *  student's already-fetched ExamRecord history at `today - 30 days`.
 *  A student needs at least one record on BOTH sides of that split to
 *  appear at all; students who only have history in one window are
 *  omitted, not padded with a fabricated comparison. */
export async function getMostImprovedStudents(today: Date = new Date()): Promise<MostImprovedRow[]> {
  const students = await db.user.findMany({ where: { role: "STUDENT" }, select: { id: true, name: true } });
  if (students.length === 0) return [];

  const cutoff = new Date(today.getTime() - IMPROVEMENT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const recordsByStudent = await getExamRecordsByStudent(students.map((s) => s.id));

  const rows: MostImprovedRow[] = [];
  for (const student of students) {
    const records = recordsByStudent.get(student.id) ?? [];
    const recent = records.filter((r) => r.updatedAt >= cutoff);
    const prior = records.filter((r) => r.updatedAt < cutoff);
    if (recent.length === 0 || prior.length === 0) continue;

    const recentAvg = recent.reduce((sum, r) => sum + r.scorePercent, 0) / recent.length;
    const priorAvg = prior.reduce((sum, r) => sum + r.scorePercent, 0) / prior.length;
    const gap = 100 - priorAvg;
    const improvementPercent = gap > 0 ? Math.max(0, Math.round(((recentAvg - priorAvg) / gap) * 100)) : 0;

    rows.push({ id: student.id, name: student.name, priorAvg: Math.round(priorAvg), recentAvg: Math.round(recentAvg), improvementPercent });
  }

  return rows.sort((a, b) => b.improvementPercent - a.improvementPercent);
}

export type TeacherConsole = {
  studentCount: number;
  presentToday: number;
  examStats: { title: string; attempted: number; passed: number }[];
  girlsCount: number;
  boysCount: number;
  hostelizedCount: number;
  dayScholarCount: number;
};

export async function getTeacherConsole(today: Date): Promise<TeacherConsole> {
  const [studentCount, todayAttendance, exams, genderCounts, residencyCounts] = await Promise.all([
    db.user.count({ where: { role: "STUDENT" } }),
    db.attendance.findMany({ where: { date: today } }),
    db.exam.findMany({ where: { status: "PUBLISHED" }, orderBy: { createdAt: "desc" } }),
    db.studentProfile.groupBy({ by: ["gender"], _count: true }),
    db.studentProfile.groupBy({ by: ["residency"], _count: true }),
  ]);

  const presentToday = todayAttendance.filter((a) => a.status === "PRESENT" || a.status === "LATE").length;

  const examStats = await Promise.all(
    exams.map(async (exam) => {
      const records = await db.examRecord.findMany({ where: { examId: exam.id }, select: { passed: true } });
      return { title: exam.title, attempted: records.length, passed: records.filter((r) => r.passed).length };
    })
  );

  // Gender.OTHER counts toward studentCount but not either binary bucket below.
  const girlsCount = genderCounts.find((g) => g.gender === "FEMALE")?._count ?? 0;
  const boysCount = genderCounts.find((g) => g.gender === "MALE")?._count ?? 0;
  const hostelizedCount = residencyCounts.find((r) => r.residency === "HOSTELIZED")?._count ?? 0;
  const dayScholarCount = residencyCounts.find((r) => r.residency === "DAY_SCHOLAR")?._count ?? 0;

  return { studentCount, presentToday, examStats, girlsCount, boysCount, hostelizedCount, dayScholarCount };
}
