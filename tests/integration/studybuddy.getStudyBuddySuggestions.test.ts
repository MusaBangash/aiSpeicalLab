import { describe, test, expect, afterEach } from "vitest";
import { db } from "@/lib/db";
import { getStudyBuddySuggestions } from "@/lib/studybuddy";
import { createTestLab, createTestStudent, createTestModule, createTestExam } from "./helpers";
import type { RosterEntry } from "@/lib/classes";

describe("getStudyBuddySuggestions", () => {
  let fixtures: { cleanup: () => Promise<void> }[] = [];

  afterEach(async () => {
    for (const f of fixtures) await f.cleanup();
    fixtures = [];
  });

  test("matches a struggling student to the classmate strongest on the exact same topic; excludes students below the sample floor and students whose weak topic has no qualifying partner", async () => {
    const moduleA = await createTestModule();
    const moduleB = await createTestModule();
    const lab = await createTestLab();
    const weak = await createTestStudent(lab.id);
    const partner = await createTestStudent(lab.id);
    const isolated = await createTestStudent(lab.id);
    const loner = await createTestStudent(lab.id);
    const examA = await createTestExam(moduleA.id, { questionCount: 3 });
    const examB = await createTestExam(moduleB.id, { questionCount: 3 });
    fixtures = [examA, examB, weak, partner, isolated, loner, lab, moduleA, moduleB];

    const answer = async (
      exam: typeof examA,
      studentId: string,
      results: boolean[] // one entry per question, true = correct
    ) => {
      for (let i = 0; i < results.length; i++) {
        const question = exam.questions[i];
        const attempt = await db.examAttempt.create({
          data: {
            examId: exam.examId, studentId, attemptNumber: i + 1, status: "SUBMITTED",
            questionIds: [question.id], startedAt: new Date(), expiresAt: new Date(), finishedAt: new Date(),
            scorePercent: results[i] ? 100 : 0, passed: results[i],
          },
        });
        await db.attemptAnswer.create({
          data: {
            attemptId: attempt.id, questionId: question.id,
            optionId: results[i] ? question.correctOptionId : question.wrongOptionId,
          },
        });
      }
    };

    // weak: 1/3 correct on moduleA (33%)
    await answer(examA, weak.id, [false, false, true]);
    // partner: 3/3 correct on moduleA (100%) -- should be suggested as weak's tutor
    await answer(examA, partner.id, [true, true, true]);
    // isolated: 0/3 on moduleB (0%, clears the floor) but nobody else qualifies on moduleB
    await answer(examB, isolated.id, [false, false, false]);
    // loner: only 1 answer on moduleB -- below the 3-answer sample floor entirely
    await answer(examB, loner.id, [false]);

    const roster: RosterEntry[] = [weak, partner, isolated, loner].map((s) => ({
      enrollmentId: `fake-${s.id}`, studentId: s.id, name: "Test Student", email: "", joinedAt: new Date(),
    }));

    const suggestions = await getStudyBuddySuggestions(roster);

    expect(suggestions).toHaveLength(1);
    expect(suggestions[0]).toMatchObject({
      studentId: weak.id, weakPercent: 33,
      partnerId: partner.id, partnerPercent: 100,
    });
    expect(suggestions.find((s) => s.studentId === partner.id)).toBeUndefined();
    expect(suggestions.find((s) => s.studentId === isolated.id)).toBeUndefined();
    expect(suggestions.find((s) => s.studentId === loner.id)).toBeUndefined();
  });

  test("a roster of fewer than 2 students returns [] without querying", async () => {
    const lab = await createTestLab();
    const student = await createTestStudent(lab.id);
    fixtures = [student, lab];

    const roster: RosterEntry[] = [
      { enrollmentId: "fake", studentId: student.id, name: "Test Student", email: "", joinedAt: new Date() },
    ];
    expect(await getStudyBuddySuggestions(roster)).toEqual([]);
    expect(await getStudyBuddySuggestions([])).toEqual([]);
  });
});
