/** PATCH /api/classes/:classId — teacher renames their own class and/or sets/clears its scheduled weekday start time. Delete is deliberately not supported yet (see roadmap notes). */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { requireOwnedClass } from "@/lib/classes";

const bodySchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  // "HH:MM" (24h, native <input type="time"> shape) to set a schedule, or
  // null to explicitly clear it back to "no schedule". Omitting the key
  // entirely leaves the existing value untouched.
  scheduledStartTime: z
    .string()
    .regex(/^([01]\d|2[0-3]):([0-5]\d)$/)
    .nullable()
    .optional(),
});

export async function PATCH(req: Request, { params }: { params: Promise<{ classId: string }> }) {
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
  const { name, scheduledStartTime } = parsed.data;
  if (name === undefined && scheduledStartTime === undefined) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const data: { name?: string; scheduledStartMinutes?: number | null } = {};
  if (name !== undefined) data.name = name;
  if (scheduledStartTime !== undefined) {
    data.scheduledStartMinutes =
      scheduledStartTime === null
        ? null
        : Number(scheduledStartTime.slice(0, 2)) * 60 + Number(scheduledStartTime.slice(3, 5));
  }

  const updated = await db.class.update({ where: { id: classId }, data });
  return Response.json(updated);
}
