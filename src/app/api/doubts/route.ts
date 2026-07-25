/** POST /api/doubts — student asks a question tagged to a curriculum module. */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { askDoubt } from "@/lib/doubts";

const bodySchema = z.object({
  moduleId: z.string().min(1),
  body: z.string().min(1),
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

  const result = await askDoubt(session.user.id, parsed.data.moduleId, parsed.data.body);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true, doubtId: result.doubtId });
}
