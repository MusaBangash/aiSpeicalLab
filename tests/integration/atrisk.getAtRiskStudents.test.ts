import { describe, test, expect, afterEach } from "vitest";
import { db } from "@/lib/db";
import { getAtRiskStudents } from "@/lib/atrisk";
import { getWeakestTopicByStudent } from "@/lib/exam";
import { createTestLab, createTestStudent, createTestModule, createTestExam } from "./helpers";

describe("getAtRiskStudents", () => {
  let fixtures: { cleanup: () => Promise<void> }[] = [];

  afterEach(async () => {
    for (const f of fixtures) await f.cleanup();
    fixtures = [];
  });

  test("flags only the below-threshold student, with correct trend and weakest topic; the healthy student never appears", async () => {
    // Fixed date, passed explicitly to getAtRiskStudents — getTermAttendancePercent
    // scopes to the CALENDAR MONTH of "today", so attendance fixtures must be
    // dated within the same month as whatever "today" the function is given,
    // not the real wall-clock date.
    const today = new Date(2026, 6, 24);

    const module = await createTestModule();
    const lab = await createTestLab();
    const atRiskStudent = await createTestStudent(lab.id);
    const healthyStudent = await createTestStudent(lab.id);
    const exam = await createTestExam(module.id, { questionCount: 1 });
    fixtures = [exam, atRiskStudent, healthyStudent, lab, module];

    const question = exam.questions[0];

    // At-risk student: low score (30%, below the 60% threshold), no attendance rows -> 0% attendance.
    const lowAttempt = await db.examAttempt.create({
      data: {
        examId: exam.examId, studentId: atRiskStudent.id, attemptNumber: 1, status: "SUBMITTED",
        questionIds: [question.id], startedAt: new Date(), expiresAt: new Date(), finishedAt: new Date(),
        scorePercent: 0, passed: false,
      },
    });
    await db.attemptAnswer.create({ data: { attemptId: lowAttempt.id, questionId: question.id, optionId: question.wrongOptionId } });
    await db.examRecord.create({
      data: { examId: exam.examId, studentId: atRiskStudent.id, latestAttemptId: lowAttempt.id, scorePercent: 30, passed: false },
    });

    // Healthy student: PRESENT for every day this term up to `today` (not
    // just some days — getTermAttendancePercent counts every weekday from
    // the 1st through today.getDate(), so any gap reads as absent).
    for (let d = 1; d <= today.getDate(); d++) {
      await db.attendance.create({ data: { studentId: healthyStudent.id, date: new Date(2026, 6, d), status: "PRESENT" } });
    }
    const highAttempt = await db.examAttempt.create({
      data: {
        examId: exam.examId, studentId: healthyStudent.id, attemptNumber: 1, status: "SUBMITTED",
        questionIds: [question.id], startedAt: new Date(), expiresAt: new Date(), finishedAt: new Date(),
        scorePercent: 100, passed: true,
      },
    });
    await db.attemptAnswer.create({ data: { attemptId: highAttempt.id, questionId: question.id, optionId: question.correctOptionId } });
    await db.examRecord.create({
      data: { examId: exam.examId, studentId: healthyStudent.id, latestAttemptId: highAttempt.id, scorePercent: 100, passed: true },
    });

    // getAtRiskStudents() scans EVERY student in the DB, and vitest runs
    // test files in parallel by default (separate workers sharing the same
    // stlab_test database) — assert containment/exclusion by id, not exact
    // list length, so this test can't be flaky based on what other
    // concurrently-running test files' fixtures happen to exist at the moment.
    const rows = await getAtRiskStudents(today);
    const atRiskRow = rows.find((r) => r.id === atRiskStudent.id);

    expect(atRiskRow).toBeDefined();
    expect(atRiskRow!.avgScorePercent).toBe(30);
    expect(atRiskRow!.attendancePercent).toBe(0);
    expect(atRiskRow!.scoreTrend).toBe("insufficient"); // only 1 ExamRecord -> not enough history for a trend
    expect(atRiskRow!.weakestTopic).toBeNull(); // only 1 answered question -> below MIN_TOPIC_SAMPLE_SIZE (3)
    expect(rows.find((r) => r.id === healthyStudent.id)).toBeUndefined();

    // Clean up rows this test created directly (not covered by the shared fixture builders).
    await db.attendance.deleteMany({ where: { studentId: healthyStudent.id } });
  });

  test("getWeakestTopicByStudent gives each of two at-risk students their own distinct weakest topic, not collapsed together", async () => {
    const moduleA = await createTestModule();
    const moduleB = await createTestModule();
    const lab = await createTestLab();
    const student1 = await createTestStudent(lab.id);
    const student2 = await createTestStudent(lab.id);
    const exam = await createTestExam(moduleA.id, { questionCount: 2 });
    fixtures = [exam, student1, student2, lab, moduleA, moduleB];

    const [q1, q2] = exam.questions;
    // Tag q2 to a different module so each student's weak topic is genuinely different.
    await db.question.update({ where: { id: q2.id }, data: { moduleId: moduleB.id } });

    // student1: wrong on q1 (moduleA), 3 total answers on moduleA to clear the sample-size floor.
    for (let i = 0; i < 3; i++) {
      const attempt = await db.examAttempt.create({
        data: {
          examId: exam.examId, studentId: student1.id, attemptNumber: i + 1, status: "SUBMITTED",
          questionIds: [q1.id], startedAt: new Date(), expiresAt: new Date(), finishedAt: new Date(),
          scorePercent: 0, passed: false,
        },
      });
      await db.attemptAnswer.create({ data: { attemptId: attempt.id, questionId: q1.id, optionId: q1.wrongOptionId } });
    }

    // student2: wrong on q2 (moduleB), 3 total answers on moduleB.
    for (let i = 0; i < 3; i++) {
      const attempt = await db.examAttempt.create({
        data: {
          examId: exam.examId, studentId: student2.id, attemptNumber: i + 1, status: "SUBMITTED",
          questionIds: [q2.id], startedAt: new Date(), expiresAt: new Date(), finishedAt: new Date(),
          scorePercent: 0, passed: false,
        },
      });
      await db.attemptAnswer.create({ data: { attemptId: attempt.id, questionId: q2.id, optionId: q2.wrongOptionId } });
    }

    const byStudent = await getWeakestTopicByStudent([student1.id, student2.id]);

    expect(byStudent.get(student1.id)?.moduleTitle).not.toBe(byStudent.get(student2.id)?.moduleTitle);
    expect(byStudent.get(student1.id)?.percentCorrect).toBe(0);
    expect(byStudent.get(student2.id)?.percentCorrect).toBe(0);
  });

  test("a fully-present student with a good exam average -> excluded from the at-risk list, no error", async () => {
    // A student with ZERO exam records defaults to avgScorePercent: 0 (see
    // getAvgExamScorePercent), which alone would trip the <60% threshold —
    // so a genuinely "not at risk" fixture needs both good attendance AND
    // a real passing exam record, not attendance alone.
    const today = new Date(2026, 6, 24);
    const module = await createTestModule();
    const lab = await createTestLab();
    const student = await createTestStudent(lab.id);
    const exam = await createTestExam(module.id, { questionCount: 1 });
    fixtures = [exam, student, lab, module];

    const question = exam.questions[0];
    const attempt = await db.examAttempt.create({
      data: {
        examId: exam.examId, studentId: student.id, attemptNumber: 1, status: "SUBMITTED",
        questionIds: [question.id], startedAt: new Date(), expiresAt: new Date(), finishedAt: new Date(),
        scorePercent: 100, passed: true,
      },
    });
    await db.attemptAnswer.create({ data: { attemptId: attempt.id, questionId: question.id, optionId: question.correctOptionId } });
    await db.examRecord.create({
      data: { examId: exam.examId, studentId: student.id, latestAttemptId: attempt.id, scorePercent: 90, passed: true },
    });

    for (let d = 1; d <= today.getDate(); d++) {
      await db.attendance.create({ data: { studentId: student.id, date: new Date(2026, 6, d), status: "PRESENT" } });
    }

    const rows = await getAtRiskStudents(today);
    expect(rows.find((r) => r.id === student.id)).toBeUndefined();

    await db.attendance.deleteMany({ where: { studentId: student.id } });
  });
});
