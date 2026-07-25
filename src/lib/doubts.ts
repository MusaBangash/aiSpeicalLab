import { db } from "./db";

export type DoubtStatus = "UNANSWERED" | "ANSWERED" | "RESOLVED";

export function doubtStatus(d: { answeredAt: Date | null; resolvedAt: Date | null }): DoubtStatus {
  if (d.resolvedAt) return "RESOLVED";
  if (d.answeredAt) return "ANSWERED";
  return "UNANSWERED";
}

export type AskDoubtResult = { ok: true; doubtId: string } | { ok: false; error: string; status: number };

/** Server-side re-validates moduleId against a real row — the client's ModuleField
 *  resolution is a UX convenience only, never trusted on its own. */
export async function askDoubt(studentId: string, moduleId: string, body: string): Promise<AskDoubtResult> {
  if (!body.trim()) return { ok: false, error: "Question body is required", status: 400 };
  const module = await db.curriculumModule.findUnique({ where: { id: moduleId } });
  if (!module) return { ok: false, error: "Module not found", status: 404 };

  const doubt = await db.doubt.create({ data: { studentId, moduleId, body: body.trim() } });
  return { ok: true, doubtId: doubt.id };
}

export type DoubtRow = {
  id: string;
  body: string;
  createdAt: Date;
  studentName: string;
  moduleTitle: string;
  answerBody: string | null;
  answeredAt: Date | null;
  answeredByName: string | null;
  resolvedAt: Date | null;
  resolvedByName: string | null;
  status: DoubtStatus;
};

function toDoubtRow(d: {
  id: string;
  body: string;
  createdAt: Date;
  student: { name: string };
  module: { title: string };
  answerBody: string | null;
  answeredAt: Date | null;
  answeredBy: { name: string } | null;
  resolvedAt: Date | null;
  resolvedBy: { name: string } | null;
}): DoubtRow {
  return {
    id: d.id,
    body: d.body,
    createdAt: d.createdAt,
    studentName: d.student.name,
    moduleTitle: d.module.title,
    answerBody: d.answerBody,
    answeredAt: d.answeredAt,
    answeredByName: d.answeredBy?.name ?? null,
    resolvedAt: d.resolvedAt,
    resolvedByName: d.resolvedBy?.name ?? null,
    status: doubtStatus(d),
  };
}

/** Any-teacher inbox: unanswered first, then newest-first within each group. */
export async function getInboxForTeacher(): Promise<DoubtRow[]> {
  const rows = await db.doubt.findMany({
    include: { student: true, module: true, answeredBy: true, resolvedBy: true },
    orderBy: [{ answeredAt: { sort: "asc", nulls: "first" } }, { createdAt: "desc" }],
  });
  return rows.map(toDoubtRow);
}

export async function getUnansweredCount(): Promise<number> {
  return db.doubt.count({ where: { answeredAt: null } });
}

export async function getDoubtsForStudent(studentId: string): Promise<DoubtRow[]> {
  const rows = await db.doubt.findMany({
    where: { studentId },
    include: { student: true, module: true, answeredBy: true, resolvedBy: true },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(toDoubtRow);
}

export type AnswerDoubtResult = { ok: true } | { ok: false; error: string; status: number };

/** Any teacher may answer. answeredAt is first-wins (?? new Date()); answerBody/
 *  answeredById are always overwritable, so a later teacher can correct an answer. */
export async function answerDoubt(doubtId: string, teacherId: string, answerBody: string): Promise<AnswerDoubtResult> {
  if (!answerBody.trim()) return { ok: false, error: "Answer body is required", status: 400 };
  const doubt = await db.doubt.findUnique({ where: { id: doubtId } });
  if (!doubt) return { ok: false, error: "Question not found", status: 404 };

  await db.doubt.update({
    where: { id: doubtId },
    data: { answerBody: answerBody.trim(), answeredById: teacherId, answeredAt: doubt.answeredAt ?? new Date() },
  });
  return { ok: true };
}

export type ResolveDoubtResult = { ok: true } | { ok: false; error: string; status: number };

/** Any teacher may resolve. Requires an existing answer. Idempotent — resolving an
 *  already-resolved doubt is a no-op success, matching markPresentIfUnset's philosophy. */
export async function resolveDoubt(doubtId: string, teacherId: string): Promise<ResolveDoubtResult> {
  const doubt = await db.doubt.findUnique({ where: { id: doubtId } });
  if (!doubt) return { ok: false, error: "Question not found", status: 404 };
  if (!doubt.answeredAt) return { ok: false, error: "Cannot resolve a question that hasn't been answered yet", status: 400 };
  if (doubt.resolvedAt) return { ok: true };

  await db.doubt.update({ where: { id: doubtId }, data: { resolvedAt: new Date(), resolvedById: teacherId } });
  return { ok: true };
}
