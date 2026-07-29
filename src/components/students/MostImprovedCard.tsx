import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/shell/Icon";
import type { MostImprovedRow } from "@/lib/dashboard";

export function MostImprovedCard({ students }: { students: MostImprovedRow[] }) {
  const top = students.slice(0, 10);

  if (top.length === 0) {
    return (
      <Card className="feed-card" style={{ marginBottom: "var(--space-6)" }}>
        <div className="feed-title">Most improved (last 30 days)</div>
        <div className="feed-empty">Not enough exam history yet to measure improvement.</div>
      </Card>
    );
  }

  return (
    <Card className="feed-card" style={{ marginBottom: "var(--space-6)" }}>
      <div className="feed-title">Most improved (last 30 days)</div>
      {top.map((s, i) => (
        <Link
          key={s.id}
          href={`/teacher/students/${s.id}`}
          className="feed-item"
          style={{ textDecoration: "none", color: "inherit" }}
        >
          <div className="feed-dot l">
            <Icon name="flame" size={16} />
          </div>
          <div>
            <div className="feed-t">
              #{i + 1} {s.name}
            </div>
            <div className="feed-s">
              {s.priorAvg}% → {s.recentAvg}% · {s.improvementPercent}% of the gap closed
            </div>
          </div>
        </Link>
      ))}
    </Card>
  );
}
