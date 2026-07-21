/** POST /api/exams — teacher creates a new exam as DRAFT */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const bodySchema = z.object({
  title: z.string().min(1),
  moduleId: z.string().min(1),
  durationMinutes: z.number().int().positive(),
  cooldownHours: z.number().int().positive().default(24),
  passMarkPercent: z.number().min(0).max(100).default(82),
  questionsShown: z.number().int().positive(),
  opensAt: z.coerce.date().nullable().optional(),
  closesAt: z.coerce.date().nullable().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body", issues: parsed.error.issues }, { status: 400 });
  }

  const exam = await db.exam.create({ data: { ...parsed.data, status: "DRAFT" } });
  return Response.json(exam, { status: 201 });
}
