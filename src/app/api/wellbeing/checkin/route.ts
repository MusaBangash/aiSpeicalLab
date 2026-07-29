/** POST /api/wellbeing/checkin — student submits (or updates) today's mood check-in. */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { submitCheckIn } from "@/lib/wellbeing";

const bodySchema = z.object({
  mood: z.enum(["GREAT", "GOOD", "OKAY", "LOW", "STRUGGLING"]),
  note: z.string().trim().max(500).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  await submitCheckIn(session.user.id, parsed.data.mood, parsed.data.note || undefined);
  return Response.json({ ok: true });
}
