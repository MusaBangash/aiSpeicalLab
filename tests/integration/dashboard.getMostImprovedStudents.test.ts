import { describe, test, expect, afterEach } from "vitest";
import { db } from "@/lib/db";
import { getMostImprovedStudents } from "@/lib/dashboard";
import { createTestLab, createTestStudent, createTestModule, createTestExam } from "./helpers";

describe("getMostImprovedStudents", () => {
  let fixtures: { cleanup: () => Promise<void> }[] = [];

  afterEach(async () => {
    for (const f of fixtures) await f.cleanup();
    fixtures = [];
  });

  test("splits ExamRecord history at the 30-day cutoff: improving student ranks above a declining one, one-window-only students are excluded", async () => {
    const today = new Date(2026, 6, 24);
    const cutoff = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const priorDate = new Date(cutoff.getTime() - 10 * 24 * 60 * 60 * 1000); // well before the cutoff
    const recentDate = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000); // well after the cutoff

    const module = await createTestModule();
    const lab = await createTestLab();
    const examOld = await createTestExam(module.id, { questionCount: 1 });
    const examNew = await createTestExam(module.id, { questionCount: 1 });
    const improving = await createTestStudent(lab.id);
    const declining = await createTestStudent(lab.id);
    const recentOnly = await createTestStudent(lab.id);
    const priorOnly = await createTestStudent(lab.id);
    fixtures = [examOld, examNew, improving, declining, recentOnly, priorOnly, lab, module];

    const record = async (
      exam: typeof examOld,
      studentId: string,
      scorePercent: number,
      updatedAt: Date
    ) => {
      const question = exam.questions[0];
      const attempt = await db.examAttempt.create({
        data: {
          examId: exam.examId, studentId, attemptNumber: 1, status: "SUBMITTED",
          questionIds: [question.id], startedAt: new Date(), expiresAt: new Date(), finishedAt: new Date(),
          scorePercent, passed: scorePercent >= 50,
        },
      });
      await db.examRecord.create({
        data: {
          examId: exam.examId, studentId, latestAttemptId: attempt.id,
          scorePercent, passed: scorePercent >= 50, updatedAt,
        },
      });
    };

    // improving: 40% -> 70% (gap 60, closes 30 of it -> 50%)
    await record(examOld, improving.id, 40, priorDate);
    await record(examNew, improving.id, 70, recentDate);

    // declining: 80% -> 60% (negative raw improvement -> clamped to 0, not excluded)
    await record(examOld, declining.id, 80, priorDate);
    await record(examNew, declining.id, 60, recentDate);

    // only one window each -> excluded entirely, not padded
    await record(examNew, recentOnly.id, 90, recentDate);
    await record(examOld, priorOnly.id, 20, priorDate);

    const rows = await getMostImprovedStudents(today);

    const improvingRow = rows.find((r) => r.id === improving.id);
    const decliningRow = rows.find((r) => r.id === declining.id);

    expect(improvingRow).toEqual({ id: improving.id, name: "Test Student", priorAvg: 40, recentAvg: 70, improvementPercent: 50 });
    expect(decliningRow).toEqual({ id: declining.id, name: "Test Student", priorAvg: 80, recentAvg: 60, improvementPercent: 0 });
    expect(rows.find((r) => r.id === recentOnly.id)).toBeUndefined();
    expect(rows.find((r) => r.id === priorOnly.id)).toBeUndefined();

    // Sorted highest-improvement-first.
    expect(rows.indexOf(improvingRow!)).toBeLessThan(rows.indexOf(decliningRow!));
  });

  test("a student with zero ExamRecord history never appears, no error", async () => {
    const lab = await createTestLab();
    const student = await createTestStudent(lab.id);
    fixtures = [student, lab];

    const rows = await getMostImprovedStudents(new Date(2026, 6, 24));
    expect(rows.find((r) => r.id === student.id)).toBeUndefined();
  });
});
