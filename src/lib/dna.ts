/**
 * "Learning DNA" narrative summary — synthesizes exam/attendance/doubts/rank
 * signals already computed elsewhere into one plain-English paragraph.
 * Pure functions only, zero DB imports (mirrors rank.ts's computeRank
 * convention: "takes already-fetched stats, no DB access"). Deterministic,
 * template-based — NOT an LLM call, per this app's offline-LAN constraint.
 */
import type { TopicBreakdownRow } from "./exam";
import type { DoubtRow } from "./doubts";

export type ScoreTrend = "up" | "down" | "flat" | "insufficient";

/** Latest score vs. the average of everything before it, ±3pp treated as flat.
 *  Fewer than 2 records means there's nothing to compare against yet. */
export function computeScoreTrend(records: { scorePercent: number; updatedAt: Date }[]): ScoreTrend {
  if (records.length < 2) return "insufficient";
  const sorted = [...records].sort((a, b) => a.updatedAt.getTime() - b.updatedAt.getTime());
  const latest = sorted[sorted.length - 1];
  const prior = sorted.slice(0, -1);
  const priorAvg = prior.reduce((sum, r) => sum + r.scorePercent, 0) / prior.length;
  const diff = latest.scorePercent - priorAvg;
  if (diff > 3) return "up";
  if (diff < -3) return "down";
  return "flat";
}

export type WeakestTopic = { moduleTitle: string; percentCorrect: number } | null;

/** Minimum answered-question sample size before a topic counts as a real
 *  weak spot rather than noise from one or two questions. */
const MIN_TOPIC_SAMPLE_SIZE = 3;

/** rows is already sorted weakest-first (getStudentTopicBreakdown's own
 *  contract) — just skip anything under the sample-size floor. */
export function pickWeakestTopic(rows: TopicBreakdownRow[]): WeakestTopic {
  const row = rows.find((r) => r.totalCount >= MIN_TOPIC_SAMPLE_SIZE);
  return row ? { moduleTitle: row.moduleTitle, percentCorrect: row.percentCorrect } : null;
}

/** "Term" = current calendar month, matching getTermAttendancePercent's
 *  own definition of "this term". DoubtRow only carries moduleTitle (no
 *  moduleId), so this matches by title — fine at this app's scale, but a
 *  caveat if two modules ever share a title. */
export function countDoubtsOnTopicThisTerm(doubts: DoubtRow[], moduleTitle: string, today: Date = new Date()): number {
  const year = today.getFullYear();
  const month = today.getMonth();
  return doubts.filter(
    (d) => d.moduleTitle === moduleTitle && d.createdAt.getFullYear() === year && d.createdAt.getMonth() === month
  ).length;
}

/** At or above this many this-term doubts on the weakest topic, the student
 *  is read as leaning on help there rather than tackling it independently. */
export const INDEPENDENCE_THRESHOLD = 3;

export type DnaSummaryInput = {
  avgScorePercent: number;
  examsTaken: number;
  scoreTrend: ScoreTrend;
  weakestTopic: WeakestTopic;
  doubtsOnWeakestTopicThisTerm: number;
  attendancePercent: number;
  rankName: string;
};

function examClause(avgScorePercent: number, examsTaken: number, trend: ScoreTrend): string {
  if (examsTaken === 0) return "No exam history yet";

  const qualifier =
    avgScorePercent >= 85
      ? "Strong technical execution"
      : avgScorePercent >= 70
        ? "Solid technical execution"
        : avgScorePercent >= 50
          ? "Developing technical execution"
          : "Struggling with technical execution";

  const trendClause =
    trend === "up" ? ", improving" : trend === "down" ? ", declining" : trend === "flat" ? ", holding steady" : "";

  return `${qualifier} (${avgScorePercent}% average across exams)${trendClause}`;
}

function topicClause(weakestTopic: WeakestTopic, doubtsOnTopic: number): string | null {
  if (!weakestTopic) return null;
  const independenceClause =
    doubtsOnTopic >= INDEPENDENCE_THRESHOLD
      ? `leans on help with ${weakestTopic.moduleTitle} — ${doubtsOnTopic} question${doubtsOnTopic === 1 ? "" : "s"} this term`
      : `tackled ${weakestTopic.moduleTitle} mostly independently`;
  return `${independenceClause}, weakest topic at ${weakestTopic.percentCorrect}% correct`;
}

/** Composes the already-computed pieces into one plain-English paragraph. */
export function generateDnaSummary(input: DnaSummaryInput): string {
  const clauses = [
    examClause(input.avgScorePercent, input.examsTaken, input.scoreTrend),
    topicClause(input.weakestTopic, input.doubtsOnWeakestTopicThisTerm),
    `${input.attendancePercent}% attendance this term`,
    `ranked ${input.rankName}`,
  ].filter((c): c is string => c !== null);

  return clauses.join("; ") + ".";
}
