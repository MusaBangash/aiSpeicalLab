/** POST /api/classes — teacher creates a new class. */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const bodySchema = z.object({ name: z.string().trim().min(1).max(100) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const cls = await db.class.create({ data: { name: parsed.data.name, teacherId: session.user.id } });
  return Response.json(cls);
}
