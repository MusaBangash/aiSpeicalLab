/** PATCH /api/exams/:id/questions/:questionId/reorder — swap with the adjacent active question. */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const bodySchema = z.object({ direction: z.enum(["up", "down"]) });

export async function PATCH(req: Request, { params }: { params: Promise<{ examId: string; questionId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { examId, questionId } = await params;
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Retired questions don't participate in ordering — only rank among active ones.
  const active = await db.question.findMany({
    where: { examId, active: true },
    orderBy: { order: "asc" },
    select: { id: true, order: true },
  });
  const index = active.findIndex((q) => q.id === questionId);
  if (index === -1) return Response.json({ error: "Question not found or not active" }, { status: 404 });

  const swapWith = parsed.data.direction === "up" ? index - 1 : index + 1;
  if (swapWith < 0 || swapWith >= active.length) {
    return Response.json({ error: "Already at that end of the list" }, { status: 409 });
  }

  const a = active[index];
  const b = active[swapWith];
  await db.$transaction([
    db.question.update({ where: { id: a.id }, data: { order: b.order } }),
    db.question.update({ where: { id: b.id }, data: { order: a.order } }),
  ]);

  return Response.json({ ok: true });
}
