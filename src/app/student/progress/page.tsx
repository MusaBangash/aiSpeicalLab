/** Student: my exam avg, attendance %, category averages, and journal entry feed (read-only) */
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getStudentMetrics, JOURNAL_CATEGORIES } from "@/lib/metrics";
import { getStudentRankStatus } from "@/lib/rank";
import { getBadgeShelf } from "@/lib/badges";
import { PageHeader } from "@/components/shell/PageHeader";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/shell/Icon";
import { RankLadderCard } from "@/components/rank/RankLadderCard";
import { BadgeShelf } from "@/components/rank/BadgeShelf";

const CATEGORY_LABELS: Record<string, string> = {
  PARTICIPATION: "Participation",
  BEHAVIOUR: "Behaviour",
  EXTRA_ACTIVITY: "Extra activity",
};

export default async function StudentProgressPage() {
  const session = await auth();
  if (!session || session.user.role !== "STUDENT") redirect("/login");

  const [metrics, rankStatus, badgeShelf] = await Promise.all([
    getStudentMetrics(session.user.id),
    getStudentRankStatus(session.user.id),
    getBadgeShelf(session.user.id),
  ]);
  const activeEntries = metrics.entries.filter((e) => e.status === "ACTIVE");

  return (
    <div className="page-anim">
      <PageHeader title="Progress" />
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
        <div className="feed-title">Rank &amp; Badges</div>
        <RankLadderCard status={rankStatus} />
        <BadgeShelf badges={badgeShelf} />
      </Card>

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
