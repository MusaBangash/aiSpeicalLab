/**
 * POST /api/screen-view/:sessionId/save — teacher explicitly opts to persist
 * this viewing session. Creates the ScreenRecording row eagerly (avoids a
 * race between two near-simultaneous frame uploads both trying to create it
 * lazily). Frames uploaded before this point were never captured to storage
 * and cannot be recovered — this is a forward-only switch, no "un-save."
 */
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export async function POST(_req: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { sessionId } = await params;

  const viewSession = await db.screenViewSession.findUnique({ where: { id: sessionId } });
  if (!viewSession) return Response.json({ error: "Session not found" }, { status: 404 });
  if (viewSession.teacherId !== session.user.id) {
    return Response.json({ error: "Only the teacher who started this session can save it" }, { status: 403 });
  }
  if (viewSession.endedAt !== null) return Response.json({ error: "Session already ended" }, { status: 400 });
  if (viewSession.saveRequestedAt !== null) return Response.json({ error: "Already saving" }, { status: 400 });

  const now = new Date();
  await db.screenViewSession.update({ where: { id: sessionId }, data: { saveRequestedAt: now } });
  const recording = await db.screenRecording.create({
    data: { sessionId, studentId: viewSession.studentId, teacherId: viewSession.teacherId },
  });

  return Response.json({ recordingId: recording.id });
}
