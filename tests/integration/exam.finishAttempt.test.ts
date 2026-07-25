import { describe, test, expect, afterEach } from "vitest";
import { db } from "@/lib/db";
import { finishAttempt } from "@/lib/exam";
import { createTestLab, createTestStudent, createTestModule, createTestExam } from "./helpers";

describe("finishAttempt", () => {
  let studentId: string | null = null;
  let fixtures: { cleanup: () => Promise<void> }[] = [];

  afterEach(async () => {
    // FK-safe order: badges first (student-scoped), then fixtures in the
    // order they were pushed — exam (frees its attempts/records that
    // reference the student), then module, then student, then lab.
    if (studentId) {
      await db.studentBadge.deleteMany({ where: { studentId } });
    }
    for (const f of fixtures) await f.cleanup();
    fixtures = [];
    studentId = null;
  });

  test("is idempotent: a second call returns a byte-identical result and does not re-award badges", async () => {
    const lab = await createTestLab();
    const student = await createTestStudent(lab.id);
    const module = await createTestModule();
    const exam = await createTestExam(module.id, { passMarkPercent: 50, questionCount: 4 });
    studentId = student.id;
    fixtures = [exam, module, student, lab];

    // 3 of 4 correct = 75%, passes a 50% pass mark.
    const attempt = await db.examAttempt.create({
      data: {
        examId: exam.examId,
        studentId: student.id,
        attemptNumber: 1,
        status: "IN_PROGRESS",
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        questionIds: exam.questions.map((q) => q.id),
      },
    });
    for (let i = 0; i < exam.questions.length; i++) {
      const q = exam.questions[i];
      await db.attemptAnswer.create({
        data: { attemptId: attempt.id, questionId: q.id, optionId: i < 3 ? q.correctOptionId : q.wrongOptionId },
      });
    }

    const first = await finishAttempt(attempt.id, false);
    expect(first.scorePercent).toBe(75);
    expect(first.passed).toBe(true);
    expect(first.correctCount).toBe(3);
    expect(first.totalCount).toBe(4);

    const badgeCountAfterFirst = await db.studentBadge.count({ where: { studentId: student.id } });
    const attemptAfterFirst = await db.examAttempt.findUniqueOrThrow({ where: { id: attempt.id } });

    // Second call on the now-SUBMITTED attempt — hits the idempotent early-return branch.
    const second = await finishAttempt(attempt.id, false);

    expect(second).toEqual(first);
    const attemptAfterSecond = await db.examAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
    expect(attemptAfterSecond.finishedAt?.getTime()).toBe(attemptAfterFirst.finishedAt?.getTime());

    const badgeCountAfterSecond = await db.studentBadge.count({ where: { studentId: student.id } });
    expect(badgeCountAfterSecond).toBe(badgeCountAfterFirst); // proves the early-return branch, not just awardBadgeIfMissing's own idempotency

    const recordCount = await db.examRecord.count({ where: { examId: exam.examId, studentId: student.id } });
    expect(recordCount).toBe(1);
  });

  test("a perfect score awards the PERFECT_SCORE badge exactly once, even across two finish calls", async () => {
    const lab = await createTestLab();
    const student = await createTestStudent(lab.id);
    const module = await createTestModule();
    const exam = await createTestExam(module.id, { passMarkPercent: 50, questionCount: 4 });
    studentId = student.id;
    fixtures = [exam, module, student, lab];

    const attempt = await db.examAttempt.create({
      data: {
        examId: exam.examId,
        studentId: student.id,
        attemptNumber: 1,
        status: "IN_PROGRESS",
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + 60_000),
        questionIds: exam.questions.map((q) => q.id),
      },
    });
    for (const q of exam.questions) {
      await db.attemptAnswer.create({ data: { attemptId: attempt.id, questionId: q.id, optionId: q.correctOptionId } });
    }

    const result = await finishAttempt(attempt.id, false);
    expect(result.scorePercent).toBe(100);

    await finishAttempt(attempt.id, false); // re-view, must not duplicate the badge

    const perfectScoreBadges = await db.studentBadge.findMany({ where: { studentId: student.id, type: "PERFECT_SCORE" } });
    expect(perfectScoreBadges).toHaveLength(1);
  });
});
