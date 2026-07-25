/**
 * Exam engine — every rule from docs/02-exam-spec.md lives HERE, in one
 * place. API routes and pages call these functions; they never
 * re-implement scoring, timing, or retake rules themselves.
 */
import type { AttemptStatus, ExamAttempt } from "@prisma/client";
import { db } from "./db";
import { checkAndAwardExamBadges } from "./badges";

export type StartBlock =
  | { blocked: false }
  | { blocked: true; reason: "SEALED"; scorePercent: number; verificationId: string }
  | { blocked: true; reason: "IN_PROGRESS"; attemptId: string }
  | { blocked: true; reason: "NOT_YET_OPEN"; opensAt: Date }
  | { blocked: true; reason: "CLOSED"; closesAt: Date }
  | { blocked: true; reason: "COOLDOWN"; availableAt: Date };

export type FinishResult = {
  scorePercent: number;
  passed: boolean;
  correctCount: number;
  totalCount: number;
  verificationId: string;
};

export class ExamRuleError extends Error {
  code: "NOT_OWNER" | "NOT_IN_PROGRESS" | "EXPIRED" | "INVALID_QUESTION";
  constructor(code: ExamRuleError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function questionIdsOf(attempt: { questionIds: unknown }): string[] {
  return attempt.questionIds as string[];
}

/** djb2 string hash — good enough to seed a PRNG, not for anything cryptographic. */
function hashSeed(seed: string): number {
  let h = 5381;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 33) ^ seed.charCodeAt(i);
  }
  return h >>> 0;
}

/** mulberry32 — small deterministic PRNG so the same seed always produces the same sequence. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Deterministic shuffle keyed by `seed` — the same seed always yields the
 * same order. Used to randomize each student's option order per question
 * without storing anything extra: seeding on (attemptId, questionId)
 * means the order is stable across resume/reload but differs attempt to
 * attempt, which is all the anti-cheat goal needs.
 */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const rand = mulberry32(hashSeed(seed));
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Fisher–Yates shuffle of active question ids, sliced to `questionsShown`. */
export async function drawQuestions(examId: string, questionsShown: number): Promise<string[]> {
  const active = await db.question.findMany({
    where: { examId, active: true },
    select: { id: true },
  });
  const ids = active.map((q) => q.id);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  return ids.slice(0, questionsShown);
}

/**
 * Decides whether a student may (re)start an exam. Check order matters —
 * sealed beats everything, an open attempt beats cooldown, per the spec's
 * retake rules.
 */
export async function canStartAttempt(studentId: string, examId: string): Promise<StartBlock> {
  const record = await db.examRecord.findUnique({ where: { examId_studentId: { examId, studentId } } });
  if (record?.sealedAt) {
    return { blocked: true, reason: "SEALED", scorePercent: record.scorePercent, verificationId: record.verificationId };
  }

  const inProgress = await db.examAttempt.findFirst({
    where: { examId, studentId, status: "IN_PROGRESS" },
  });
  if (inProgress) {
    return { blocked: true, reason: "IN_PROGRESS", attemptId: inProgress.id };
  }

  const exam = await db.exam.findUniqueOrThrow({ where: { id: examId } });

  // The window only gates STARTING a new attempt — an attempt already
  // IN_PROGRESS (checked above) is always resumable to completion, same
  // principle as its own per-attempt timer running independently of this.
  const now = new Date();
  if (exam.opensAt && now < exam.opensAt) {
    return { blocked: true, reason: "NOT_YET_OPEN", opensAt: exam.opensAt };
  }
  if (exam.closesAt && now > exam.closesAt) {
    return { blocked: true, reason: "CLOSED", closesAt: exam.closesAt };
  }

  const lastFinished = await db.examAttempt.findFirst({
    where: { examId, studentId, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
    orderBy: { finishedAt: "desc" },
  });
  if (lastFinished?.finishedAt) {
    const availableAt = new Date(lastFinished.finishedAt.getTime() + exam.cooldownHours * 60 * 60 * 1000);
    if (availableAt.getTime() > Date.now()) {
      return { blocked: true, reason: "COOLDOWN", availableAt };
    }
  }

  return { blocked: false };
}

/**
 * Resume an IN_PROGRESS attempt unchanged (same frozen questions, same
 * expiresAt — the timer never resets on crash), or start a fresh one.
 * Wrapped in a transaction to guard against a double-click race creating
 * two attempts at once.
 */
export async function resumeOrStart(
  studentId: string,
  examId: string,
  pcHostname?: string | null
): Promise<ExamAttempt> {
  return db.$transaction(async (tx) => {
    const existing = await tx.examAttempt.findFirst({
      where: { examId, studentId, status: "IN_PROGRESS" },
    });
    if (existing) {
      // Resuming on a different PC — questionIds/expiresAt stay frozen,
      // but pcHostname tracks the *last* machine, per the schema comment.
      if (pcHostname && pcHostname !== existing.pcHostname) {
        return tx.examAttempt.update({ where: { id: existing.id }, data: { pcHostname } });
      }
      return existing;
    }

    const record = await tx.examRecord.findUnique({ where: { examId_studentId: { examId, studentId } } });
    if (record?.sealedAt) {
      throw new ExamRuleError("NOT_IN_PROGRESS", "Exam already passed and sealed.");
    }

    const exam = await tx.exam.findUniqueOrThrow({ where: { id: examId } });

    const now = new Date();
    if (exam.opensAt && now < exam.opensAt) {
      throw new ExamRuleError("NOT_IN_PROGRESS", "Exam has not opened yet.");
    }
    if (exam.closesAt && now > exam.closesAt) {
      throw new ExamRuleError("NOT_IN_PROGRESS", "Exam is closed.");
    }

    const lastFinished = await tx.examAttempt.findFirst({
      where: { examId, studentId, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
      orderBy: { finishedAt: "desc" },
    });
    if (lastFinished?.finishedAt) {
      const availableAt = lastFinished.finishedAt.getTime() + exam.cooldownHours * 60 * 60 * 1000;
      if (availableAt > Date.now()) {
        throw new ExamRuleError("NOT_IN_PROGRESS", "Cooldown has not elapsed.");
      }
    }

    const priorCount = await tx.examAttempt.count({ where: { examId, studentId } });
    const questionIds = await drawQuestions(examId, exam.questionsShown);

    return tx.examAttempt.create({
      data: {
        examId,
        studentId,
        attemptNumber: priorCount + 1,
        status: "IN_PROGRESS",
        startedAt: now,
        expiresAt: new Date(now.getTime() + exam.durationMinutes * 60 * 1000),
        questionIds,
        pcHostname: pcHostname ?? null,
      },
    });
  });
}

/**
 * Auto-save one answer. Rejects ownership violations, finished attempts,
 * expired attempts (auto-submitting them on the way out), and questions
 * outside the attempt's frozen draw.
 */
export async function saveAnswer(
  studentId: string,
  attemptId: string,
  questionId: string,
  optionId: string | null
): Promise<void> {
  const attempt = await db.examAttempt.findUniqueOrThrow({ where: { id: attemptId } });

  if (attempt.studentId !== studentId) {
    throw new ExamRuleError("NOT_OWNER", "This attempt does not belong to you.");
  }
  if (attempt.status !== "IN_PROGRESS") {
    throw new ExamRuleError("NOT_IN_PROGRESS", "This attempt is no longer in progress.");
  }
  if (Date.now() > attempt.expiresAt.getTime()) {
    await finishAttempt(attempt.id, true);
    throw new ExamRuleError("EXPIRED", "Time is up; the attempt was auto-submitted.");
  }
  if (!questionIdsOf(attempt).includes(questionId)) {
    throw new ExamRuleError("INVALID_QUESTION", "That question is not part of this attempt.");
  }

  await db.attemptAnswer.upsert({
    where: { attemptId_questionId: { attemptId, questionId } },
    update: { optionId },
    create: { attemptId, questionId, optionId },
  });
}

/** Aggregate correct/total for an attempt, without ever exposing per-question correctness. */
export async function getAttemptScoreBreakdown(attemptId: string): Promise<{ correctCount: number; totalCount: number }> {
  const attempt = await db.examAttempt.findUniqueOrThrow({ where: { id: attemptId } });
  const questionIds = questionIdsOf(attempt);

  const correctOptions = await db.questionOption.findMany({
    where: { questionId: { in: questionIds }, isCorrect: true },
    select: { questionId: true, id: true },
  });
  const correctByQuestion = new Map(correctOptions.map((o) => [o.questionId, o.id]));

  const answers = await db.attemptAnswer.findMany({
    where: { attemptId },
    select: { questionId: true, optionId: true },
  });
  const correctCount = answers.filter((a) => a.optionId && a.optionId === correctByQuestion.get(a.questionId)).length;

  return { correctCount, totalCount: questionIds.length };
}

export type TopicBreakdownRow = {
  moduleId: string;
  moduleTitle: string;
  correctCount: number;
  totalCount: number;
  percentCorrect: number;
};

/**
 * Per-topic strength/weakness across EVERY attempt a student has ever made
 * (all retries, not just the latest/official one per exam) — a deliberate
 * departure from the ExamRecord-latest-attempt convention used elsewhere
 * (avg score, exams passed). This is a historical struggle-frequency view,
 * not a current-standing view. A question's effective topic is its own
 * moduleId if explicitly tagged, else the whole exam's moduleId.
 */
export async function getStudentTopicBreakdown(studentId: string): Promise<TopicBreakdownRow[]> {
  const attempts = await db.examAttempt.findMany({
    where: { studentId, status: { in: ["SUBMITTED", "AUTO_SUBMITTED"] } },
    select: { id: true, questionIds: true },
  });
  if (attempts.length === 0) return [];

  const allQuestionIds = [...new Set(attempts.flatMap((a) => questionIdsOf(a)))];

  const questions = await db.question.findMany({
    where: { id: { in: allQuestionIds } },
    select: { id: true, moduleId: true, exam: { select: { moduleId: true } } },
  });
  const effectiveModuleByQuestion = new Map(questions.map((q) => [q.id, q.moduleId ?? q.exam.moduleId]));

  const correctOptions = await db.questionOption.findMany({
    where: { questionId: { in: allQuestionIds }, isCorrect: true },
    select: { questionId: true, id: true },
  });
  const correctByQuestion = new Map(correctOptions.map((o) => [o.questionId, o.id]));

  const answers = await db.attemptAnswer.findMany({
    where: { attemptId: { in: attempts.map((a) => a.id) }, optionId: { not: null } },
    select: { questionId: true, optionId: true },
  });

  const tally = new Map<string, { correct: number; total: number }>();
  for (const a of answers) {
    const moduleId = effectiveModuleByQuestion.get(a.questionId);
    if (!moduleId) continue;
    const row = tally.get(moduleId) ?? { correct: 0, total: 0 };
    row.total += 1;
    if (a.optionId === correctByQuestion.get(a.questionId)) row.correct += 1;
    tally.set(moduleId, row);
  }

  const modules = await db.curriculumModule.findMany({ where: { id: { in: [...tally.keys()] } } });
  const titleById = new Map(modules.map((m) => [m.id, m.title]));

  return [...tally.entries()]
    .map(([moduleId, { correct, total }]) => ({
      moduleId,
      moduleTitle: titleById.get(moduleId) ?? "Unknown module",
      correctCount: correct,
      totalCount: total,
      percentCorrect: Math.round((100 * correct) / total),
    }))
    .sort((a, b) => a.percentCorrect - b.percentCorrect);
}

/**
 * Score, seal (if passed), and record the attempt as the student's
 * official result. Idempotent — calling this twice on an already-finished
 * attempt just returns the stored result (handles double-submit and sweep
 * races safely).
 */
export async function finishAttempt(attemptId: string, auto: boolean): Promise<FinishResult> {
  const attempt = await db.examAttempt.findUniqueOrThrow({ where: { id: attemptId } });

  if (attempt.status !== "IN_PROGRESS") {
    const record = await db.examRecord.findUniqueOrThrow({
      where: { examId_studentId: { examId: attempt.examId, studentId: attempt.studentId } },
    });
    const { correctCount, totalCount } = await getAttemptScoreBreakdown(attemptId);
    return {
      scorePercent: attempt.scorePercent ?? record.scorePercent,
      passed: attempt.passed ?? record.passed,
      correctCount,
      totalCount,
      verificationId: record.verificationId,
    };
  }

  const exam = await db.exam.findUniqueOrThrow({ where: { id: attempt.examId } });
  const { correctCount, totalCount } = await getAttemptScoreBreakdown(attemptId);
  const scorePercent = round1((correctCount / totalCount) * 100);
  const passed = scorePercent >= exam.passMarkPercent;
  const status: AttemptStatus = auto ? "AUTO_SUBMITTED" : "SUBMITTED";
  const now = new Date();

  const record = await db.$transaction(async (tx) => {
    await tx.examAttempt.update({
      where: { id: attemptId },
      data: { status, finishedAt: now, scorePercent, passed },
    });

    return tx.examRecord.upsert({
      where: { examId_studentId: { examId: attempt.examId, studentId: attempt.studentId } },
      update: {
        latestAttemptId: attemptId,
        scorePercent,
        passed,
        sealedAt: passed ? now : undefined,
      },
      create: {
        examId: attempt.examId,
        studentId: attempt.studentId,
        latestAttemptId: attemptId,
        scorePercent,
        passed,
        sealedAt: passed ? now : null,
      },
    });
  });

  try {
    await checkAndAwardExamBadges(attempt.studentId, scorePercent, passed);
  } catch (err) {
    console.error("badge award failed on exam finish", err);
    // deliberately swallowed — a badge-award bug must never block the exam result
  }

  return { scorePercent, passed, correctCount, totalCount, verificationId: record.verificationId };
}

/** Cron target: auto-submit any attempt whose timer has run out. Returns the count swept. */
export async function sweepExpired(): Promise<number> {
  const expired = await db.examAttempt.findMany({
    where: { status: "IN_PROGRESS", expiresAt: { lt: new Date() } },
    select: { id: true },
  });
  for (const { id } of expired) {
    await finishAttempt(id, true);
  }
  return expired.length;
}
