import { describe, test, expect, afterEach } from "vitest";
import { db } from "@/lib/db";
import { markPresentIfUnset } from "@/lib/attendance";
import { createTestLab, createTestStudent } from "./helpers";

describe("markPresentIfUnset", () => {
  let studentId: string | null = null;
  let fixtures: { cleanup: () => Promise<void> }[] = [];

  // Attendance.studentId is ON DELETE RESTRICT — must clear Attendance rows
  // before the student fixture's own cleanup deletes the User row.
  afterEach(async () => {
    if (studentId) await db.attendance.deleteMany({ where: { studentId } });
    await Promise.all(fixtures.map((f) => f.cleanup()));
    fixtures = [];
    studentId = null;
  });

  test("calling it twice the same day creates exactly one row and does not change it the second time", async () => {
    const lab = await createTestLab();
    const student = await createTestStudent(lab.id);
    studentId = student.id;
    fixtures = [student, lab];

    const at = new Date(2026, 6, 24, 9, 5);
    await markPresentIfUnset(student.id, at);

    const rowsAfterFirst = await db.attendance.findMany({ where: { studentId: student.id } });
    expect(rowsAfterFirst).toHaveLength(1);
    const firstCheckedInAt = rowsAfterFirst[0].checkedInAt?.getTime();
    const firstStatus = rowsAfterFirst[0].status;

    // Second call, same day, later time — should be a complete no-op.
    await markPresentIfUnset(student.id, new Date(2026, 6, 24, 14, 0));

    const rowsAfterSecond = await db.attendance.findMany({ where: { studentId: student.id } });
    expect(rowsAfterSecond).toHaveLength(1);
    expect(rowsAfterSecond[0].checkedInAt?.getTime()).toBe(firstCheckedInAt);
    expect(rowsAfterSecond[0].status).toBe(firstStatus);
  });

  test("a student with no active class enrollment is always marked PRESENT, regardless of time of day", async () => {
    const lab = await createTestLab();
    const student = await createTestStudent(lab.id);
    studentId = student.id;
    fixtures = [student, lab];

    await markPresentIfUnset(student.id, new Date(2026, 6, 24, 23, 0));
    const row = await db.attendance.findFirstOrThrow({ where: { studentId: student.id } });
    expect(row.status).toBe("PRESENT");
    expect(row.source).toBe("AUTO");
  });
});
