/** POST /api/students/:studentId/badges/master-engineer-nomination — teacher nominates for Master Engineer; server re-checks the tenure+points gate, never trusts the client. */
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { nominateMasterEngineer } from "@/lib/badges";

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

  const result = await nominateMasterEngineer(studentId, session.user.id);
  if (!result.ok) {
    return Response.json({ error: result.reason }, { status: 409 });
  }
  return Response.json({ ok: true });
}
