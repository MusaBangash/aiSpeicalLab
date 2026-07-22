/** GET /api/classes/:classId/activity — poll target for ClassLivePanel. */
import { auth } from "@/lib/auth";
import { requireOwnedClass, getClassRoster } from "@/lib/classes";
import { getClassActivity, toClassActivityPayload } from "@/lib/activity";

export async function GET(_req: Request, { params }: { params: Promise<{ classId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { classId } = await params;
  const { error } = await requireOwnedClass(classId, session.user.id);
  if (error) return error;

  const roster = await getClassRoster(classId);
  const activity = await getClassActivity(roster.map((r) => r.studentId));
  return Response.json({ students: toClassActivityPayload(roster, activity) });
}
