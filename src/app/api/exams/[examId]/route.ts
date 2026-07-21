/** PATCH /api/exams/:id — publish/archive, or edit settings. DELETE /api/exams/:id — remove a draft. */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const bodySchema = z
  .object({
    status: z.enum(["PUBLISHED", "ARCHIVED"]).optional(),
    title: z.string().min(1).optional(),
    moduleId: z.string().min(1).optional(),
    durationMinutes: z.number().int().positive().optional(),
    cooldownHours: z.number().int().positive().optional(),
    passMarkPercent: z.number().min(0).max(100).optional(),
    questionsShown: z.number().int().positive().optional(),
    opensAt: z.coerce.date().nullable().optional(),
    closesAt: z.coerce.date().nullable().optional(),
  })
  .refine((d) => Object.values(d).some((v) => v !== undefined), { message: "No fields provided" });

export async function PATCH(req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { examId } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const exam = await db.exam.findUnique({ where: { id: examId } });
  if (!exam) return Response.json({ error: "Exam not found" }, { status: 404 });

  // status wins if present — Publish/Archive and Edit-settings are separate
  // forms in the UI, so a request never legitimately carries both.
  if (parsed.data.status) {
    if (parsed.data.status === "PUBLISHED") {
      // Server is the real authority on publish rules, regardless of what the UI already checked.
      const activeQuestions = await db.question.findMany({
        where: { examId, active: true },
        include: { options: true },
      });
      if (activeQuestions.length < exam.questionsShown) {
        return Response.json(
          { error: `Bank has ${activeQuestions.length} active questions but ${exam.questionsShown} are shown per attempt.` },
          { status: 400 }
        );
      }
      const badQuestion = activeQuestions.find((q) => q.options.filter((o) => o.isCorrect).length !== 1);
      if (badQuestion) {
        return Response.json(
          { error: `Question "${badQuestion.text}" must have exactly one correct option.` },
          { status: 400 }
        );
      }
    }
    const updated = await db.exam.update({ where: { id: examId }, data: { status: parsed.data.status } });
    return Response.json(updated);
  }

  const { title, moduleId, durationMinutes, cooldownHours, passMarkPercent, questionsShown, opensAt, closesAt } =
    parsed.data;
  const updated = await db.exam.update({
    where: { id: examId },
    data: { title, moduleId, durationMinutes, cooldownHours, passMarkPercent, questionsShown, opensAt, closesAt },
  });
  return Response.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { examId } = await params;
  const exam = await db.exam.findUnique({
    where: { id: examId },
    include: { _count: { select: { attempts: true } } },
  });
  if (!exam) return Response.json({ error: "Exam not found" }, { status: 404 });

  if (exam.status !== "DRAFT" || exam._count.attempts > 0) {
    return Response.json(
      { error: "Only draft exams with no attempts can be deleted. Archive it instead." },
      { status: 409 }
    );
  }

  await db.$transaction([
    db.questionOption.deleteMany({ where: { question: { examId } } }),
    db.question.deleteMany({ where: { examId } }),
    db.exam.delete({ where: { id: examId } }),
  ]);

  return Response.json({ ok: true });
}
