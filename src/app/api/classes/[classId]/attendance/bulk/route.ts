/** POST /api/classes/:classId/attendance/bulk — bulk-overwrite a day's
 *  attendance for every enrolled student to PRESENT or ABSENT. Per-student
 *  upsert loop (not updateMany): not every student has an Attendance row
 *  yet for the day, so updateMany would silently skip unmarked students.
 *  `note` is deliberately omitted from `update` so an existing note is
 *  never clobbered by a bulk action. */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireOwnedClass, getClassRoster } from "@/lib/classes";
import { startOfDay, parseDateParam } from "@/lib/attendance";

const bodySchema = z.object({
  date: z.string(),
  status: z.enum(["PRESENT", "ABSENT"]),
});

export async function POST(req: Request, { params }: { params: Promise<{ classId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { classId } = await params;
  const { error } = await requireOwnedClass(classId, session.user.id);
  if (error) return error;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid request body" }, { status: 400 });
  const { date, status } = parsed.data;
  const day = startOfDay(parseDateParam(date));

  const roster = await getClassRoster(classId);
  if (roster.length === 0) return Response.json({ updated: 0 });

  await db.$transaction(
    roster.map((r) =>
      db.attendance.upsert({
        where: { studentId_date: { studentId: r.studentId, date: day } },
        update: { status, source: "MANUAL" },
        create: { studentId: r.studentId, date: day, status, source: "MANUAL" },
      })
    )
  );

  return Response.json({ updated: roster.length });
}
