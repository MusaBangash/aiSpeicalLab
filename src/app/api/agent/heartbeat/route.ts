/**
 * POST /api/agent/heartbeat — lab agent pings { hostname, studentEmail }
 * every 60s; updates Session.lastHeartbeat; auto-creates today's
 * Attendance as PRESENT on first heartbeat of the day. Optionally carries
 * app-focus telemetry (focusedApp/windowTitle/idleSeconds), recorded as an
 * ActivitySegment when all three are present — an un-upgraded agent's
 * old-shape payload still works unchanged.
 */
import { z } from "zod";
import { db } from "@/lib/db";
import { markPresentIfUnset } from "@/lib/attendance";
import { recordActivity } from "@/lib/activity";

const bodySchema = z.object({
  hostname: z.string().min(1),
  studentEmail: z.string().email(),
  focusedApp: z.string().min(1).optional(),
  windowTitle: z.string().optional(),
  idleSeconds: z.number().int().nonnegative().optional(),
});

export async function POST(req: Request) {
  const key = req.headers.get("x-agent-key");
  if (key !== process.env.AGENT_API_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { hostname, studentEmail } = parsed.data;

  const pc = await db.pC.findUnique({ where: { hostname } });
  if (!pc) return Response.json({ error: "Unknown PC" }, { status: 404 });

  const student = await db.user.findUnique({ where: { email: studentEmail } });
  if (!student || student.role !== "STUDENT") {
    return Response.json({ error: "Unknown student" }, { status: 404 });
  }

  const now = new Date();
  const openSession = await db.session.findFirst({
    where: { studentId: student.id, endedAt: null },
    orderBy: { lastHeartbeat: "desc" },
  });

  let session;
  if (openSession && openSession.pcId === pc.id) {
    session = await db.session.update({ where: { id: openSession.id }, data: { lastHeartbeat: now } });
  } else {
    if (openSession) {
      // Student resumed on a different lab PC — close the old session, open a new one.
      await db.session.update({ where: { id: openSession.id }, data: { endedAt: now } });
    }
    session = await db.session.create({ data: { studentId: student.id, pcId: pc.id, lastHeartbeat: now } });
  }

  // Create-only: never clobbers a teacher's override or a same-day login mark.
  await markPresentIfUnset(student.id, now, session.id);

  const { focusedApp, windowTitle, idleSeconds } = parsed.data;
  if (focusedApp !== undefined && windowTitle !== undefined && idleSeconds !== undefined) {
    await recordActivity(student.id, pc.id, focusedApp, windowTitle, idleSeconds, now);
  }

  return Response.json({ ok: true });
}
