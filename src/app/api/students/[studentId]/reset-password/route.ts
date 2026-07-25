/** POST /api/students/:studentId/reset-password — teacher resets a forgotten student password, returns the new plaintext password once. */
import { auth } from "@/lib/auth";
import { resetStudentPassword } from "@/lib/students";

export async function POST(_req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { studentId } = await params;
  const result = await resetStudentPassword(studentId, session.user.id);

  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ id: result.id, email: result.email, password: result.password });
}
