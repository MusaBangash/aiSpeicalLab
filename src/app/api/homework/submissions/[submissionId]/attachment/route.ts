/** GET /api/homework/submissions/:submissionId/attachment — serves the submission's attachment file. Open to the submitting student or any teacher. */
export const runtime = "nodejs";

import { readFile } from "node:fs/promises";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { absolutePathFor } from "@/lib/assignmentAttachmentStorage";

export async function GET(_req: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  const session = await auth();
  if (!session) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { submissionId } = await params;
  const submission = await db.submission.findUnique({ where: { id: submissionId } });
  if (!submission || !submission.attachmentPath || !submission.attachmentMimeType) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const isOwner = session.user.role === "STUDENT" && session.user.id === submission.studentId;
  const isTeacher = session.user.role === "TEACHER";
  if (!isOwner && !isTeacher) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const bytes = await readFile(absolutePathFor(submission.attachmentPath)).catch(() => null);
  if (!bytes) return Response.json({ error: "File missing on disk" }, { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": submission.attachmentMimeType, "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
