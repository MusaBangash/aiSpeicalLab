import { describe, test, expect, afterEach } from "vitest";
import { db } from "@/lib/db";
import { getClassTopicBreakdown, getStudentTopicBreakdown } from "@/lib/exam";
import { createTestLab, createTestStudent, createTestModule, createTestExam } from "./helpers";

describe("getClassTopicBreakdown", () => {
  let fixtures: { cleanup: () => Promise<void> }[] = [];

  afterEach(async () => {
    for (const f of fixtures) await f.cleanup();
    fixtures = [];
  });

  test("aggregates across MULTIPLE students into one row per topic, not one row per student", async () => {
    const examModule = await createTestModule();
    const lab = await createTestLab();
    const student1 = await createTestStudent(lab.id);
    const student2 = await createTestStudent(lab.id);
    const exam = await createTestExam(examModule.id, { questionCount: 1 });
    fixtures = [exam, student1, student2, lab, examModule];

    const question = exam.questions[0];

    // student1: answered WRONG.
    const attempt1 = await db.examAttempt.create({
      data: {
        examId: exam.examId, studentId: student1.id, attemptNumber: 1, status: "SUBMITTED",
        questionIds: [question.id], startedAt: new Date(), expiresAt: new Date(), finishedAt: new Date(),
        scorePercent: 0, passed: false,
      },
    });
    await db.attemptAnswer.create({ data: { attemptId: attempt1.id, questionId: question.id, optionId: question.wrongOptionId } });

    // student2: answered RIGHT.
    const attempt2 = await db.examAttempt.create({
      data: {
        examId: exam.examId, studentId: student2.id, attemptNumber: 1, status: "SUBMITTED",
        questionIds: [question.id], startedAt: new Date(), expiresAt: new Date(), finishedAt: new Date(),
        scorePercent: 100, passed: true,
      },
    });
    await db.attemptAnswer.create({ data: { attemptId: attempt2.id, questionId: question.id, optionId: question.correctOptionId } });

    const rows = await getClassTopicBreakdown([student1.id, student2.id]);

    expect(rows).toHaveLength(1); // ONE row for the topic, not two (one per student)
    expect(rows[0].moduleId).toBe(examModule.id);
    expect(rows[0].correctCount).toBe(1);
    expect(rows[0].totalCount).toBe(2); // both students' answers combined
    expect(rows[0].percentCorrect).toBe(50);

    // Regression check: the single-student function is unaffected by the shared refactor.
    const student1Rows = await getStudentTopicBreakdown(student1.id);
    expect(student1Rows).toHaveLength(1);
    expect(student1Rows[0].moduleId).toBe(examModule.id);
    expect(student1Rows[0].correctCount).toBe(0);
    expect(student1Rows[0].totalCount).toBe(1);
    expect(student1Rows[0].percentCorrect).toBe(0);
  });

  test("an empty student list returns an empty breakdown without querying", async () => {
    const rows = await getClassTopicBreakdown([]);
    expect(rows).toEqual([]);
  });
});
