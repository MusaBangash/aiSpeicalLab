/** PATCH /api/settings/password — change password (requires current password). */
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const bodySchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { currentPassword, newPassword } = parsed.data;

  const user = await db.user.findUniqueOrThrow({ where: { id: session.user.id } });
  const valid = await bcrypt.compare(currentPassword, user.password);
  if (!valid) {
    return Response.json({ error: "Current password is incorrect" }, { status: 403 });
  }

  const hash = await bcrypt.hash(newPassword, 10);
  await db.user.update({ where: { id: session.user.id }, data: { password: hash } });
  return Response.json({ ok: true });
}
