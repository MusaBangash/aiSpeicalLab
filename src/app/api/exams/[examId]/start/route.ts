/** POST /api/exams/:id/start — begin or resume an attempt (returns frozen question set + expiresAt) */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { canStartAttempt, resumeOrStart, seededShuffle } from "@/lib/exam";

const bodySchema = z.object({ pcHostname: z.string().optional() });

export async function POST(req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { examId } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const block = await canStartAttempt(session.user.id, examId);
  // IN_PROGRESS is not a real block — it's the crash-resume case, and
  // resumeOrStart below returns that same attempt unchanged. Only SEALED
  // and COOLDOWN actually refuse the request.
  if (block.blocked && block.reason !== "IN_PROGRESS") {
    return Response.json(block, { status: 409 });
  }

  // Best-effort PC lookup from an open lab session; falls back to the
  // client-supplied hostname (useful in dev, where no agent session exists).
  const openSession = await db.session.findFirst({
    where: { studentId: session.user.id, endedAt: null },
    orderBy: { lastHeartbeat: "desc" },
    include: { pc: true },
  });
  const pcHostname = openSession?.pc.hostname ?? parsed.data.pcHostname ?? null;

  const attempt = await resumeOrStart(session.user.id, examId, pcHostname);

  const questions = await db.question.findMany({
    where: { id: { in: attempt.questionIds as string[] } },
    select: {
      id: true,
      text: true,
      options: { select: { id: true, text: true, order: true }, orderBy: { order: "asc" } },
      // isCorrect intentionally omitted — never sent to a student.
    },
  });
  // Preserve the frozen draw order, not the DB's natural order. Options
  // are shuffled per (attempt, question) — stable across resume/reload,
  // but different student to student, so answers aren't shareable by
  // position ("it's C") between students sitting the exam back-to-back.
  const orderedQuestions = (attempt.questionIds as string[]).map((id) => {
    const q = questions.find((q) => q.id === id)!;
    return { ...q, options: seededShuffle(q.options, attempt.id + q.id) };
  });

  const answers = await db.attemptAnswer.findMany({
    where: { attemptId: attempt.id },
    select: { questionId: true, optionId: true },
  });
  const answersMap = Object.fromEntries(answers.map((a) => [a.questionId, a.optionId]));

  return Response.json({
    attemptId: attempt.id,
    attemptNumber: attempt.attemptNumber,
    expiresAt: attempt.expiresAt,
    status: attempt.status,
    questions: orderedQuestions,
    answers: answersMap,
  });
}
