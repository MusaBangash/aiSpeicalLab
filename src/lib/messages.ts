/** One-way teacher → student announcements — send/inbox/retract logic (roadmap phase 6). */
import type { MessageUrgency } from "@prisma/client";
import { db } from "./db";
import { requireOwnedClass, getClassRoster } from "./classes";

export type SendMessageInput =
  | { targetType: "STUDENT"; targetStudentId: string; urgency: MessageUrgency; body: string }
  | { targetType: "CLASS"; targetClassId: string; urgency: MessageUrgency; body: string }
  | { targetType: "ALL"; urgency: MessageUrgency; body: string };

export type SendMessageResult =
  | { ok: true; messageId: string; recipientCount: number }
  | { ok: false; error: string; status: number };

/**
 * Resolves the target (one student / a class's active roster / every
 * student) into a concrete studentId[] at send-time, then creates the
 * Message plus one MessageRecipient row per recipient in a transaction —
 * same shape as the class-attendance bulk route's fan-out (create, not
 * upsert, since MessageRecipient rows never pre-exist).
 */
export async function sendMessage(teacherId: string, input: SendMessageInput): Promise<SendMessageResult> {
  let studentIds: string[];

  if (input.targetType === "STUDENT") {
    const student = await db.user.findUnique({ where: { id: input.targetStudentId } });
    if (!student || student.role !== "STUDENT") return { ok: false, error: "Student not found", status: 404 };
    studentIds = [student.id];
  } else if (input.targetType === "CLASS") {
    const { error } = await requireOwnedClass(input.targetClassId, teacherId);
    if (error) {
      const body = (await error.json()) as { error: string };
      return { ok: false, error: body.error, status: error.status };
    }
    studentIds = (await getClassRoster(input.targetClassId)).map((r) => r.studentId);
  } else {
    studentIds = (await db.user.findMany({ where: { role: "STUDENT" }, select: { id: true } })).map((s) => s.id);
  }

  if (studentIds.length === 0) return { ok: false, error: "No recipients to send to", status: 400 };

  const message = await db.message.create({
    data: {
      teacherId,
      urgency: input.urgency,
      targetType: input.targetType,
      targetClassId: input.targetType === "CLASS" ? input.targetClassId : undefined,
      targetStudentId: input.targetType === "STUDENT" ? input.targetStudentId : undefined,
      body: input.body,
    },
  });

  await db.$transaction(studentIds.map((studentId) => db.messageRecipient.create({ data: { messageId: message.id, studentId } })));

  return { ok: true, messageId: message.id, recipientCount: studentIds.length };
}

export type InboxMessage = {
  id: string;
  urgency: MessageUrgency;
  body: string;
  createdAt: Date;
  teacherName: string;
  readAt: Date | null;
};

/** Non-retracted messages for a student, most-recent-first. */
export async function getInboxForStudent(studentId: string): Promise<InboxMessage[]> {
  const rows = await db.messageRecipient.findMany({
    where: { studentId, message: { retractedAt: null } },
    include: { message: { include: { teacher: true } } },
    orderBy: { message: { createdAt: "desc" } },
  });
  return rows.map((r) => ({
    id: r.message.id,
    urgency: r.message.urgency,
    body: r.message.body,
    createdAt: r.message.createdAt,
    teacherName: r.message.teacher.name,
    readAt: r.readAt,
  }));
}

/** Bulk-marks every currently-unread recipient row for this student as read — called once on inbox page load. */
export async function markInboxRead(studentId: string): Promise<void> {
  await db.messageRecipient.updateMany({
    where: { studentId, readAt: null, message: { retractedAt: null } },
    data: { readAt: new Date() },
  });
}

/** Drives both the nav badge and the login toast. Excludes retracted messages — a retracted-but-unread message shouldn't inflate the count. */
export async function getUnreadCount(studentId: string): Promise<number> {
  return db.messageRecipient.count({ where: { studentId, readAt: null, message: { retractedAt: null } } });
}

export type SentMessage = {
  id: string;
  urgency: MessageUrgency;
  targetType: "STUDENT" | "CLASS" | "ALL";
  targetLabel: string;
  body: string;
  createdAt: Date;
  retractedAt: Date | null;
  recipientCount: number;
};

/** This teacher's own sent-message history/audit view, most-recent-first, including retracted ones. */
export async function getSentMessagesForTeacher(teacherId: string): Promise<SentMessage[]> {
  const rows = await db.message.findMany({
    where: { teacherId },
    include: { targetClass: true, targetStudent: true, _count: { select: { recipients: true } } },
    orderBy: { createdAt: "desc" },
  });
  return rows.map((m) => ({
    id: m.id,
    urgency: m.urgency,
    targetType: m.targetType,
    targetLabel:
      m.targetType === "ALL" ? "All students" : m.targetType === "CLASS" ? `Class: ${m.targetClass?.name ?? "(deleted)"}` : (m.targetStudent?.name ?? "(unknown)"),
    body: m.body,
    createdAt: m.createdAt,
    retractedAt: m.retractedAt,
    recipientCount: m._count.recipients,
  }));
}

export type RetractResult = { ok: true } | { ok: false; error: string; status: number };

/** Ownership-checked soft-delete: only the sending teacher, only once. */
export async function retractMessage(messageId: string, teacherId: string): Promise<RetractResult> {
  const message = await db.message.findUnique({ where: { id: messageId } });
  if (!message) return { ok: false, error: "Message not found", status: 404 };
  if (message.teacherId !== teacherId) return { ok: false, error: "Only the sending teacher can retract this message", status: 403 };
  if (message.retractedAt !== null) return { ok: false, error: "This message has already been retracted", status: 400 };
  await db.message.update({ where: { id: messageId }, data: { retractedAt: new Date() } });
  return { ok: true };
}

/** Plain {id, name} list of every student, for the teacher's target-student picker. */
export async function getAllStudentsForPicker(): Promise<{ id: string; name: string }[]> {
  return db.user.findMany({ where: { role: "STUDENT" }, orderBy: { name: "asc" }, select: { id: true, name: true } });
}
