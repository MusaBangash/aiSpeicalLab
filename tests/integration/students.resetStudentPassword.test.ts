import { describe, test, expect, afterEach } from "vitest";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { resetStudentPassword } from "@/lib/students";
import { createTestLab, createTestStudent, createTestTeacher } from "./helpers";

describe("resetStudentPassword", () => {
  let fixtures: { cleanup: () => Promise<void> }[] = [];

  afterEach(async () => {
    await Promise.all(fixtures.map((f) => f.cleanup()));
    fixtures = [];
  });

  test("invalidates the old password, sets a new working one, and stamps audit fields", async () => {
    const lab = await createTestLab();
    const student = await createTestStudent(lab.id);
    const teacher = await createTestTeacher(lab.id);
    fixtures = [student, teacher, lab];

    const oldPassword = "test-password-123"; // set by createTestStudent
    const before = await db.user.findUniqueOrThrow({ where: { id: student.id } });
    expect(await bcrypt.compare(oldPassword, before.password)).toBe(true);

    const result = await resetStudentPassword(student.id, teacher.id);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error("unreachable");

    const after = await db.user.findUniqueOrThrow({ where: { id: student.id } });
    expect(await bcrypt.compare(oldPassword, after.password)).toBe(false);
    expect(await bcrypt.compare(result.password, after.password)).toBe(true);
    expect(after.passwordResetById).toBe(teacher.id);
    expect(after.passwordResetAt).not.toBeNull();
  });

  test("rejects a non-student id", async () => {
    const lab = await createTestLab();
    const teacher = await createTestTeacher(lab.id);
    const otherTeacher = await createTestTeacher(lab.id);
    fixtures = [teacher, otherTeacher, lab];

    const result = await resetStudentPassword(teacher.id, otherTeacher.id);
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("unreachable");
    expect(result.status).toBe(404);
  });
});
