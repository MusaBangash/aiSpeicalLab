/** POST /api/metrics/entries — teacher logs a dated journal entry for a student (append-only). */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const bodySchema = z.object({
  studentId: z.string().min(1),
  category: z.enum(["PARTICIPATION", "BEHAVIOUR", "EXTRA_ACTIVITY"]),
  rating: z.number().int().min(1).max(5),
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

  // Plain create, not upsert — every entry is a new dated row, the deliberate
  // opposite of attendance override's always-overwrite semantics.
  const entry = await db.journalEntry.create({
    data: { ...parsed.data, teacherId: session.user.id },
  });

  return Response.json(entry);
}
