/**
 * PATCH /api/metrics/entries/:entryId — correct an entry: creates a brand-new
 * row (rating/note updated, same category) that supersedes this one. The
 * original row's fields never change — that's the audit-trail guarantee.
 * DELETE /api/metrics/entries/:entryId — soft-retract: sets retractedAt on
 * this exact row. The row is never removed from the database.
 */
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const patchSchema = z.object({
  rating: z.number().int().min(1).max(5),
  note: z.string().optional(),
});

async function guardEntry(entryId: string, userId: string) {
  const entry = await db.journalEntry.findUnique({ where: { id: entryId } });
  if (!entry) return { error: Response.json({ error: "Entry not found" }, { status: 404 }) };
  if (entry.teacherId !== userId) {
    return { error: Response.json({ error: "Only the author can manage this entry" }, { status: 403 }) };
  }
  if (entry.retractedAt !== null) {
    return { error: Response.json({ error: "This entry has been retracted" }, { status: 400 }) };
  }
  const correction = await db.journalEntry.findUnique({ where: { supersedesId: entryId } });
  if (correction) {
    return { error: Response.json({ error: "This entry has already been corrected" }, { status: 400 }) };
  }
  return { entry };
}

export async function PATCH(req: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { entryId } = await params;
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const { entry, error } = await guardEntry(entryId, session.user.id);
  if (error) return error;

  const correction = await db.journalEntry.create({
    data: {
      studentId: entry!.studentId,
      teacherId: session.user.id,
      category: entry!.category,
      rating: parsed.data.rating,
      note: parsed.data.note,
      supersedesId: entry!.id,
    },
  });

  return Response.json(correction);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ entryId: string }> }) {
  const session = await auth();
  if (!session || session.user.role !== "TEACHER") {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { entryId } = await params;
  const { error } = await guardEntry(entryId, session.user.id);
  if (error) return error;

  const retracted = await db.journalEntry.update({
    where: { id: entryId },
    data: { retractedAt: new Date() },
  });

  return Response.json(retracted);
}
