/**
 * On-demand teacher screen-viewing — in-memory live-frame store + session
 * helpers. Live (unsaved) frames never touch the DB or disk, which is what
 * makes casual viewing genuinely ephemeral; only an explicit "Save this
 * session" persists anything (see screenStorage.ts).
 */
import { rm } from "node:fs/promises";
import { db } from "./db";
import { recordingDirPath } from "./screenStorage";

type LiveFrame = { bytes: Buffer; capturedAt: Date };

// globalThis-survives-HMR pattern, same as db.ts's Prisma singleton — valid
// because this app runs as one long-lived Node process per deployment, not
// serverless/multi-instance.
const g = globalThis as unknown as { screenViewFrames?: Map<string, LiveFrame> };
const frames = g.screenViewFrames ?? new Map<string, LiveFrame>();
if (process.env.NODE_ENV !== "production") g.screenViewFrames = frames;

export function setLatestFrame(sessionId: string, bytes: Buffer, capturedAt: Date): void {
  frames.set(sessionId, { bytes, capturedAt });
}

export function getLatestFrame(sessionId: string): LiveFrame | undefined {
  return frames.get(sessionId);
}

export function clearLatestFrame(sessionId: string): void {
  frames.delete(sessionId);
}

/**
 * Cron-sweep backstop for sessions whose agent went offline entirely (PC
 * powered down mid-session). The agent-facing status route's own
 * lastViewedAt staleness check is the primary mechanism and fires much
 * faster (~8-15s) — this is a coarse safety net, not the main path.
 */
export async function closeStaleScreenViewSessions(staleMs = 90_000): Promise<number> {
  const cutoff = new Date(Date.now() - staleMs);
  const stale = await db.screenViewSession.findMany({
    where: {
      endedAt: null,
      OR: [{ lastViewedAt: { lt: cutoff } }, { lastViewedAt: null, startedAt: { lt: cutoff } }],
    },
    select: { id: true },
  });
  if (stale.length === 0) return 0;
  await db.screenViewSession.updateMany({
    where: { id: { in: stale.map((s) => s.id) } },
    data: { endedAt: new Date() },
  });
  stale.forEach((s) => clearLatestFrame(s.id));
  return stale.length;
}

export type RecordingSummary = {
  id: string;
  createdAt: Date;
  frameCount: number;
};

/** Only the given teacher's own recordings for this student — ownership filtered into the query, not a post-hoc check. */
export async function getRecordingsForStudent(teacherId: string, studentId: string): Promise<RecordingSummary[]> {
  const recordings = await db.screenRecording.findMany({
    where: { teacherId, studentId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { frames: true } } },
  });
  return recordings.map((r) => ({ id: r.id, createdAt: r.createdAt, frameCount: r._count.frames }));
}

export type RecordingWithFrames = {
  id: string;
  studentId: string;
  createdAt: Date;
  frames: { id: string; capturedAt: Date }[];
};

/** Returns null if the recording doesn't exist OR doesn't belong to this teacher — caller should redirect on null, same as the existing student-not-found pattern. */
export async function getRecordingWithFrames(teacherId: string, recordingId: string): Promise<RecordingWithFrames | null> {
  const recording = await db.screenRecording.findUnique({
    where: { id: recordingId },
    include: { frames: { orderBy: { capturedAt: "asc" }, select: { id: true, capturedAt: true } } },
  });
  if (!recording || recording.teacherId !== teacherId) return null;
  return { id: recording.id, studentId: recording.studentId, createdAt: recording.createdAt, frames: recording.frames };
}

export const RECORDING_RETENTION_DAYS = Number(process.env.RECORDING_RETENTION_DAYS ?? 90);

/**
 * Cron sweep: permanently deletes ScreenRecordings (and their on-disk frame
 * directories) older than RECORDING_RETENTION_DAYS. Disk delete happens
 * FIRST, then DB rows — the failure mode that must never happen is "DB row
 * gone, files still on disk" (a permanent leak, since nothing would ever
 * point at those files again); the reverse ("files gone, DB row remains")
 * is self-healing, since the row's createdAt is still past the cutoff and
 * the next sweep picks it right back up (rm's force:true makes the
 * already-gone directory a safe no-op). ScreenRecordingFrame's FK is
 * ON DELETE RESTRICT (confirmed in migration SQL), so frames must be
 * deleted explicitly before the recording row — cascade cannot be assumed.
 */
export async function sweepExpiredRecordings(retentionDays = RECORDING_RETENTION_DAYS): Promise<number> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
  const expired = await db.screenRecording.findMany({ where: { createdAt: { lt: cutoff } }, select: { id: true } });
  if (expired.length === 0) return 0;

  for (const { id } of expired) {
    await rm(recordingDirPath(id), { recursive: true, force: true });
    await db.screenRecordingFrame.deleteMany({ where: { recordingId: id } });
    await db.screenRecording.delete({ where: { id } });
  }
  return expired.length;
}
