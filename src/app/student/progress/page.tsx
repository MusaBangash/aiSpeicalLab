/** Student: my exam avg, attendance %, category averages, and journal entry feed (read-only) */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getStudentMetrics, JOURNAL_CATEGORIES } from "@/lib/metrics";
import { getStudentRankStatus } from "@/lib/rank";
import { getBadgeShelf } from "@/lib/badges";
import { getExamCounts } from "@/lib/dashboard";
import { computeStreak } from "@/lib/attendance";
import { getStudentTopicBreakdown } from "@/lib/exam";
import { getDoubtsForStudent } from "@/lib/doubts";
import { computeScoreTrend, pickWeakestTopic, countDoubtsOnTopicThisTerm, generateDnaSummary } from "@/lib/dna";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/shell/Icon";
import { RankLadderCard } from "@/components/rank/RankLadderCard";
import { BadgeShelf } from "@/components/rank/BadgeShelf";
import { ExamScoreTrend } from "@/components/students/ExamScoreTrend";
import { TopicBreakdown } from "@/components/students/TopicBreakdown";
import { DnaSummaryCard, type DnaHighlight } from "@/components/students/DnaSummaryCard";
import { RecentDoubtsCard } from "@/components/doubts/RecentDoubtsCard";
import { RankAvatar } from "@/components/students/RankAvatar";

const CATEGORY_LABELS: Record<string, string> = {
  PARTICIPATION: "Participation",
  BEHAVIOUR: "Behaviour",
  EXTRA_ACTIVITY: "Extra activity",
};

export default async function StudentProgressPage() {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") redirect("/login");

  const [metrics, rankStatus, badgeShelf, examCounts, topicRows, doubts, examRecordsForTrend, allAttendance] = await Promise.all([
    getStudentMetrics(session.user.id),
    getStudentRankStatus(session.user.id),
    getBadgeShelf(session.user.id),
    getExamCounts(session.user.id),
    getStudentTopicBreakdown(session.user.id),
    getDoubtsForStudent(session.user.id),
    db.examRecord.findMany({ where: { studentId: session.user.id }, select: { scorePercent: true, updatedAt: true } }),
    db.attendance.findMany({ where: { studentId: session.user.id } }),
  ]);
  const activeEntries = metrics.entries.filter((e) => e.status === "ACTIVE");

  const weakestTopic = pickWeakestTopic(topicRows);
  const doubtsOnWeakestTopicThisTerm = weakestTopic ? countDoubtsOnTopicThisTerm(doubts, weakestTopic.moduleTitle) : 0;
  const dnaSummary = generateDnaSummary({
    avgScorePercent: metrics.avgScorePercent,
    examsTaken: examCounts.examsTaken,
    scoreTrend: computeScoreTrend(examRecordsForTrend),
    weakestTopic,
    doubtsOnWeakestTopicThisTerm,
    attendancePercent: metrics.attendancePercent,
    rankName: rankStatus.rank.currentRank,
  });
  const dnaHighlights: DnaHighlight[] = [
    { label: "Average score", value: `${metrics.avgScorePercent}%` },
    { label: "Attendance", value: `${metrics.attendancePercent}%`, color: "var(--leaf-soft)" },
    { label: "Current streak", value: `${computeStreak(allAttendance, new Date())} days`, color: "var(--gold-mist)" },
    { label: "Rank", value: rankStatus.rank.currentRank, color: "var(--gold-soft)" },
    ...(weakestTopic
      ? [{ label: "Weakest topic", value: `${weakestTopic.moduleTitle} (${weakestTopic.percentCorrect}%)`, color: "var(--coral-soft)" }]
      : []),
  ];

  return (
    <div className="page-anim">
      <PageHeader title="Progress" />

      <DnaSummaryCard summary={dnaSummary} highlights={dnaHighlights} />
      <RecentDoubtsCard doubts={doubts} viewAllHref="/student/doubts" />

      <div className="hero-grid">
        <Card className="mini-card">
          <div className="mini-top">
            <div className="mini-icon l">
              <Icon name="trophy" size={18} />
            </div>
          </div>
          <div className="mini-num">{metrics.avgScorePercent}%</div>
          <div className="mini-label">Average exam score</div>
        </Card>
        <Card className="mini-card">
          <div className="mini-top">
            <div className="mini-icon g">
              <Icon name="check" size={18} />
            </div>
          </div>
          <div className="mini-num">{metrics.attendancePercent}%</div>
          <div className="mini-label">Attendance this term</div>
        </Card>
        {JOURNAL_CATEGORIES.map((cat) => (
          <Card className="mini-card" key={cat}>
            <div className="mini-top">
              <div className="mini-icon g">
                <Icon name="star" size={18} />
              </div>
            </div>
            <div className="mini-num">
              {metrics.categoryAverages[cat] !== null ? `${metrics.categoryAverages[cat]} / 5` : "—"}
            </div>
            <div className="mini-label">{CATEGORY_LABELS[cat]}</div>
          </Card>
        ))}
      </div>

      <Card className="feed-card" style={{ marginTop: 16, marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <RankAvatar name={session.user.name ?? ""} rank={rankStatus.rank.currentRank} />
          <div className="feed-title" style={{ marginBottom: 0 }}>Rank &amp; Badges</div>
        </div>
        <RankLadderCard status={rankStatus} />
        <BadgeShelf badges={badgeShelf} />
      </Card>

      <ExamScoreTrend studentId={session.user.id} />
      <TopicBreakdown rows={topicRows} />

      <Card className="feed-card" style={{ marginTop: 16 }}>
        <div className="feed-title">Entry history</div>
        {activeEntries.length === 0 ? (
          <div className="feed-empty">No entries yet.</div>
        ) : (
          activeEntries.map((entry) => (
            <div key={entry.id} className="feed-item">
              <div className="feed-dot g">
                <Icon name="star" size={16} />
              </div>
              <div>
                <div className="feed-t">
                  {CATEGORY_LABELS[entry.category]} — {entry.rating}/5
                  {entry.note ? ` · ${entry.note}` : ""}
                </div>
                <div className="feed-s">
                  {entry.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
            </div>
          ))
        )}
      </Card>
    </div>
  );
}
