/** POST /api/exams/:id/questions/bulk — add several questions at once (paste / PDF review flows). */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const questionSchema = z.object({
  text: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
});
const bodySchema = z.object({ questions: z.array(questionSchema).min(1).max(200) });

export async function POST(req: Request, { params }: { params: Promise<{ examId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { examId } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body", issues: parsed.error.issues }, { status: 400 });
  }

  const exam = await db.exam.findUnique({ where: { id: examId } });
  if (!exam) return Response.json({ error: "Exam not found" }, { status: 404 });

  // Nested creates aren't supported by Prisma's createMany, so this loops
  // inside one transaction — simplest correct approach at this scale.
  const created = await db.$transaction(async (tx) => {
    let nextOrder = (await tx.question.count({ where: { examId } })) + 1;
    const rows = [];
    for (const q of parsed.data.questions) {
      rows.push(
        await tx.question.create({
          data: {
            examId,
            text: q.text,
            order: nextOrder++,
            options: {
              create: q.options.map((text, i) => ({ text, isCorrect: i === q.correctIndex, order: i + 1 })),
            },
          },
          include: { options: { orderBy: { order: "asc" } } },
        })
      );
    }
    return rows;
  });

  return Response.json({ created }, { status: 201 });
}
