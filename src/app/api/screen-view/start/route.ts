/**
 * POST /api/screen-view/start — teacher starts an on-demand live view of a
 * student's screen. Resolves the student's current lab PC via the same
 * open-Session lookup already used by the heartbeat/exam-start routes; 404s
 * if the student isn't currently on a lab PC (clear error, not a silent
 * failure). A second *different* teacher is blocked (409) from concurrently
 * viewing the same student; the *same* teacher reconnecting (e.g. closed the
 * tab without clicking "Stop viewing") silently ends its own stale session
 * first instead of blocking itself.
 */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { clearLatestFrame } from "@/lib/screenView";

const bodySchema = z.object({ studentId: z.string().min(1) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request body" }, { status: 400 });
  const { studentId } = parsed.data;

  const student = await db.user.findUnique({ where: { id: studentId } });
  if (!student || student.role !== "STUDENT") {
    return Response.json({ error: "Student not found" }, { status: 404 });
  }

  const openLabSession = await db.session.findFirst({
    where: { studentId, endedAt: null },
    orderBy: { lastHeartbeat: "desc" },
    include: { pc: true },
  });
  if (!openLabSession) {
    return Response.json({ error: "This student isn't currently on a lab PC" }, { status: 404 });
  }

  const existingActive = await db.screenViewSession.findFirst({ where: { studentId, endedAt: null } });
  if (existingActive) {
    if (existingActive.teacherId !== session.user.id) {
      return Response.json({ error: "Another teacher is already viewing this student's screen" }, { status: 409 });
    }
    await db.screenViewSession.update({ where: { id: existingActive.id }, data: { endedAt: new Date() } });
    clearLatestFrame(existingActive.id);
  }

  const viewSession = await db.screenViewSession.create({
    data: { studentId, teacherId: session.user.id, pcId: openLabSession.pc.id },
  });

  return Response.json({ sessionId: viewSession.id });
}
