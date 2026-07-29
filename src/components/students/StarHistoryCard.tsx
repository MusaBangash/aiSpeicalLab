import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/shell/Icon";
import type { StarRow } from "@/lib/stars";

export function StarHistoryCard({ stars }: { stars: StarRow[] }) {
  return (
    <Card className="feed-card" style={{ marginBottom: "var(--space-6)" }}>
      <div className="feed-title">Stars</div>
      {stars.length === 0 ? (
        <div className="feed-empty">No stars given yet.</div>
      ) : (
        stars.map((s) => (
          <div key={s.id} className="feed-item">
            <div className="feed-dot g">
              <Icon name="star" size={16} />
            </div>
            <div>
              <div className="feed-t">{s.reason ?? "No reason given"}</div>
              <div className="feed-s">
                {s.teacherName} ·{" "}
                {s.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
          </div>
        ))
      )}
    </Card>
  );
}
