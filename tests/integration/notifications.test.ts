import { describe, test, expect, afterEach } from "vitest";
import { db } from "@/lib/db";
import { getNotificationsForStudent, getUnseenNotificationCount, markAllNotificationsSeen } from "@/lib/notifications";
import { createTestLab, createTestTeacher, createTestStudent, createTestModule } from "./helpers";

describe("notifications", () => {
  let fixtures: { cleanup: () => Promise<void> }[] = [];

  afterEach(async () => {
    for (const f of fixtures) await f.cleanup();
    fixtures = [];
  });

  test("one unread message + one answered-unseen doubt + one earned-unseen badge -> count is 3, drops to 0 after marking seen, full history still returns all 3", async () => {
    const lab = await createTestLab();
    const teacher = await createTestTeacher(lab.id);
    const student = await createTestStudent(lab.id);
    const module = await createTestModule();
    fixtures = [student, teacher, module, lab];

    const message = await db.message.create({
      data: { teacherId: teacher.id, urgency: "NORMAL", targetType: "STUDENT", targetStudentId: student.id, body: "Please see me after class" },
    });
    await db.messageRecipient.create({ data: { messageId: message.id, studentId: student.id } });

    const doubt = await db.doubt.create({
      data: {
        studentId: student.id,
        moduleId: module.id,
        body: "How does this work?",
        answerBody: "Like this.",
        answeredById: teacher.id,
        answeredAt: new Date(),
      },
    });

    await db.studentBadge.create({ data: { studentId: student.id, type: "PERFECT_SCORE" } });

    const countBefore = await getUnseenNotificationCount(student.id);
    expect(countBefore).toBe(3);

    const itemsBefore = await getNotificationsForStudent(student.id);
    expect(itemsBefore).toHaveLength(3);
    expect(itemsBefore.map((i) => i.type).sort()).toEqual(["badge_earned", "doubt_answered", "message"]);

    await markAllNotificationsSeen(student.id);

    const countAfter = await getUnseenNotificationCount(student.id);
    expect(countAfter).toBe(0);

    const itemsAfter = await getNotificationsForStudent(student.id);
    expect(itemsAfter).toHaveLength(3); // full history unaffected by seen-marking

    // cleanup rows this test created directly (not covered by the shared fixture builders)
    await db.studentBadge.deleteMany({ where: { studentId: student.id } });
    await db.doubt.delete({ where: { id: doubt.id } });
    await db.messageRecipient.deleteMany({ where: { messageId: message.id } });
    await db.message.delete({ where: { id: message.id } });
  });

  test("an unanswered doubt and a student with no signals at all don't count or appear", async () => {
    const lab = await createTestLab();
    const student = await createTestStudent(lab.id);
    const module = await createTestModule();
    fixtures = [student, module, lab];

    const doubt = await db.doubt.create({ data: { studentId: student.id, moduleId: module.id, body: "Still stuck" } });

    expect(await getUnseenNotificationCount(student.id)).toBe(0);
    expect(await getNotificationsForStudent(student.id)).toEqual([]);

    await db.doubt.delete({ where: { id: doubt.id } });
  });
});
