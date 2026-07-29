import { getAllStudentsSummary, RISK_THRESHOLD_PERCENT } from "./metrics";
import { getExamRecordsByStudent } from "./dashboard";
import { getWeakestTopicByStudent } from "./exam";
import { computeScoreTrend, type ScoreTrend, type WeakestTopic } from "./dna";

export type AtRiskStudentRow = {
  id: string;
  name: string;
  avgScorePercent: number;
  attendancePercent: number;
  scoreTrend: ScoreTrend;
  weakestTopic: WeakestTopic;
};

/** Reuses the exact same "at risk" trigger already used by the
 *  /teacher/students toggle — this only ADDS trend/weakest-topic
 *  context to help a teacher act on the list, it doesn't invent a
 *  second risk formula. Only runs the more expensive batched
 *  trend/topic queries against the (presumably small) at-risk subset,
 *  not the whole roster. */
export async function getAtRiskStudents(today: Date = new Date()): Promise<AtRiskStudentRow[]> {
  const allStudents = await getAllStudentsSummary(today);
  const atRisk = allStudents.filter(
    (s) => s.avgScorePercent < RISK_THRESHOLD_PERCENT || s.attendancePercent < RISK_THRESHOLD_PERCENT
  );
  if (atRisk.length === 0) return [];

  const atRiskIds = atRisk.map((s) => s.id);
  const [examRecordsByStudent, weakestTopicByStudent] = await Promise.all([
    getExamRecordsByStudent(atRiskIds),
    getWeakestTopicByStudent(atRiskIds),
  ]);

  return atRisk.map((s) => ({
    id: s.id,
    name: s.name,
    avgScorePercent: s.avgScorePercent,
    attendancePercent: s.attendancePercent,
    scoreTrend: computeScoreTrend(examRecordsByStudent.get(s.id) ?? []),
    weakestTopic: weakestTopicByStudent.get(s.id) ?? null,
  }));
}
