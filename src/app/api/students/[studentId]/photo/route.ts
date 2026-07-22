/** GET /api/students/:studentId/photo — any authenticated teacher can view any student's photo (matches the existing profile-page openness, no per-teacher ownership gate). */
export const runtime = "nodejs";

import { readFile } from "node:fs/promises";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { photoFilePath } from "@/lib/studentPhotoStorage";

export async function GET(_req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { studentId } = await params;
  const profile = await db.studentProfile.findUnique({ where: { userId: studentId } });
  if (!profile || !profile.photoPath || !profile.photoMimeType) {
    return Response.json({ error: "No photo on file" }, { status: 404 });
  }

  const extension = profile.photoPath.split(".").pop()!;
  const bytes = await readFile(photoFilePath(studentId, extension)).catch(() => null);
  if (!bytes) return Response.json({ error: "Photo file missing on disk" }, { status: 404 });

  return new Response(new Uint8Array(bytes), {
    headers: { "Content-Type": profile.photoMimeType, "Cache-Control": "private, max-age=31536000, immutable" },
  });
}
