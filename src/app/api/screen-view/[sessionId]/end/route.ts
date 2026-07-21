/** POST /api/screen-view/:sessionId/end — teacher stops viewing; the agent notices on its next status poll and the overlay disappears. */
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clearLatestFrame } from "@/lib/screenView";

export async function POST(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { sessionId } = await params;

  const viewSession = await db.screenViewSession.findUnique({ where: { id: sessionId } });
  if (!viewSession) return Response.json({ error: "Session not found" }, { status: 404 });
  if (viewSession.teacherId !== session.user.id) {
    return Response.json({ error: "Only the teacher who started this session can end it" }, { status: 403 });
  }

  if (viewSession.endedAt === null) {
    await db.screenViewSession.update({ where: { id: sessionId }, data: { endedAt: new Date() } });
  }
  clearLatestFrame(sessionId);

  return Response.json({ ok: true });
}
