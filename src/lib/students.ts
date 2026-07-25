/** Student enrollment — creation logic, kept out of the route so it stays thin. */
import { randomInt } from "node:crypto";
import bcrypt from "bcryptjs";
import type { CourseType, StudentCategory, Residency, Gender } from "@prisma/client";
import { db } from "./db";
import { requireOwnedClass, enrollStudent } from "./classes";
import { writePhotoToDisk } from "./studentPhotoStorage";

// Excludes visually-ambiguous characters (0/O, 1/l/I) — a teacher reads this
// once off a screen to hand it to a student, typos here are costly.
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
const PASSWORD_LENGTH = 12;

export function generatePassword(): string {
  let out = "";
  for (let i = 0; i < PASSWORD_LENGTH; i++) {
    out += PASSWORD_CHARS[randomInt(PASSWORD_CHARS.length)];
  }
  return out;
}

export type CreateStudentInput = {
  name: string;
  fatherName: string;
  contact: string;
  address: string;
  gender: Gender;
  courseType: CourseType;
  courseTypeOther?: string;
  category: StudentCategory;
  residency: Residency;
  educationLevel: string;
  educationStatus: string;
  labId?: string;
  classId?: string;
  teacherId: string;
  photo?: { bytes: Buffer; extension: string; mimeType: string };
};

export type CreateStudentResult =
  | { ok: true; id: string; email: string; password: string }
  | { ok: false; error: string; status: number };

export async function createStudent(input: CreateStudentInput): Promise<CreateStudentResult> {
  // Ownership check replicated here: enrollStudent() itself does no such
  // check — only the /api/classes/[classId]/enroll route does today, via
  // requireOwnedClass. Without this, a teacher could enroll a brand-new
  // student straight into another teacher's class.
  if (input.classId) {
    const { error } = await requireOwnedClass(input.classId, input.teacherId);
    if (error) {
      const body = (await error.json()) as { error: string };
      return { ok: false, error: body.error, status: error.status };
    }
  }

  const email = input.name.trim().toLowerCase().replace(/\s+/g, ".") + "@student.stlab.local";

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: `A student with the email "${email}" already exists — use a more distinct name.`, status: 409 };
  }

  const password = generatePassword();
  const hash = await bcrypt.hash(password, 10);

  const { user } = await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { name: input.name.trim(), email, password: hash, role: "STUDENT", labId: input.labId },
    });
    await tx.studentProfile.create({
      data: {
        userId: user.id,
        fatherName: input.fatherName,
        contact: input.contact,
        address: input.address,
        gender: input.gender,
        courseType: input.courseType,
        courseTypeOther: input.courseType === "OTHER" ? input.courseTypeOther : undefined,
        category: input.category,
        residency: input.residency,
        educationLevel: input.educationLevel,
        educationStatus: input.educationStatus,
      },
    });
    return { user };
  });

  // Photo write happens after the transaction (needs the real generated
  // studentId for the filename). Accepted gap: a crash between these two
  // steps leaves a student with no photo — recoverable by re-upload, not a
  // half-created record.
  if (input.photo) {
    await writePhotoToDisk(user.id, input.photo.extension, input.photo.bytes);
    await db.studentProfile.update({
      where: { userId: user.id },
      data: { photoPath: `${user.id}.${input.photo.extension}`, photoMimeType: input.photo.mimeType },
    });
  }

  if (input.classId) {
    await enrollStudent(input.classId, user.id);
  }

  return { ok: true, id: user.id, email, password };
}

export type ResetPasswordResult =
  | { ok: true; id: string; email: string; password: string }
  | { ok: false; error: string; status: number };

/** Teacher-initiated reset for a forgotten password — the self-service
 *  change-when-known flow already exists (PATCH /api/settings/password);
 *  this is the only path for "forgot it entirely." Any teacher may reset any
 *  student's password, matching this app's established any-teacher
 *  precedent (journal entries, Doubt answering, badge awards). */
export async function resetStudentPassword(studentId: string, teacherId: string): Promise<ResetPasswordResult> {
  const student = await db.user.findUnique({ where: { id: studentId } });
  if (!student || student.role !== "STUDENT") {
    return { ok: false, error: "Student not found", status: 404 };
  }

  const password = generatePassword();
  const hash = await bcrypt.hash(password, 10);

  await db.user.update({
    where: { id: studentId },
    data: { password: hash, passwordResetAt: new Date(), passwordResetById: teacherId },
  });

  return { ok: true, id: student.id, email: student.email, password };
}
