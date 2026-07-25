import { db } from "./db";
import { getStudentMetrics } from "./metrics";
import { computeStreak } from "./attendance";
import { getExamCounts } from "./dashboard";
import { getStudentJoinDate } from "./classes";
import { RANK_LADDER, tenureMonthsSince, getPointsBreakdown } from "./rank";
import type { IconName } from "@/components/shell/Icon";
import type { BadgeType } from "@prisma/client";

export const BADGE_ORDER: BadgeType[] = [
  "PERFECT_SCORE",
  "EXAM_ACE",
  "STREAK_7",
  "STREAK_30",
  "STREAK_90",
  "TEAM_PLAYER",
  "PROJECT_COMPLETE",
  "MASTER_ENGINEER_NOMINATION",
];

export const BADGE_INFO: Record<BadgeType, { label: string; description: string; icon: IconName }> = {
  PERFECT_SCORE: { label: "Perfect Score", description: "Scored 100% on an exam", icon: "trophy" },
  EXAM_ACE: { label: "Exam Ace", description: "Passed 5 exams", icon: "award" },
  STREAK_7: { label: "7-Day Streak", description: "Reached a 7-day attendance streak", icon: "flame" },
  STREAK_30: { label: "30-Day Streak", description: "Reached a 30-day attendance streak", icon: "flame" },
  STREAK_90: { label: "90-Day Streak", description: "Reached a 90-day attendance streak", icon: "flame" },
  TEAM_PLAYER: { label: "Team Player", description: "Sustained high participation/behaviour ratings", icon: "star" },
  PROJECT_COMPLETE: { label: "Project Complete", description: "Awarded by a teacher for completing a project", icon: "medal" },
  MASTER_ENGINEER_NOMINATION: {
    label: "Master Engineer Nomination",
    description: "Nominated by a teacher for the top rank",
    icon: "medal",
  },
};

const MANUALLY_AWARDED = new Set<BadgeType>(["PROJECT_COMPLETE", "MASTER_ENGINEER_NOMINATION"]);

// Judgment call, not locked by the user — guards against one lucky 5/5
// entry instantly granting Team Player.
const TEAM_PLAYER_MIN_AVG = 4;
const TEAM_PLAYER_MIN_ENTRIES = 3;

/** Create-only upsert — same idempotency pattern as markPresentIfUnset. */
async function awardBadgeIfMissing(studentId: string, type: BadgeType, awardedById?: string): Promise<void> {
  await db.studentBadge.upsert({
    where: { studentId_type: { studentId, type } },
    update: {},
    create: { studentId, type, awardedById },
  });
}

/**
 * Exam-completion badge checks. Call ONLY from finishAttempt's fresh-
 * computation branch (src/lib/exam.ts, after the db.$transaction that
 * persists scorePercent/passed, before the final return) — never from the
 * early-return idempotent-reread branch.
 */
export async function checkAndAwardExamBadges(studentId: string, scorePercent: number, passed: boolean): Promise<void> {
  if (scorePercent === 100) {
    await awardBadgeIfMissing(studentId, "PERFECT_SCORE");
  }
  if (passed) {
    const { examsPassed } = await getExamCounts(studentId);
    if (examsPassed >= 5) {
      await awardBadgeIfMissing(studentId, "EXAM_ACE");
    }
  }
}

/**
 * Login-trigger badge checks (streaks, Team Player) — aggregate/time-based
 * state, not a single event. Called from auth.ts's authorize() and
 * student/dashboard/page.tsx, both wrapped in try/catch.
 */
export async function checkAndAwardLoginBadges(studentId: string, today: Date = new Date()): Promise<void> {
  const [attendanceRows, metrics] = await Promise.all([
    db.attendance.findMany({ where: { studentId } }),
    getStudentMetrics(studentId, today),
  ]);

  const streak = computeStreak(attendanceRows, today);
  if (streak >= 90) await awardBadgeIfMissing(studentId, "STREAK_90");
  if (streak >= 30) await awardBadgeIfMissing(studentId, "STREAK_30");
  if (streak >= 7) await awardBadgeIfMissing(studentId, "STREAK_7");

  const qualifying = metrics.entries.filter(
    (e) => e.status === "ACTIVE" && (e.category === "PARTICIPATION" || e.category === "BEHAVIOUR")
  );
  if (qualifying.length >= TEAM_PLAYER_MIN_ENTRIES) {
    const avg = qualifying.reduce((sum, e) => sum + e.rating, 0) / qualifying.length;
    if (avg >= TEAM_PLAYER_MIN_AVG) await awardBadgeIfMissing(studentId, "TEAM_PLAYER");
  }
}

/** Teacher-manual award #1 — no auto condition, any teacher may award any student. */
export async function awardProjectComplete(studentId: string, teacherId: string): Promise<void> {
  await awardBadgeIfMissing(studentId, "PROJECT_COMPLETE", teacherId);
}

/** Teacher-manual award #2 — re-checks eligibility server-side rather than
 *  trusting the client's disabled-button state. */
export async function nominateMasterEngineer(
  studentId: string,
  teacherId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const masterEntry = RANK_LADDER.find((r) => r.rank === "Master Engineer")!;
  const [joinDate, points] = await Promise.all([getStudentJoinDate(studentId), getPointsBreakdown(studentId)]);
  const tenureMonths = tenureMonthsSince(joinDate, new Date());

  if (tenureMonths < masterEntry.minTenureMonths || points.total < masterEntry.minPoints) {
    return {
      ok: false,
      reason: `Not yet eligible: needs ${masterEntry.minTenureMonths} months tenure and ${masterEntry.minPoints} points (currently ${tenureMonths} months, ${points.total} points).`,
    };
  }

  await awardBadgeIfMissing(studentId, "MASTER_ENGINEER_NOMINATION", teacherId);
  return { ok: true };
}

export type BadgeShelfItem = {
  type: BadgeType;
  label: string;
  description: string;
  icon: IconName;
  earned: boolean;
  earnedAt: Date | null;
  manuallyAwarded: boolean;
};

/** The one read function both surfaces call directly (no GET API route). */
export async function getBadgeShelf(studentId: string): Promise<BadgeShelfItem[]> {
  const rows = await db.studentBadge.findMany({ where: { studentId } });
  const byType = new Map(rows.map((r) => [r.type, r]));

  return BADGE_ORDER.map((type) => {
    const row = byType.get(type);
    const info = BADGE_INFO[type];
    return {
      type,
      label: info.label,
      description: info.description,
      icon: info.icon,
      earned: !!row,
      earnedAt: row?.earnedAt ?? null,
      manuallyAwarded: MANUALLY_AWARDED.has(type),
    };
  });
}
