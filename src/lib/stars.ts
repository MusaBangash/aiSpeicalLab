import { db } from "./db";

/** Points each star contributes to the rank formula (src/lib/rank.ts).
 *  Kept low deliberately: stars are meant to be given often/casually
 *  during class, unlike journal entries (5pts, deliberate) or badges
 *  (20pts, rare) — a high value here would let stars dominate rank. */
export const STAR_POINT_VALUE = 1;

/** Un-retractable, create-only — see the Star model's own comment.
 *  reason is optional — a teacher can still give a star with one tap
 *  and no explanation, same speed as before this existed. */
export async function awardStar(studentId: string, teacherId: string, classId: string, reason?: string): Promise<void> {
  await db.star.create({ data: { studentId, teacherId, classId, reason: reason?.trim() || null } });
}

export async function getStarCount(studentId: string): Promise<number> {
  return db.star.count({ where: { studentId } });
}

export type StarRow = { id: string; reason: string | null; createdAt: Date; teacherName: string };

export async function getStarsForStudent(studentId: string): Promise<StarRow[]> {
  const stars = await db.star.findMany({
    where: { studentId },
    orderBy: { createdAt: "desc" },
    include: { teacher: { select: { name: true } } },
  });
  return stars.map((s) => ({ id: s.id, reason: s.reason, createdAt: s.createdAt, teacherName: s.teacher.name }));
}
