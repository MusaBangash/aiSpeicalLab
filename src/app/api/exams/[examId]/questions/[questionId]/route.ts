/** PATCH /api/exams/:id/questions/:questionId — edit text/options, retire, or restore */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const bodySchema = z.object({
  text: z.string().min(1).optional(),
  options: z.array(z.string().min(1)).length(4).optional(),
  correctIndex: z.number().int().min(0).max(3).optional(),
  active: z.boolean().optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ questionId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { questionId } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { text, options, correctIndex, active } = parsed.data;

  if (options && correctIndex === undefined) {
    return Response.json({ error: "correctIndex is required when replacing options" }, { status: 400 });
  }

  const question = await db.$transaction(async (tx) => {
    if (text !== undefined || active !== undefined) {
      await tx.question.update({ where: { id: questionId }, data: { text, active } });
    }
    if (options) {
      await tx.questionOption.deleteMany({ where: { questionId } });
      await tx.question.update({
        where: { id: questionId },
        data: {
          options: {
            create: options.map((optText, i) => ({ text: optText, isCorrect: i === correctIndex, order: i + 1 })),
          },
        },
      });
    }
    return tx.question.findUniqueOrThrow({
      where: { id: questionId },
      include: { options: { orderBy: { order: "asc" } } },
    });
  });

  return Response.json(question);
}
