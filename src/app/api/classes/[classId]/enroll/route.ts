/** POST /api/classes/:classId/enroll — teacher enrolls a student into their class (auto-ends any other active enrollment). */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { requireOwnedClass, enrollStudent } from "@/lib/classes";

const bodySchema = z.object({ studentId: z.string().min(1) });

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

  const enrollment = await enrollStudent(classId, parsed.data.studentId);
  return Response.json(enrollment);
}
