/** POST /api/students/bulk — teacher enrolls many students at once from a reviewed CSV. */
export const runtime = "nodejs";

import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createStudent } from "@/lib/students";

const rowSchema = z.object({
  name: z.string().trim().min(1),
  fatherName: z.string().trim().min(1),
  contact: z.string().trim().min(1),
  address: z.string().trim().min(1),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]),
  courseType: z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED", "DIPLOMA", "OTHER"]),
  courseTypeOther: z.string().trim().optional(),
  category: z.enum(["PAYING", "ORPHAN", "STAFF", "OTHER"]),
  residency: z.enum(["DAY_SCHOLAR", "HOSTELIZED"]),
  educationLevel: z.string().trim().min(1),
  educationStatus: z.string().trim().min(1),
  classId: z.string().min(1).optional(),
});
const bodySchema = z.object({ students: z.array(rowSchema).min(1).max(500) });

export async function POST(req: Request) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body", issues: parsed.error.issues }, { status: 400 });
  }

  const teacher = await db.user.findUnique({ where: { id: session.user.id } });

  // Not one transaction — each createStudent() call already has its own
  // internal transaction. Looping means one bad row (e.g. a duplicate
  // email only detectable at commit time) never rolls back its neighbors.
  const results = [];
  for (const row of parsed.data.students) {
    const result = await createStudent({ ...row, teacherId: session.user.id, labId: teacher?.labId ?? undefined });
    results.push({ name: row.name, ...result });
  }

  return Response.json({ results }, { status: 201 });
}
