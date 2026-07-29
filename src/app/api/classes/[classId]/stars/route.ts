/** POST /api/classes/:classId/stars — teacher awards one star to a
 *  student. Plain create, no undo (see Star model's comment). */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireOwnedClass } from "@/lib/classes";
import { awardStar } from "@/lib/stars";

const bodySchema = z.object({ studentId: z.string().min(1), reason: z.string().max(200).trim().optional() });

export async function POST(req: Request, { params }: { params: Promise<{ classId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { classId } = await params;

  const { error } = await requireOwnedClass(classId, session.user.id);
  if (error) return error;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const student = await db.user.findUnique({ where: { id: parsed.data.studentId } });
  if (!student || student.role !== "STUDENT") {
    return Response.json({ error: "Student not found" }, { status: 404 });
  }

  await awardStar(parsed.data.studentId, session.user.id, classId, parsed.data.reason);
  return Response.json({ ok: true });
}
