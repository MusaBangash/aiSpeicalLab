import { getStudentTopicBreakdown } from "@/lib/exam";
import { Card } from "@/components/ui/Card";

export async function TopicBreakdown({ studentId }: { studentId: string }) {
  const rows = await getStudentTopicBreakdown(studentId);

  if (rows.length === 0) {
    return (
      <Card className="feed-card">
        <div className="feed-title">Topic strength &amp; weakness</div>
        <div className="feed-empty">No exam attempts yet.</div>
      </Card>
    );
  }

  return (
    <Card className="feed-card">
      <div className="feed-title">Topic strength &amp; weakness</div>
      {rows.map((r) => (
        <div key={r.moduleId} style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5, marginBottom: 6 }}>
            <span>{r.moduleTitle}</span>
            <span style={{ fontFamily: "var(--mono)", color: "var(--muted)" }}>
              {r.correctCount}/{r.totalCount} ({r.percentCorrect}%)
            </span>
          </div>
          <div className="bar">
            <div
              className="bar-fill"
              style={{
                width: `${r.percentCorrect}%`,
                background: r.percentCorrect < 60 ? "var(--coral)" : r.percentCorrect < 80 ? "var(--gold)" : "var(--leaf)",
              }}
            />
          </div>
        </div>
      ))}
    </Card>
  );
}
