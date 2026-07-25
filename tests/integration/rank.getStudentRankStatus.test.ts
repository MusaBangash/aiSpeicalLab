import { describe, test, expect, afterEach } from "vitest";
import { db } from "@/lib/db";
import { getStudentRankStatus, computeRank, tenureMonthsSince } from "@/lib/rank";
import { createTestLab, createTestStudent, createTestTeacher, createTestModule, createTestExam } from "./helpers";

describe("getStudentRankStatus", () => {
  let studentId: string | null = null;
  let classId: string | null = null;
  let fixtures: { cleanup: () => Promise<void> }[] = [];

  afterEach(async () => {
    if (studentId) {
      await db.attendance.deleteMany({ where: { studentId } });
      await db.classEnrollment.deleteMany({ where: { studentId } });
      await db.studentBadge.deleteMany({ where: { studentId } });
    }
    if (classId) await db.class.delete({ where: { id: classId } });
    for (const f of fixtures) await f.cleanup();
    fixtures = [];
    studentId = null;
    classId = null;
  });

  test("matches computeRank's pure output when fed the same hand-computed tenure/points from real seeded DB state", async () => {
    const today = new Date(2026, 6, 24);
    const joinedAt = new Date(2026, 0, 24); // exactly 6 months before `today`

    const lab = await createTestLab();
    const teacher = await createTestTeacher(lab.id);
    const student = await createTestStudent(lab.id);
    const module = await createTestModule();
    const exam = await createTestExam(module.id, { passMarkPercent: 50, questionCount: 4 });
    studentId = student.id;
    fixtures = [exam, module, teacher, student, lab];

    const cls = await db.class.create({ data: { name: "Test Class", teacherId: teacher.id } });
    classId = cls.id;
    await db.classEnrollment.create({ data: { studentId: student.id, classId: cls.id, joinedAt } });

    // 4 days present -> floor(4/2) = 2 attendance points.
    for (let i = 0; i < 4; i++) {
      await db.attendance.create({
        data: { studentId: student.id, date: new Date(2026, 5, 1 + i), status: "PRESENT" },
      });
    }

    // 1 passed exam record -> 10 exam points. No journal entries, no badges.
    await db.examRecord.create({
      data: { examId: exam.examId, studentId: student.id, latestAttemptId: `fake-attempt-${Date.now()}`, scorePercent: 100, passed: true },
    });

    const status = await getStudentRankStatus(student.id, today);

    const expectedTenureMonths = tenureMonthsSince(joinedAt, today);
    expect(expectedTenureMonths).toBe(6);
    expect(status.tenureMonths).toBe(6);

    const expectedPoints = 10 /* exam */ + 2 /* attendance */;
    expect(status.points.total).toBe(expectedPoints);

    const expected = computeRank({
      tenureMonths: expectedTenureMonths,
      points: expectedPoints,
      hasProjectCompleteBadge: false,
      hasMasterEngineerNomination: false,
    });
    expect(status.rank).toEqual(expected);
  });
});
