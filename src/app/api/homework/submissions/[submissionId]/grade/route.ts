/** POST /api/homework/submissions/:submissionId/grade — creator-teacher grades a submission. */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { gradeSubmission } from "@/lib/homework";

const bodySchema = z.object({
  grade: z.coerce.number().min(0).max(100).optional(),
  feedback: z.string().trim().optional(),
  status: z.enum(["SUBMITTED", "REVIEWED", "NEEDS_REVISION", "COMPLETE"]),
});

export async function POST(req: Request, { params }: { params: Promise<{ submissionId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { submissionId } = await params;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Invalid request body" }, { status: 400 });
  }

  const result = await gradeSubmission(submissionId, session.user.id, parsed.data);
  if (!result.ok) {
    return Response.json({ error: result.error }, { status: result.status });
  }
  return Response.json({ ok: true });
}
