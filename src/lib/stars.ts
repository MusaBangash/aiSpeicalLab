import { db } from "./db";

/** Points each star contributes to the rank formula (src/lib/rank.ts).
 *  Kept low deliberately: stars are meant to be given often/casually
 *  during class, unlike journal entries (5pts, deliberate) or badges
 *  (20pts, rare) — a high value here would let stars dominate rank. */
export const STAR_POINT_VALUE = 1;

/** Un-retractable, create-only — see the Star model's own comment. */
export async function awardStar(studentId: string, teacherId: string, classId: string): Promise<void> {
  await db.star.create({ data: { studentId, teacherId, classId } });
}

export async function getStarCount(studentId: string): Promise<number> {
  return db.star.count({ where: { studentId } });
}
