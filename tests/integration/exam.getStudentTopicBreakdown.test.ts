import { describe, test, expect, afterEach } from "vitest";
import { db } from "@/lib/db";
import { getStudentTopicBreakdown } from "@/lib/exam";
import { createTestLab, createTestStudent, createTestModule, createTestExam } from "./helpers";

describe("getStudentTopicBreakdown", () => {
  let fixtures: { cleanup: () => Promise<void> }[] = [];

  afterEach(async () => {
    for (const f of fixtures) await f.cleanup();
    fixtures = [];
  });

  test("aggregates across ALL attempts (not just the latest) and an explicit per-question tag overrides the exam's default module", async () => {
    const examModule = await createTestModule();
    const taggedModule = await createTestModule();
    const lab = await createTestLab();
    const student = await createTestStudent(lab.id);
    const exam = await createTestExam(examModule.id, { questionCount: 1 });
    fixtures = [exam, student, lab, examModule, taggedModule];

    const question = exam.questions[0];
    // Tag this question to a DIFFERENT module than the exam's own default.
    await db.question.update({ where: { id: question.id }, data: { moduleId: taggedModule.id } });

    // Attempt 1: answered WRONG.
    const attempt1 = await db.examAttempt.create({
      data: {
        examId: exam.examId, studentId: student.id, attemptNumber: 1, status: "SUBMITTED",
        questionIds: [question.id], startedAt: new Date(), expiresAt: new Date(), finishedAt: new Date(),
        scorePercent: 0, passed: false,
      },
    });
    await db.attemptAnswer.create({ data: { attemptId: attempt1.id, questionId: question.id, optionId: question.wrongOptionId } });

    // Attempt 2 (a retake): answered RIGHT.
    const attempt2 = await db.examAttempt.create({
      data: {
        examId: exam.examId, studentId: student.id, attemptNumber: 2, status: "SUBMITTED",
        questionIds: [question.id], startedAt: new Date(), expiresAt: new Date(), finishedAt: new Date(),
        scorePercent: 100, passed: true,
      },
    });
    await db.attemptAnswer.create({ data: { attemptId: attempt2.id, questionId: question.id, optionId: question.correctOptionId } });

    const rows = await getStudentTopicBreakdown(student.id);

    expect(rows).toHaveLength(1);
    expect(rows[0].moduleId).toBe(taggedModule.id); // override wins, not the exam's own module
    expect(rows[0].correctCount).toBe(1);
    expect(rows[0].totalCount).toBe(2); // both attempts counted, not just the latest
    expect(rows[0].percentCorrect).toBe(50);
  });

  test("a student with no finished attempts gets an empty breakdown", async () => {
    const lab = await createTestLab();
    const student = await createTestStudent(lab.id);
    fixtures = [student, lab];

    const rows = await getStudentTopicBreakdown(student.id);
    expect(rows).toEqual([]);
  });
});
