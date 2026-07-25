/** POST /api/doubts/:doubtId/resolve — any teacher marks an already-answered question resolved. */
import { auth } from "@/lib/auth";
import { resolveDoubt } from "@/lib/doubts";

export async function POST(_req: Request, { params }: { params: Promise<{ doubtId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { doubtId } = await params;

  const result = await resolveDoubt(doubtId, session.user.id);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true });
}
