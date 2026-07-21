/** GET /api/screen-view/recordings/:recordingId/frames/:frameId — serves one saved JPEG frame. Only the recording's own teacher can read it. */
export const runtime = "nodejs";

import { readFile } from "node:fs/promises";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { frameFilePath } from "@/lib/screenStorage";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ recordingId: string; frameId: string }> }
) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { recordingId, frameId } = await params;

  const frame = await db.screenRecordingFrame.findUnique({ where: { id: frameId }, include: { recording: true } });
  if (!frame || frame.recordingId !== recordingId) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  if (frame.recording.teacherId !== session.user.id) {
    return Response.json({ error: "Only the teacher who saved this recording can view it" }, { status: 403 });
  }

  const bytes = await readFile(frameFilePath(recordingId, frameId)).catch(() => null);
  if (!bytes) return Response.json({ error: "Frame file missing on disk" }, { status: 404 });

  return new Response(bytes, {
    headers: { "Content-Type": "image/jpeg", "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
