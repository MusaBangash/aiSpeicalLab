import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/shell/Icon";
import type { AtRiskStudentRow } from "@/lib/atrisk";

const TREND_LABEL: Record<string, string> = {
  up: "improving",
  down: "declining",
  flat: "steady",
  insufficient: "",
};

const SHOWN_COUNT = 5;

export function AtRiskStudentsCard({
  students,
  viewAllHref,
}: {
  students: AtRiskStudentRow[];
  viewAllHref: string;
}) {
  if (students.length === 0) {
    return (
      <Card className="feed-card" style={{ marginBottom: "var(--space-6)" }}>
        <div className="feed-title">At-risk students</div>
        <div className="feed-empty">No students currently flagged.</div>
      </Card>
    );
  }

  const shown = students.slice(0, SHOWN_COUNT);

  return (
    <Card className="feed-card" style={{ marginBottom: "var(--space-6)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="feed-title" style={{ marginBottom: 0 }}>
          At-risk students
        </div>
        {students.length > SHOWN_COUNT ? (
          <Link href={viewAllHref} style={{ fontSize: 13 }}>
            View all {students.length}
          </Link>
        ) : null}
      </div>
      <div style={{ marginTop: 10 }}>
        {shown.map((s) => {
          const trendLabel = TREND_LABEL[s.scoreTrend];
          return (
            <Link
              key={s.id}
              href={`/teacher/students/${s.id}`}
              className="feed-item weight-important"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="feed-dot l">
                <Icon name="target" size={16} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div className="feed-t">{s.name}</div>
                  <Chip variant="coral">At risk</Chip>
                </div>
                <div className="feed-s">
                  {s.avgScorePercent}% avg · {s.attendancePercent}% attendance
                  {trendLabel ? ` · ${trendLabel}` : ""}
                  {s.weakestTopic ? ` · weakest: ${s.weakestTopic.moduleTitle} (${s.weakestTopic.percentCorrect}%)` : ""}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}
