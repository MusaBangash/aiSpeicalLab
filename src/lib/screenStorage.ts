/**
 * Saved screen-recording frame storage — the first filesystem-writing code
 * anywhere in this app (every other feature fits into Postgres rows).
 * Deliberately on local disk, not in the DB: avoids Postgres/backup bloat
 * for indefinite-retention image data, and matches the self-hosted,
 * offline-LAN deployment model (no S3/cloud storage anywhere in this stack).
 * Deliberately outside public/ (never a static URL — only reachable through
 * the ownership-checked frames/[frameId] route) and outside .next/ (must
 * survive `npm run build`/redeploy — see deploy/docker-compose.yml for the
 * volume mount this requires in production).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const STORAGE_ROOT = process.env.SCREEN_RECORDINGS_DIR ?? path.join(process.cwd(), "var", "screen-recordings");

export function frameFilePath(recordingId: string, frameId: string): string {
  return path.join(STORAGE_ROOT, recordingId, `${frameId}.jpg`);
}

/** The whole recording's directory — used by the retention sweep to delete
 *  every frame file for a recording in one operation. */
export function recordingDirPath(recordingId: string): string {
  return path.join(STORAGE_ROOT, recordingId);
}

export async function writeFrameToDisk(recordingId: string, frameId: string, bytes: Buffer): Promise<void> {
  const dir = path.join(STORAGE_ROOT, recordingId);
  await mkdir(dir, { recursive: true });
  await writeFile(frameFilePath(recordingId, frameId), bytes);
}
