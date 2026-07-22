/** Homework/assignments — checklists + one overall submission per student (roadmap phase 8). */
import type { SubmissionStatus } from "@prisma/client";
import { db } from "./db";
import { requireOwnedClass, getClassRoster } from "./classes";

/**
 * Direct absolute-instant comparison — no grace constant needed, unlike
 * determineAutoStatus's minutes-of-day math (that only exists because a
 * class's scheduled start is a recurring time-of-day; dueDate/submittedAt/
 * checkedAt are all absolute DateTimes). Never stored — computed on every
 * read, same convention as JournalEntry's computed status.
 */
export function isLate(dueDate: Date | null, at: Date): boolean {
  if (!dueDate) return false;
  return at.getTime() > dueDate.getTime();
}

async function isStudentInScope(exercise: { classId: string | null; targetStudentId: string | null }, studentId: string): Promise<boolean> {
  if (exercise.targetStudentId) return exercise.targetStudentId === studentId;
  if (exercise.classId) {
    const enrollment = await db.classEnrollment.findFirst({ where: { studentId, classId: exercise.classId, leftAt: null } });
    return enrollment !== null;
  }
  return false;
}

export type CreateAssignmentItemInput = { label: string; requiresSubmission: boolean };
export type CreateAssignmentInput =
  | { target: "CLASS"; classId: string; title: string; description?: string; dueDate: Date; items: CreateAssignmentItemInput[] }
  | { target: "STUDENT"; targetStudentId: string; title: string; description?: string; dueDate: Date; items: CreateAssignmentItemInput[] };
export type CreateAssignmentResult = { ok: true; exerciseId: string } | { ok: false; error: string; status: number };

/** Creates the Exercise + all its AssignmentItems in one transaction. */
export async function createAssignment(teacherId: string, input: CreateAssignmentInput): Promise<CreateAssignmentResult> {
  if (input.items.length === 0) return { ok: false, error: "At least one checklist item is required", status: 400 };

  if (input.target === "CLASS") {
    const { error } = await requireOwnedClass(input.classId, teacherId);
    if (error) {
      const body = (await error.json()) as { error: string };
      return { ok: false, error: body.error, status: error.status };
    }
  } else {
    const student = await db.user.findUnique({ where: { id: input.targetStudentId } });
    if (!student || student.role !== "STUDENT") return { ok: false, error: "Student not found", status: 404 };
  }

  const exercise = await db.$transaction(async (tx) => {
    const ex = await tx.exercise.create({
      data: {
        teacherId,
        title: input.title,
        description: input.description,
        dueDate: input.dueDate,
        classId: input.target === "CLASS" ? input.classId : undefined,
        targetStudentId: input.target === "STUDENT" ? input.targetStudentId : undefined,
      },
    });
    await tx.assignmentItem.createMany({
      data: input.items.map((item, order) => ({ exerciseId: ex.id, label: item.label, requiresSubmission: item.requiresSubmission, order })),
    });
    return ex;
  });

  return { ok: true, exerciseId: exercise.id };
}

export type TeacherAssignmentSummary = {
  id: string;
  title: string;
  dueDate: Date | null;
  targetLabel: string;
  itemCount: number;
  rosterCount: number;
  submittedCount: number;
  gradedCount: number;
};

/** This teacher's own created assignments, most-recent-first, with roster/completion counts. */
export async function getAssignmentsForTeacher(teacherId: string): Promise<TeacherAssignmentSummary[]> {
  const exercises = await db.exercise.findMany({
    where: { teacherId },
    include: { class: true, targetStudent: true, items: true, submissions: true },
    orderBy: { dueDate: "asc" },
  });

  return Promise.all(
    exercises.map(async (ex) => {
      const rosterCount = ex.classId ? (await getClassRoster(ex.classId)).length : ex.targetStudentId ? 1 : 0;
      return {
        id: ex.id,
        title: ex.title,
        dueDate: ex.dueDate,
        targetLabel: ex.classId ? `Class: ${ex.class?.name ?? "(deleted)"}` : (ex.targetStudent?.name ?? "(unknown)"),
        itemCount: ex.items.length,
        rosterCount,
        submittedCount: ex.submissions.length,
        gradedCount: ex.submissions.filter((s) => s.grade !== null).length,
      };
    })
  );
}

export type AssignmentDetailRow = {
  studentId: string;
  name: string;
  email: string;
  items: { itemId: string; label: string; requiresSubmission: boolean; checked: boolean; late: boolean }[];
  submission: {
    id: string;
    body: string | null;
    linkUrl: string | null;
    attachmentPath: string | null;
    attachmentMimeType: string | null;
    submittedAt: Date;
    status: SubmissionStatus;
    grade: number | null;
    feedback: string | null;
    gradedAt: Date | null;
    late: boolean;
  } | null;
};
export type AssignmentDetailResult =
  | {
      ok: true;
      exercise: { id: string; title: string; description: string | null; dueDate: Date | null; targetLabel: string; teacherId: string };
      items: { id: string; label: string; requiresSubmission: boolean }[];
      rows: AssignmentDetailRow[];
    }
  | { ok: false; error: string; status: number };

/** Any-teacher-readable roster + per-item/submission status for one assignment (open read — see plan design decisions). */
export async function getAssignmentDetail(exerciseId: string): Promise<AssignmentDetailResult> {
  const exercise = await db.exercise.findUnique({
    where: { id: exerciseId },
    include: { class: true, targetStudent: true, items: { orderBy: { order: "asc" } } },
  });
  if (!exercise) return { ok: false, error: "Assignment not found", status: 404 };

  const roster = exercise.classId
    ? (await getClassRoster(exercise.classId)).map((r) => ({ studentId: r.studentId, name: r.name, email: r.email }))
    : exercise.targetStudent
      ? [{ studentId: exercise.targetStudent.id, name: exercise.targetStudent.name, email: exercise.targetStudent.email }]
      : [];

  const studentIds = roster.map((r) => r.studentId);
  const [checks, submissions] = await Promise.all([
    db.assignmentItemCheck.findMany({ where: { itemId: { in: exercise.items.map((i) => i.id) }, studentId: { in: studentIds } } }),
    db.submission.findMany({ where: { exerciseId, studentId: { in: studentIds } } }),
  ]);

  const rows: AssignmentDetailRow[] = roster.map((r) => {
    const submission = submissions.find((s) => s.studentId === r.studentId) ?? null;
    return {
      ...r,
      items: exercise.items.map((item) => {
        const check = checks.find((c) => c.itemId === item.id && c.studentId === r.studentId);
        return {
          itemId: item.id,
          label: item.label,
          requiresSubmission: item.requiresSubmission,
          checked: check?.checked ?? false,
          late: check?.checkedAt ? isLate(exercise.dueDate, check.checkedAt) : false,
        };
      }),
      submission: submission && {
        id: submission.id,
        body: submission.body,
        linkUrl: submission.linkUrl,
        attachmentPath: submission.attachmentPath,
        attachmentMimeType: submission.attachmentMimeType,
        submittedAt: submission.submittedAt,
        status: submission.status,
        grade: submission.grade,
        feedback: submission.feedback,
        gradedAt: submission.gradedAt,
        late: isLate(exercise.dueDate, submission.submittedAt),
      },
    };
  });

  return {
    ok: true,
    exercise: {
      id: exercise.id,
      title: exercise.title,
      description: exercise.description,
      dueDate: exercise.dueDate,
      targetLabel: exercise.classId ? `Class: ${exercise.class?.name ?? "(deleted)"}` : (exercise.targetStudent?.name ?? "(unknown)"),
      teacherId: exercise.teacherId,
    },
    items: exercise.items.map((i) => ({ id: i.id, label: i.label, requiresSubmission: i.requiresSubmission })),
    rows,
  };
}

export type StudentAssignmentView = {
  id: string;
  title: string;
  description: string | null;
  dueDate: Date | null;
  items: { id: string; label: string; requiresSubmission: boolean; checked: boolean; checkedAt: Date | null }[];
  submission: {
    id: string;
    body: string | null;
    linkUrl: string | null;
    attachmentPath: string | null;
    attachmentMimeType: string | null;
    submittedAt: Date;
    status: SubmissionStatus;
    grade: number | null;
    feedback: string | null;
    late: boolean;
  } | null;
};

/** Assignments this student is in scope for — class-targeted (their current active class) or individually-targeted. */
export async function getAssignmentsForStudent(studentId: string): Promise<StudentAssignmentView[]> {
  const activeEnrollment = await db.classEnrollment.findFirst({ where: { studentId, leftAt: null } });
  const orConditions = [{ targetStudentId: studentId }, ...(activeEnrollment ? [{ classId: activeEnrollment.classId }] : [])];

  const exercises = await db.exercise.findMany({
    where: { OR: orConditions },
    include: {
      items: { orderBy: { order: "asc" }, include: { checks: { where: { studentId } } } },
      submissions: { where: { studentId } },
    },
    orderBy: { dueDate: "asc" },
  });

  return exercises.map((ex) => {
    const submission = ex.submissions[0] ?? null;
    return {
      id: ex.id,
      title: ex.title,
      description: ex.description,
      dueDate: ex.dueDate,
      items: ex.items.map((item) => ({
        id: item.id,
        label: item.label,
        requiresSubmission: item.requiresSubmission,
        checked: item.checks[0]?.checked ?? false,
        checkedAt: item.checks[0]?.checkedAt ?? null,
      })),
      submission: submission && {
        id: submission.id,
        body: submission.body,
        linkUrl: submission.linkUrl,
        attachmentPath: submission.attachmentPath,
        attachmentMimeType: submission.attachmentMimeType,
        submittedAt: submission.submittedAt,
        status: submission.status,
        grade: submission.grade,
        feedback: submission.feedback,
        late: isLate(ex.dueDate, submission.submittedAt),
      },
    };
  });
}

export type ToggleCheckResult = { ok: true } | { ok: false; error: string; status: number };

/** Toggles one checklist item for the current student — independent of whether a Submission row exists. */
export async function setItemChecked(itemId: string, studentId: string, checked: boolean): Promise<ToggleCheckResult> {
  const item = await db.assignmentItem.findUnique({ where: { id: itemId }, include: { exercise: true } });
  if (!item) return { ok: false, error: "Checklist item not found", status: 404 };
  if (!(await isStudentInScope(item.exercise, studentId))) return { ok: false, error: "Not assigned to you", status: 403 };

  await db.assignmentItemCheck.upsert({
    where: { itemId_studentId: { itemId, studentId } },
    create: { itemId, studentId, checked, checkedAt: checked ? new Date() : null },
    update: { checked, checkedAt: checked ? new Date() : null },
  });
  return { ok: true };
}

export type SubmitAssignmentInput = { body?: string; linkUrl?: string; attachment?: { extension: string; mimeType: string; bytes: Buffer } };
export type SubmitAssignmentResult = { ok: true } | { ok: false; error: string; status: number };

/** Upserts the student's ONE overall submission for this assignment (unique on [exerciseId, studentId]). */
export async function submitAssignment(exerciseId: string, studentId: string, input: SubmitAssignmentInput): Promise<SubmitAssignmentResult> {
  const exercise = await db.exercise.findUnique({ where: { id: exerciseId } });
  if (!exercise) return { ok: false, error: "Assignment not found", status: 404 };
  if (!(await isStudentInScope(exercise, studentId))) return { ok: false, error: "Not assigned to you", status: 403 };
  if (!input.body?.trim() && !input.linkUrl?.trim() && !input.attachment) {
    return { ok: false, error: "Provide at least one of: text, link, or a file", status: 400 };
  }

  const submission = await db.submission.upsert({
    where: { exerciseId_studentId: { exerciseId, studentId } },
    create: { exerciseId, studentId, body: input.body, linkUrl: input.linkUrl, submittedAt: new Date() },
    update: { body: input.body, linkUrl: input.linkUrl, submittedAt: new Date(), status: "SUBMITTED" },
  });

  if (input.attachment) {
    const { writeAttachmentToDisk } = await import("./assignmentAttachmentStorage");
    await writeAttachmentToDisk(submission.id, input.attachment.extension, input.attachment.bytes);
    await db.submission.update({
      where: { id: submission.id },
      data: { attachmentPath: `${submission.id}.${input.attachment.extension}`, attachmentMimeType: input.attachment.mimeType },
    });
  }
  return { ok: true };
}

export type GradeSubmissionResult = { ok: true } | { ok: false; error: string; status: number };

/** Creator-only: sets grade/feedback/status on a submission. */
export async function gradeSubmission(
  submissionId: string,
  teacherId: string,
  input: { grade?: number; feedback?: string; status: SubmissionStatus }
): Promise<GradeSubmissionResult> {
  const submission = await db.submission.findUnique({ where: { id: submissionId }, include: { exercise: true } });
  if (!submission) return { ok: false, error: "Submission not found", status: 404 };
  if (submission.exercise.teacherId !== teacherId) return { ok: false, error: "Only the assigning teacher can grade this submission", status: 403 };

  await db.submission.update({
    where: { id: submissionId },
    data: { grade: input.grade, feedback: input.feedback, status: input.status, gradedAt: new Date() },
  });
  return { ok: true };
}
