/** PATCH /api/exams/:id/questions/bulk-active — retire or restore several questions at once. */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const bodySchema = z.object({
  questionIds: z.array(z.string().min(1)).min(1),
  active: z.boolean(),
});

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

  const result = await db.question.updateMany({
    where: { id: { in: parsed.data.questionIds }, examId },
    data: { active: parsed.data.active },
  });

  return Response.json({ updated: result.count });
}
