/** POST /api/attendance/override — teacher manually sets a student's attendance for a day. */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { startOfDay, parseDateParam } from "@/lib/attendance";

const bodySchema = z.object({
  studentId: z.string().min(1),
  date: z.string(), // "YYYY-MM-DD"
  status: z.enum(["PRESENT", "ABSENT", "EXCUSED", "LATE"]),
  note: z.string().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { studentId, date, status, note } = parsed.data;
  const day = startOfDay(parseDateParam(date));

  // Always-overwrite — the intentional counterpart to the heartbeat's create-only upsert.
  const attendance = await db.attendance.upsert({
    where: { studentId_date: { studentId, date: day } },
    update: { status, note, source: "MANUAL" },
    create: { studentId, date: day, status, note, source: "MANUAL" },
  });

  return Response.json(attendance);
}
