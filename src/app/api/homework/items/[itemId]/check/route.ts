/** POST /api/homework/items/:itemId/check — student toggles one checklist item. */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { setItemChecked } from "@/lib/homework";

const bodySchema = z.object({ checked: z.boolean() });

export async function POST(req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { itemId } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const result = await setItemChecked(itemId, session.user.id, parsed.data.checked);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true });
}
