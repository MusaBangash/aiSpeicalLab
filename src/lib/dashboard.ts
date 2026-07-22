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
    db.exam.findMany({ where: { status: "PUBLISHED" } }),
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
