/** POST /api/homework — teacher creates a homework assignment targeted at a class or one student. */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { createAssignment } from "@/lib/homework";

const itemSchema = z.object({ label: z.string().trim().min(1), requiresSubmission: z.boolean() });

const bodySchema = z.discriminatedUnion("target", [
  z.object({
    target: z.literal("CLASS"),
    classId: z.string().min(1),
    title: z.string().trim().min(1),
    description: z.string().trim().optional(),
    dueDate: z.coerce.date(),
    items: z.array(itemSchema).min(1),
  }),
  z.object({
    target: z.literal("STUDENT"),
    targetStudentId: z.string().min(1),
    title: z.string().trim().min(1),
    description: z.string().trim().optional(),
    dueDate: z.coerce.date(),
    items: z.array(itemSchema).min(1),
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

  const result = await createAssignment(session.user.id, parsed.data);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ exerciseId: result.exerciseId });
}
