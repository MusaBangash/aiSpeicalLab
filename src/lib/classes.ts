/** Classes/Sections — teacher-organized student groups (roadmap phase 1). */
import { db } from "./db";

/** Fetches a class and confirms it belongs to the given teacher — shared by the enroll/unenroll routes. */
export async function requireOwnedClass(classId: string, teacherId: string) {
  const cls = await db.class.findUnique({ where: { id: classId } });
  if (!cls) return { error: Response.json({ error: "Class not found" }, { status: 404 }) };
  if (cls.teacherId !== teacherId) {
    return { error: Response.json({ error: "Only the owning teacher can manage this class" }, { status: 403 }) };
  }
  return { cls };
}

export type ClassSummary = { id: string; name: string; createdAt: Date; activeStudentCount: number };

export async function getClassesForTeacher(teacherId: string): Promise<ClassSummary[]> {
  const classes = await db.class.findMany({
    where: { teacherId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { enrollments: { where: { leftAt: null } } } } },
  });
  return classes.map((c) => ({ id: c.id, name: c.name, createdAt: c.createdAt, activeStudentCount: c._count.enrollments }));
}

/** Case-insensitive exact-match resolve of a typed class name to its id —
 *  same shape as ModuleField.tsx's resolveModuleId, swapping title for name.
 *  Used by the bulk CSV import review to resolve an optional className
 *  column without rejecting the whole row on a typo (caller treats null
 *  as "leave unassigned", not an error). */
export function resolveClassId(classes: { id: string; name: string }[], name: string): string | null {
  const match = classes.find((c) => c.name.toLowerCase() === name.trim().toLowerCase());
  return match ? match.id : null;
}

/** Batched active-class lookup for every student in one query — same
 *  batching shape as getEnrollableStudents, extracted since more than
 *  one page now needs "which class is this student currently in"
 *  without a per-student round trip. */
export async function getActiveClassByStudent(): Promise<Map<string, { id: string; name: string }>> {
  const activeEnrollments = await db.classEnrollment.findMany({
    where: { leftAt: null },
    include: { class: { select: { id: true, name: true } } },
  });
  return new Map(activeEnrollments.map((e) => [e.studentId, e.class]));
}

export type RosterEntry = { enrollmentId: string; studentId: string; name: string; email: string; joinedAt: Date };

export async function getClassRoster(classId: string): Promise<RosterEntry[]> {
  const rows = await db.classEnrollment.findMany({
    where: { classId, leftAt: null },
    include: { student: true },
    orderBy: { student: { name: "asc" } },
  });
  return rows.map((r) => ({
    enrollmentId: r.id,
    studentId: r.studentId,
    name: r.student.name,
    email: r.student.email,
    joinedAt: r.joinedAt,
  }));
}

/**
 * Enrolls a student into a class. Re-enrolling into the SAME class they're
 * already actively in is a silent no-op (no new history row). Moving from a
 * different class (or no class) closes the old active enrollment (leftAt)
 * and creates a new one — history is never overwritten or deleted.
 */
export async function enrollStudent(classId: string, studentId: string) {
  const existingActive = await db.classEnrollment.findFirst({ where: { studentId, leftAt: null } });
  if (existingActive && existingActive.classId === classId) return existingActive;
  if (existingActive) {
    await db.classEnrollment.update({ where: { id: existingActive.id }, data: { leftAt: new Date() } });
  }
  return db.classEnrollment.create({ data: { classId, studentId } });
}

/** Ends the student's active enrollment in this specific class, if any. */
export async function unenrollStudent(classId: string, studentId: string) {
  const active = await db.classEnrollment.findFirst({ where: { studentId, classId, leftAt: null } });
  if (!active) return null;
  return db.classEnrollment.update({ where: { id: active.id }, data: { leftAt: new Date() } });
}

export type EnrollableStudent = { id: string; name: string; email: string; currentClassName: string | null };

/**
 * Every student, annotated with their current active class name if any —
 * not hidden, so the picker can be used to move a student between classes
 * (enrolling elsewhere auto-ends their prior enrollment).
 */
export async function getEnrollableStudents(excludeClassId: string): Promise<EnrollableStudent[]> {
  const [students, activeEnrollments] = await Promise.all([
    db.user.findMany({ where: { role: "STUDENT" }, orderBy: { name: "asc" } }),
    db.classEnrollment.findMany({ where: { leftAt: null }, include: { class: { select: { name: true } } } }),
  ]);
  const byStudent = new Map(activeEnrollments.map((e) => [e.studentId, e]));
  return students
    .filter((s) => byStudent.get(s.id)?.classId !== excludeClassId)
    .map((s) => ({ id: s.id, name: s.name, email: s.email, currentClassName: byStudent.get(s.id)?.class.name ?? null }));
}

/**
 * Earliest ClassEnrollment.joinedAt across ALL of a student's enrollment
 * rows (current + past) — the true "first joined the lab" date. NOT the
 * current active enrollment's joinedAt (wrongly later if they've switched
 * classes — the old enrollment is closed via leftAt, not deleted, but a
 * fresh joinedAt is stamped on the new row) and NOT User.createdAt
 * (account creation can predate real class assignment). Null if the
 * student has never had any ClassEnrollment row at all.
 */
export async function getStudentJoinDate(studentId: string): Promise<Date | null> {
  const result = await db.classEnrollment.aggregate({
    where: { studentId },
    _min: { joinedAt: true },
  });
  return result._min.joinedAt;
}
