/** POST /api/exams/:id/questions/:questionId/duplicate — copy one question + its options, appended at the end. */
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(_req: Request, { params }: { params: Promise<{ examId: string; questionId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { examId, questionId } = await params;
  const source = await db.question.findUnique({
    where: { id: questionId },
    include: { options: { orderBy: { order: "asc" } } },
  });
  if (!source || source.examId !== examId) {
    return Response.json({ error: "Question not found" }, { status: 404 });
  }

  const nextOrder = (await db.question.count({ where: { examId } })) + 1;
  const duplicate = await db.question.create({
    data: {
      examId,
      text: source.text,
      order: nextOrder,
      options: {
        create: source.options.map((o) => ({ text: o.text, isCorrect: o.isCorrect, order: o.order })),
      },
    },
    include: { options: { orderBy: { order: "asc" } } },
  });

  return Response.json(duplicate, { status: 201 });
}
