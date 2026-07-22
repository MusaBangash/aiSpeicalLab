/** POST /api/homework/:exerciseId/submit — student submits/updates their own overall submission. */
export const runtime = "nodejs";

import { auth } from "@/lib/auth";
import { submitAssignment } from "@/lib/homework";
import { extensionForMimeType } from "@/lib/assignmentAttachmentStorage";

const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export async function POST(req: Request, { params }: { params: Promise<{ exerciseId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { exerciseId } = await params;

  const form = await req.formData().catch(() => null);
  if (!form) return Response.json({ error: "Invalid form submission" }, { status: 400 });

  const body = (form.get("body") as string | null) ?? undefined;
  const linkUrl = (form.get("linkUrl") as string | null) ?? undefined;
  const file = form.get("file");

  let attachment: { extension: string; mimeType: string; bytes: Buffer } | undefined;
  if (file instanceof File && file.size > 0) {
    const extension = extensionForMimeType(file.type);
    if (!extension) {
      return Response.json({ error: "Unsupported file type" }, { status: 400 });
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      return Response.json({ error: "File must be under 20MB" }, { status: 400 });
    }
    attachment = { extension, mimeType: file.type, bytes: Buffer.from(await file.arrayBuffer()) };
  }

  const result = await submitAssignment(exerciseId, session.user.id, { body, linkUrl, attachment });
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true });
}
