/**
 * Student enrollment photo storage — mirrors src/lib/screenStorage.ts's
 * pattern (disk outside public/ and .next/, metadata-only in Postgres).
 * Flat directory (one file per student, fixed filename) rather than a
 * per-entity subdirectory — unlike screen recordings, there's no multi-file
 * grouping need here. Original format is preserved, not re-encoded — no
 * image-processing library exists in this stack.
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const STORAGE_ROOT = process.env.STUDENT_PHOTOS_DIR ?? path.join(process.cwd(), "var", "student-photos");

const ALLOWED_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export function extensionForMimeType(mimeType: string): string | null {
  return ALLOWED_EXTENSIONS[mimeType] ?? null;
}

export function photoFilePath(studentId: string, extension: string): string {
  return path.join(STORAGE_ROOT, `${studentId}.${extension}`);
}

export async function writePhotoToDisk(studentId: string, extension: string, bytes: Buffer): Promise<void> {
  await mkdir(STORAGE_ROOT, { recursive: true });
  await writeFile(photoFilePath(studentId, extension), bytes);
}
