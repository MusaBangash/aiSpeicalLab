/** POST /api/exams/:id/finish — submit, score, update ExamRecord, seal if passed */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { finishAttempt } from "@/lib/exam";

const bodySchema = z.object({ attemptId: z.string() });

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { attemptId } = parsed.data;

  const attempt = await db.examAttempt.findUnique({ where: { id: attemptId } });
  if (!attempt) {
    return Response.json({ error: "Attempt not found" }, { status: 404 });
  }
  if (attempt.studentId !== session.user.id) {
    return Response.json({ error: "This attempt does not belong to you" }, { status: 403 });
  }

  // Server clock is the only source of truth for "did time run out" — never trust the client.
  const auto = Date.now() > attempt.expiresAt.getTime();
  const result = await finishAttempt(attemptId, auto);

  return Response.json(result);
}
