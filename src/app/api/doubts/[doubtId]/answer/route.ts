/** POST /api/doubts/:doubtId/answer — any teacher answers (or edits an existing answer to) a question. */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { answerDoubt } from "@/lib/doubts";

const bodySchema = z.object({ answerBody: z.string().min(1) });

export async function POST(req: Request, { params }: { params: Promise<{ doubtId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { doubtId } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await answerDoubt(doubtId, session.user.id, parsed.data.answerBody);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true });
}
