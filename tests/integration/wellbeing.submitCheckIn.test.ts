import { describe, test, expect, afterEach } from "vitest";
import { db } from "@/lib/db";
import { submitCheckIn, getTodayCheckIn, getCheckInsForStudent } from "@/lib/wellbeing";
import { createTestLab, createTestStudent } from "./helpers";

describe("wellbeing check-ins", () => {
  let fixtures: { cleanup: () => Promise<void> }[] = [];

  afterEach(async () => {
    for (const f of fixtures) await f.cleanup();
    fixtures = [];
  });

  test("no check-in yet -> null; submitting creates one; resubmitting the SAME day updates it (not a duplicate); a different day creates a separate row", async () => {
    const today = new Date(2026, 6, 24);
    const otherDay = new Date(2026, 6, 20);

    const lab = await createTestLab();
    const student = await createTestStudent(lab.id);
    fixtures = [student, lab];

    expect(await getTodayCheckIn(student.id, today)).toBeNull();

    await submitCheckIn(student.id, "OKAY", "feeling fine", today);
    const first = await getTodayCheckIn(student.id, today);
    expect(first).not.toBeNull();
    expect(first!.mood).toBe("OKAY");
    expect(first!.note).toBe("feeling fine");

    // Resubmitting the SAME day updates the existing row, doesn't create a second.
    await submitCheckIn(student.id, "GREAT", "actually feeling great now", today);
    const updated = await getTodayCheckIn(student.id, today);
    expect(updated!.id).toBe(first!.id); // same row
    expect(updated!.mood).toBe("GREAT");
    expect(updated!.note).toBe("actually feeling great now");

    const allForToday = await getCheckInsForStudent(student.id);
    expect(allForToday.filter((c) => c.id === first!.id)).toHaveLength(1); // still exactly one row for that day

    // A submission on a genuinely different day creates a separate row.
    await submitCheckIn(student.id, "LOW", undefined, otherDay);
    const rows = await getCheckInsForStudent(student.id);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.mood).sort()).toEqual(["GREAT", "LOW"]);

    await db.wellbeingCheckIn.deleteMany({ where: { studentId: student.id } });
  });

  test("optional note can be omitted", async () => {
    const today = new Date(2026, 6, 24);
    const lab = await createTestLab();
    const student = await createTestStudent(lab.id);
    fixtures = [student, lab];

    await submitCheckIn(student.id, "STRUGGLING", undefined, today);
    const row = await getTodayCheckIn(student.id, today);

    expect(row!.mood).toBe("STRUGGLING");
    expect(row!.note).toBeNull();

    await db.wellbeingCheckIn.deleteMany({ where: { studentId: student.id } });
  });
});
