/** POST /api/exams/:id/answer — auto-save one answer { attemptId, questionId, optionId } */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { saveAnswer, ExamRuleError } from "@/lib/exam";

const bodySchema = z.object({
  attemptId: z.string(),
  questionId: z.string(),
  optionId: z.string().nullable(),
});

const STATUS_BY_CODE: Record<ExamRuleError["code"], number> = {
  NOT_OWNER: 403,
  NOT_IN_PROGRESS: 409,
  EXPIRED: 410,
  INVALID_QUESTION: 400,
};

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { attemptId, questionId, optionId } = parsed.data;

  try {
    await saveAnswer(session.user.id, attemptId, questionId, optionId);
  } catch (err) {
    if (err instanceof ExamRuleError) {
      return Response.json({ error: err.message, code: err.code }, { status: STATUS_BY_CODE[err.code] });
    }
    throw err;
  }

  return Response.json({ saved: true });
}
