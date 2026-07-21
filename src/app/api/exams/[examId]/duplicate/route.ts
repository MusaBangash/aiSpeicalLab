/**
 * POST /api/exams/:id/duplicate — clone an exam's settings and active
 * question bank as a new DRAFT. Retired questions, attempts, and records
 * are never copied — a duplicate starts clean, regardless of the
 * source's status.
 */
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(_req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { examId } = await params;
  const source = await db.exam.findUnique({
    where: { id: examId },
    include: { questions: { where: { active: true }, include: { options: { orderBy: { order: "asc" } } } } },
  });
  if (!source) return Response.json({ error: "Exam not found" }, { status: 404 });

  const duplicate = await db.exam.create({
    data: {
      title: `${source.title} (copy)`,
      moduleId: source.moduleId,
      durationMinutes: source.durationMinutes,
      cooldownHours: source.cooldownHours,
      passMarkPercent: source.passMarkPercent,
      questionsShown: source.questionsShown,
      status: "DRAFT",
      questions: {
        create: source.questions.map((q) => ({
          text: q.text,
          options: {
            create: q.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect, order: o.order })),
          },
        })),
      },
    },
  });

  return Response.json(duplicate, { status: 201 });
}
