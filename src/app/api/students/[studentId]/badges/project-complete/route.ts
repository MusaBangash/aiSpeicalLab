/** POST /api/students/:studentId/badges/project-complete — teacher awards the Project Complete badge (no auto condition, any teacher). */
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { awardProjectComplete } from "@/lib/badges";

export async function POST(_req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { studentId } = await params;
  const student = await db.user.findUnique({ where: { id: studentId } });
  if (!student || student.role !== "STUDENT") {
    return Response.json({ error: "Student not found" }, { status: 404 });
  }

  await awardProjectComplete(studentId, session.user.id);
  return Response.json({ ok: true });
}
