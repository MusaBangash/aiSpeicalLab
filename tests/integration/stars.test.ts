import { describe, test, expect, afterEach } from "vitest";
import { db } from "@/lib/db";
import { awardStar, getStarCount, getStarsForStudent } from "@/lib/stars";
import { getPointsBreakdown } from "@/lib/rank";
import { createTestLab, createTestTeacher, createTestStudent } from "./helpers";

describe("stars", () => {
  let studentId: string | null = null;
  let classId: string | null = null;
  let fixtures: { cleanup: () => Promise<void> }[] = [];

  afterEach(async () => {
    if (studentId) await db.star.deleteMany({ where: { studentId } });
    if (classId) await db.class.delete({ where: { id: classId } });
    for (const f of fixtures) await f.cleanup();
    fixtures = [];
    studentId = null;
    classId = null;
  });

  test("awardStar creates a row, getStarCount reflects it, and getPointsBreakdown includes starPoints in the total", async () => {
    const lab = await createTestLab();
    const teacher = await createTestTeacher(lab.id);
    const student = await createTestStudent(lab.id);
    studentId = student.id;
    fixtures = [teacher, student, lab];

    const cls = await db.class.create({ data: { name: "Test Class", teacherId: teacher.id } });
    classId = cls.id;

    await awardStar(student.id, teacher.id, cls.id);
    await awardStar(student.id, teacher.id, cls.id);
    await awardStar(student.id, teacher.id, cls.id);

    const count = await getStarCount(student.id);
    expect(count).toBe(3);

    const points = await getPointsBreakdown(student.id);
    expect(points.starPoints).toBe(3);
    expect(points.total).toBe(3); // no exam/attendance/journal/badge signals in this fixture
  });

  test("a star given with a reason round-trips through getStarsForStudent; one given with no reason stores null, not an empty string", async () => {
    const lab = await createTestLab();
    const teacher = await createTestTeacher(lab.id);
    const student = await createTestStudent(lab.id);
    studentId = student.id;
    fixtures = [teacher, student, lab];

    const cls = await db.class.create({ data: { name: "Test Class", teacherId: teacher.id } });
    classId = cls.id;

    await awardStar(student.id, teacher.id, cls.id, "Great question in class today");
    await awardStar(student.id, teacher.id, cls.id); // no reason — still a valid, fast tap

    const rows = await getStarsForStudent(student.id);
    expect(rows).toHaveLength(2);
    // Newest first.
    expect(rows[0].reason).toBeNull();
    expect(rows[1].reason).toBe("Great question in class today");
    expect(rows[0].teacherName).toBe("Test Teacher");
  });

  test("a student with no stars has starPoints 0", async () => {
    const lab = await createTestLab();
    const student = await createTestStudent(lab.id);
    studentId = student.id;
    fixtures = [student, lab];

    const count = await getStarCount(student.id);
    expect(count).toBe(0);

    const points = await getPointsBreakdown(student.id);
    expect(points.starPoints).toBe(0);
  });
});
