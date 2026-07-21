/**
 * GET /api/screen-view/:sessionId/live — teacher polls this every ~1.5s for
 * the latest frame. This IS the liveness signal the agent-facing status
 * route relies on: every successful poll bumps lastViewedAt, so a closed
 * browser tab naturally lets the agent's own status check notice nobody is
 * watching anymore and close the session itself.
 */
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getLatestFrame } from "@/lib/screenView";

export async function GET(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { sessionId } = await params;

  const viewSession = await db.screenViewSession.findUnique({ where: { id: sessionId } });
  if (!viewSession) return Response.json({ error: "Session not found" }, { status: 404 });
  if (viewSession.teacherId !== session.user.id) {
    return Response.json({ error: "Only the teacher who started this session can view it" }, { status: 403 });
  }
  if (viewSession.endedAt !== null) {
    return Response.json({ ended: true }, { status: 410 });
  }

  await db.screenViewSession.update({ where: { id: sessionId }, data: { lastViewedAt: new Date() } });

  const frame = getLatestFrame(sessionId);
  if (!frame) return Response.json({ waiting: true }, { status: 202 });

  return new Response(new Uint8Array(frame.bytes), {
    headers: {
      "Content-Type": "image/jpeg",
      "Cache-Control": "no-store",
      "X-Captured-At": frame.capturedAt.toISOString(),
    },
  });
}
