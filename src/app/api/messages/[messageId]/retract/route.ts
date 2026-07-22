/** POST /api/messages/:messageId/retract — sending teacher soft-deletes a message (never hard-deleted). */
import { auth } from "@/lib/auth";
import { retractMessage } from "@/lib/messages";

export async function POST(_req: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messageId } = await params;
  const result = await retractMessage(messageId, session.user.id);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true });
}
