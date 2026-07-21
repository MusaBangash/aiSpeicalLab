/** Activity telemetry — app-focus/window-title segments, mirroring Session's open/close shape. */
import { db } from "./db";

/** Below this many idle seconds, a segment counts as "active" for display. Lives here (TS), not
 *  in the Python agent, so the threshold can change without redeploying to 12 PCs. */
export const IDLE_THRESHOLD_SECONDS = 120;

export function isIdle(idleSeconds: number): boolean {
  return idleSeconds >= IDLE_THRESHOLD_SECONDS;
}

const STALE_MINUTES = 5;

/**
 * Opens/updates/closes an ActivitySegment for one heartbeat's telemetry.
 * If the student's currently-open segment matches (same PC, same app,
 * same window title), just bumps lastSeenAt/idleSeconds. Otherwise closes
 * it and opens a new one. Scoped by studentId (not pcId) so a student
 * roaming PCs mid-segment correctly closes out the old machine's segment.
 */
export async function recordActivity(
  studentId: string,
  pcId: string,
  appName: string,
  windowTitle: string,
  idleSeconds: number,
  now: Date = new Date()
): Promise<void> {
  const openSegment = await db.activitySegment.findFirst({
    where: { studentId, endedAt: null },
    orderBy: { lastSeenAt: "desc" },
  });

  const isSameFocus =
    openSegment &&
    openSegment.pcId === pcId &&
    openSegment.appName === appName &&
    openSegment.windowTitle === windowTitle;

  if (isSameFocus) {
    await db.activitySegment.update({
      where: { id: openSegment.id },
      data: { lastSeenAt: now, idleSeconds },
    });
  } else {
    if (openSegment) {
      await db.activitySegment.update({ where: { id: openSegment.id }, data: { endedAt: now } });
    }
    await db.activitySegment.create({
      data: { studentId, pcId, appName, windowTitle, idleSeconds, startedAt: now, lastSeenAt: now },
    });
  }
}

/** Closes ActivitySegments whose agent has gone quiet for longer than staleMinutes — mirrors closeStaleSessions. */
export async function closeStaleActivitySegments(staleMinutes = STALE_MINUTES): Promise<number> {
  const cutoff = new Date(Date.now() - staleMinutes * 60 * 1000);
  const result = await db.activitySegment.updateMany({
    where: { endedAt: null, lastSeenAt: { lt: cutoff } },
    data: { endedAt: new Date() },
  });
  return result.count;
}

export type StudentActivity = {
  current: {
    appName: string;
    windowTitle: string;
    idleSeconds: number;
    startedAt: Date;
    lastSeenAt: Date;
    pcHostname: string;
  } | null;
  recent: {
    id: string;
    appName: string;
    windowTitle: string;
    idleSeconds: number;
    startedAt: Date;
    endedAt: Date | null;
    durationSeconds: number;
  }[];
};

/**
 * One student's current focus (if any, and not stale) plus recent history,
 * for the teacher profile page. Lives here rather than metrics.ts: that
 * file aggregates exam/attendance/journal averages (numbers computed on
 * read); this is raw chronological segment data, the read-side counterpart
 * to the write helpers above.
 */
export async function getStudentActivity(studentId: string, limit = 20): Promise<StudentActivity> {
  const segments = await db.activitySegment.findMany({
    where: { studentId },
    orderBy: { startedAt: "desc" },
    take: limit + 1,
    include: { pc: { select: { hostname: true } } },
  });

  const staleCutoff = Date.now() - STALE_MINUTES * 60 * 1000;
  let current: StudentActivity["current"] = null;
  const recent: StudentActivity["recent"] = [];

  for (const seg of segments) {
    if (!seg.endedAt && current === null && seg.lastSeenAt.getTime() >= staleCutoff) {
      current = {
        appName: seg.appName,
        windowTitle: seg.windowTitle,
        idleSeconds: seg.idleSeconds,
        startedAt: seg.startedAt,
        lastSeenAt: seg.lastSeenAt,
        pcHostname: seg.pc.hostname,
      };
      continue;
    }
    const end = seg.endedAt ?? seg.lastSeenAt;
    recent.push({
      id: seg.id,
      appName: seg.appName,
      windowTitle: seg.windowTitle,
      idleSeconds: seg.idleSeconds,
      startedAt: seg.startedAt,
      endedAt: seg.endedAt,
      durationSeconds: Math.round((end.getTime() - seg.startedAt.getTime()) / 1000),
    });
    if (recent.length >= limit) break;
  }

  return { current, recent };
}
