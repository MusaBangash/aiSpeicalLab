/** POST /api/exams/:id/questions — teacher adds a question + 4 options to the bank */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const bodySchema = z.object({
  text: z.string().min(1),
  options: z.array(z.string().min(1)).length(4),
  correctIndex: z.number().int().min(0).max(3),
  moduleId: z.string().min(1).nullable().optional(),
});

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
  const { text, options, correctIndex, moduleId } = parsed.data;

  const existingCount = await db.question.count({ where: { examId } });
  const question = await db.question.create({
    data: {
      examId,
      text,
      order: existingCount + 1,
      moduleId: moduleId ?? null,
      options: {
        create: options.map((optText, i) => ({ text: optText, isCorrect: i === correctIndex, order: i + 1 })),
      },
    },
    include: { options: { orderBy: { order: "asc" } } },
  });

  return Response.json(question, { status: 201 });
}
