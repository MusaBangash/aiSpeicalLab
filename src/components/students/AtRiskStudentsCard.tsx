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

export function AtRiskStudentsCard({ students }: { students: AtRiskStudentRow[] }) {
  if (students.length === 0) {
    return (
      <Card className="feed-card">
        <div className="feed-title">At-risk students</div>
        <div className="feed-empty">No students currently flagged.</div>
      </Card>
    );
  }

  return (
    <Card className="feed-card">
      <div className="feed-title">At-risk students</div>
      {students.map((s) => {
        const trendLabel = TREND_LABEL[s.scoreTrend];
        return (
          <Link
            key={s.id}
            href={`/teacher/students/${s.id}`}
            className="feed-item"
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
    </Card>
  );
}
