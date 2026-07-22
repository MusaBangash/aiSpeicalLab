/** POST /api/messages — teacher sends a one-way announcement to one student, one class, or all students. */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { sendMessage } from "@/lib/messages";

const bodySchema = z.discriminatedUnion("targetType", [
  z.object({
    targetType: z.literal("STUDENT"),
    targetStudentId: z.string().min(1),
    urgency: z.enum(["NORMAL", "IMPORTANT", "URGENT"]),
    body: z.string().trim().min(1),
  }),
  z.object({
    targetType: z.literal("CLASS"),
    targetClassId: z.string().min(1),
    urgency: z.enum(["NORMAL", "IMPORTANT", "URGENT"]),
    body: z.string().trim().min(1),
  }),
  z.object({
    targetType: z.literal("ALL"),
    urgency: z.enum(["NORMAL", "IMPORTANT", "URGENT"]),
    body: z.string().trim().min(1),
  }),
]);

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
  }

  const result = await sendMessage(session.user.id, parsed.data);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ messageId: result.messageId, recipientCount: result.recipientCount });
}
