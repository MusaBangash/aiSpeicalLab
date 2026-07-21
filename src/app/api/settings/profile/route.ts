/** PATCH /api/settings/profile — update name and language (email is read-only). */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const bodySchema = z.object({
  name: z.string().min(1),
  language: z.enum(["en", "ur"]),
});

export async function PATCH(req: Request) {
  const session = await auth();
  if (!session) return Response.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const user = await db.user.update({
    where: { id: session.user.id },
    data: { name: parsed.data.name, language: parsed.data.language },
    select: { name: true, language: true },
  });
  return Response.json(user);
}
