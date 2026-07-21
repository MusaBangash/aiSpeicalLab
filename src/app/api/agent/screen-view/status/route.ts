/**
 * GET /api/agent/screen-view/status?hostname=... — polled by the lab agent
 * every ~2s. Drives the mandatory on-screen overlay directly: active:false
 * hides it on the very next poll.
 *
 * Self-healing: this route is also where a session gets closed if the
 * TEACHER'S browser has stopped polling /live (closed tab, crash, network
 * loss) — lastViewedAt is bumped only by that teacher-facing route, never
 * by the agent's own frame upload, so a stale lastViewedAt here means
 * nobody is actually watching anymore even though the agent itself is
 * still fine. Bounds the overlay's worst-case "stuck on" time to about one
 * agent poll interval instead of waiting for the coarser cron sweep.
 */
import { db } from "@/lib/db";
import { clearLatestFrame } from "@/lib/screenView";

const VIEWER_STALE_MS = 8_000; // teacher hasn't polled /live in this long
const GRACE_MS = 15_000; // allowance before the first /live poll ever lands

export async function GET(req: Request) {
  const key = req.headers.get("x-agent-key");
  if (key !== process.env.AGENT_API_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const hostname = new URL(req.url).searchParams.get("hostname");
  if (!hostname) return Response.json({ error: "Missing hostname" }, { status: 400 });

  const pc = await db.pC.findUnique({ where: { hostname } });
  if (!pc) return Response.json({ error: "Unknown PC" }, { status: 404 });

  const activeSession = await db.screenViewSession.findFirst({ where: { pcId: pc.id, endedAt: null } });
  if (!activeSession) return Response.json({ active: false });

  const referenceTime = activeSession.lastViewedAt ?? activeSession.startedAt;
  const allowance = activeSession.lastViewedAt ? VIEWER_STALE_MS : GRACE_MS;
  const stale = Date.now() - referenceTime.getTime() > allowance;

  if (stale) {
    await db.screenViewSession.update({ where: { id: activeSession.id }, data: { endedAt: new Date() } });
    clearLatestFrame(activeSession.id);
    return Response.json({ active: false });
  }

  return Response.json({
    active: true,
    sessionId: activeSession.id,
    saving: activeSession.saveRequestedAt !== null,
  });
}
