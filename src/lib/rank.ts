import { db } from "./db";
import { getStudentJoinDate } from "./classes";
import { getExamCounts } from "./dashboard";
import { getStudentMetrics } from "./metrics";
import { countDaysPresent } from "./attendance";
import { getStarCount, STAR_POINT_VALUE } from "./stars";

export type RankName = "Recruit" | "Apprentice" | "Builder" | "Engineer" | "Architect" | "Master Engineer";

export type RankLadderEntry = {
  rank: RankName;
  minTenureMonths: number;
  minPoints: number;
  extraGateLabel: string | null;
};

export const RANK_LADDER: RankLadderEntry[] = [
  { rank: "Recruit", minTenureMonths: 0, minPoints: 0, extraGateLabel: null },
  { rank: "Apprentice", minTenureMonths: 3, minPoints: 40, extraGateLabel: null },
  { rank: "Builder", minTenureMonths: 6, minPoints: 90, extraGateLabel: null },
  { rank: "Engineer", minTenureMonths: 12, minPoints: 175, extraGateLabel: null },
  { rank: "Architect", minTenureMonths: 18, minPoints: 275, extraGateLabel: "Project Complete badge" },
  { rank: "Master Engineer", minTenureMonths: 24, minPoints: 400, extraGateLabel: "Teacher nomination" },
];

/** Full calendar months elapsed since joinDate, floored, never negative.
 *  Local-getters-are-authoritative, same convention as startOfDay/isWeekend
 *  (docs/05-implementation-notes.md) — no UTC conversion. */
export function tenureMonthsSince(joinDate: Date | null, today: Date): number {
  if (!joinDate) return 0;
  let months = (today.getFullYear() - joinDate.getFullYear()) * 12 + (today.getMonth() - joinDate.getMonth());
  if (today.getDate() < joinDate.getDate()) months -= 1;
  return Math.max(0, months);
}

export type PointsBreakdown = {
  examPoints: number;
  attendancePoints: number;
  journalPoints: number;
  badgePoints: number;
  starPoints: number;
  total: number;
};

/** Points formula — computed live on every read, matches the codebase's
 *  established "computed on read" convention (lateness/streaks/etc). */
export async function getPointsBreakdown(studentId: string): Promise<PointsBreakdown> {
  const [examCounts, attendanceRows, metrics, badgeCount, starCount] = await Promise.all([
    getExamCounts(studentId),
    db.attendance.findMany({ where: { studentId }, select: { status: true } }),
    getStudentMetrics(studentId),
    db.studentBadge.count({ where: { studentId } }),
    getStarCount(studentId),
  ]);

  const highRatedActive = metrics.entries.filter(
    (e) => e.status === "ACTIVE" && e.rating >= 4 && (e.category === "PARTICIPATION" || e.category === "BEHAVIOUR")
  ).length;

  const examPoints = examCounts.examsPassed * 10;
  const attendancePoints = Math.floor(countDaysPresent(attendanceRows) / 2);
  const journalPoints = highRatedActive * 5;
  const badgePoints = badgeCount * 20;
  const starPoints = starCount * STAR_POINT_VALUE;

  return {
    examPoints,
    attendancePoints,
    journalPoints,
    badgePoints,
    starPoints,
    total: examPoints + attendancePoints + journalPoints + badgePoints + starPoints,
  };
}

export type RankStatus = {
  currentRank: RankName;
  currentRankIndex: number;
  nextRank: RankName | null;
  pointsToNextRank: number | null;
  monthsToNextTenure: number | null;
  nextRankExtraGateLabel: string | null;
  nextRankExtraGateMet: boolean;
  ladder: Array<RankLadderEntry & { achieved: boolean }>;
};

/** Pure — takes already-fetched stats, no DB access. Ladder is checked
 *  TOP-DOWN, returning the first (highest) rank whose OWN full gate
 *  (tenure AND points AND extra gate) is satisfied — NOT a bottom-up
 *  sequential climb. The two extra gates (Architect's badge, Master
 *  Engineer's nomination) are independent facts, not monotonic with
 *  tenure/points, so a student could in principle be nominated for
 *  Master Engineer without ever holding Project Complete. Since
 *  minTenureMonths/minPoints themselves ARE monotonically increasing up
 *  the ladder, top-down first-match is correct and simpler than a
 *  sequential walk. */
export function computeRank(params: {
  tenureMonths: number;
  points: number;
  hasProjectCompleteBadge: boolean;
  hasMasterEngineerNomination: boolean;
}): RankStatus {
  const { tenureMonths, points, hasProjectCompleteBadge, hasMasterEngineerNomination } = params;

  const extraGateMet = (entry: RankLadderEntry): boolean => {
    if (entry.rank === "Architect") return hasProjectCompleteBadge;
    if (entry.rank === "Master Engineer") return hasMasterEngineerNomination;
    return true;
  };

  let currentRankIndex = 0;
  for (let i = RANK_LADDER.length - 1; i >= 0; i--) {
    const entry = RANK_LADDER[i];
    if (tenureMonths >= entry.minTenureMonths && points >= entry.minPoints && extraGateMet(entry)) {
      currentRankIndex = i;
      break;
    }
  }

  const nextEntry = RANK_LADDER[currentRankIndex + 1] ?? null;

  return {
    currentRank: RANK_LADDER[currentRankIndex].rank,
    currentRankIndex,
    nextRank: nextEntry?.rank ?? null,
    pointsToNextRank: nextEntry ? Math.max(0, nextEntry.minPoints - points) : null,
    monthsToNextTenure: nextEntry ? Math.max(0, nextEntry.minTenureMonths - tenureMonths) : null,
    nextRankExtraGateLabel: nextEntry?.extraGateLabel ?? null,
    nextRankExtraGateMet: nextEntry ? extraGateMet(nextEntry) : true,
    ladder: RANK_LADDER.map((entry, i) => ({ ...entry, achieved: i <= currentRankIndex })),
  };
}

export type StudentRankStatus = {
  joinDate: Date | null;
  tenureMonths: number;
  points: PointsBreakdown;
  rank: RankStatus;
};

/** The one function server components/routes call directly (no GET route). */
export async function getStudentRankStatus(studentId: string, today: Date = new Date()): Promise<StudentRankStatus> {
  const [joinDate, points, extraGateBadges] = await Promise.all([
    getStudentJoinDate(studentId),
    getPointsBreakdown(studentId),
    db.studentBadge.findMany({
      where: { studentId, type: { in: ["PROJECT_COMPLETE", "MASTER_ENGINEER_NOMINATION"] } },
      select: { type: true },
    }),
  ]);

  const tenureMonths = tenureMonthsSince(joinDate, today);
  const hasProjectCompleteBadge = extraGateBadges.some((b) => b.type === "PROJECT_COMPLETE");
  const hasMasterEngineerNomination = extraGateBadges.some((b) => b.type === "MASTER_ENGINEER_NOMINATION");

  const rank = computeRank({ tenureMonths, points: points.total, hasProjectCompleteBadge, hasMasterEngineerNomination });

  return { joinDate, tenureMonths, points, rank };
}
