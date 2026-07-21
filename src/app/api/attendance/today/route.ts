/** GET /api/attendance/today — the current student's own attendance row for today (read-only). */
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfDay } from "@/lib/attendance";

export async function GET() {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const record = await db.attendance.findUnique({
    where: { studentId_date: { studentId: session.user.id, date: startOfDay(new Date()) } },
  });

  return Response.json({
    status: record?.status ?? null,
    checkedInAt: record?.checkedInAt ? record.checkedInAt.toISOString() : null,
  });
}
