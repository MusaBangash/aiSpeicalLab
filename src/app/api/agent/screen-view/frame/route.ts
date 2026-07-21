/**
 * POST /api/agent/screen-view/frame — one raw JPEG body every ~2s while a
 * session is active. Raw binary body (not FormData/base64) since this fires
 * repeatedly, unlike the one-shot PDF upload elsewhere in this app —
 * avoids multipart parsing and base64's size inflation on a tight polling
 * loop. Always updates the in-memory latest-frame map (ephemeral). Only
 * additionally writes to disk + creates a ScreenRecordingFrame row when the
 * session is in "saving" mode — this is the structural guarantee that
 * pre-Save frames are never captured to storage.
 */
export const runtime = "nodejs"; // fs access for saved frames

import { db } from "@/lib/db";
import { setLatestFrame } from "@/lib/screenView";
import { writeFrameToDisk } from "@/lib/screenStorage";

const MAX_FRAME_BYTES = 2 * 1024 * 1024;

export async function POST(req: Request) {
  const key = req.headers.get("x-agent-key");
  if (key !== process.env.AGENT_API_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const sessionId = req.headers.get("x-session-id");
  const hostname = req.headers.get("x-hostname");
  if (!sessionId || !hostname) {
    return Response.json({ error: "Missing x-session-id/x-hostname" }, { status: 400 });
  }

  const viewSession = await db.screenViewSession.findUnique({ where: { id: sessionId }, include: { pc: true } });
  if (!viewSession || viewSession.endedAt !== null) {
    return Response.json({ error: "Session not active" }, { status: 410 });
  }
  // Defense in depth beyond the shared agent key: the uploading PC must be
  // the exact PC this session was opened against.
  if (viewSession.pc.hostname !== hostname) {
    return Response.json({ error: "Hostname/session mismatch" }, { status: 403 });
  }

  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength === 0) return Response.json({ error: "Empty body" }, { status: 400 });
  if (bytes.byteLength > MAX_FRAME_BYTES) return Response.json({ error: "Frame too large" }, { status: 413 });

  const buf = Buffer.from(bytes);
  setLatestFrame(sessionId, buf, new Date());

  if (viewSession.saveRequestedAt !== null) {
    // The ScreenRecording row is created eagerly by /save, not lazily here —
    // avoids a race between two near-simultaneous frame uploads both trying
    // to create it.
    const recording = await db.screenRecording.findUnique({ where: { sessionId } });
    if (recording) {
      const frame = await db.screenRecordingFrame.create({ data: { recordingId: recording.id } });
      await writeFrameToDisk(recording.id, frame.id, buf);
    }
  }

  return Response.json({ ok: true });
}
