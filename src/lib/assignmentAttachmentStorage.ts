/**
 * Homework submission attachment storage — mirrors src/lib/studentPhotoStorage.ts
 * exactly (flat disk directory outside public/ and .next/, metadata-only in
 * Postgres). Keyed by submissionId, not studentId — Submission is one row
 * per (exercise, student) thanks to its @@unique constraint, so a
 * resubmission overwrites the same file rather than accumulating history
 * (no versioning requirement in the locked scope).
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const STORAGE_ROOT = process.env.ASSIGNMENT_ATTACHMENTS_DIR ?? path.join(process.cwd(), "var", "assignment-attachments");

// Student-submitted work: images plus common document/archive types a
// write-up or small project could reasonably be. No parsing/processing —
// storage only, so breadth here is just a whitelist decision.
const ALLOWED_EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/zip": "zip",
};

export function extensionForMimeType(mimeType: string): string | null {
  return ALLOWED_EXTENSIONS[mimeType] ?? null;
}

export function attachmentFilePath(submissionId: string, extension: string): string {
  return path.join(STORAGE_ROOT, `${submissionId}.${extension}`);
}

/** Resolves an already-stored relative path (e.g. "cuid.pdf") back to an absolute one — used by the serving route. */
export function absolutePathFor(relativePath: string): string {
  return path.join(STORAGE_ROOT, relativePath);
}

export async function writeAttachmentToDisk(submissionId: string, extension: string, bytes: Buffer): Promise<void> {
  await mkdir(STORAGE_ROOT, { recursive: true });
  await writeFile(attachmentFilePath(submissionId, extension), bytes);
}
