/**
 * GET /api/cron/sweep — periodic housekeeping, driven externally (OS cron
 * on the R730 in production; the dev heartbeat simulator hits this on an
 * interval). Auto-submits expired exam attempts and closes stale lab
 * sessions.
 */
import { sweepExpired } from "@/lib/exam";
import { closeStaleSessions } from "@/lib/attendance";
import { closeStaleActivitySegments } from "@/lib/activity";
import { closeStaleScreenViewSessions, sweepExpiredRecordings } from "@/lib/screenView";

export async function GET(req: Request) {
  const key = req.headers.get("x-agent-key");
  if (key !== process.env.AGENT_API_KEY) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [attemptsSwept, sessionsClosed, activitySegmentsClosed, screenViewSessionsClosed, recordingsDeleted] = await Promise.all([
    sweepExpired(),
    closeStaleSessions(),
    closeStaleActivitySegments(),
    closeStaleScreenViewSessions(),
    sweepExpiredRecordings(),
  ]);
  return Response.json({ attemptsSwept, sessionsClosed, activitySegmentsClosed, screenViewSessionsClosed, recordingsDeleted });
}
