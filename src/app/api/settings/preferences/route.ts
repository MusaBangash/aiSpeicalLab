/** PATCH /api/settings/preferences — partial update of the toggle preferences. */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const bodySchema = z
  .object({
    examReminders: z.boolean(),
    streakAlerts: z.boolean(),
    showOnWall: z.boolean(),
  })
  .partial();

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const user = await db.user.update({
    where: { id: session.user.id },
    data: parsed.data,
    select: { examReminders: true, streakAlerts: true, showOnWall: true },
  });
  return Response.json(user);
}
