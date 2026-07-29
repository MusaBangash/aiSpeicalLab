import { Card } from "@/components/ui/Card";
import type { CheckInRow } from "@/lib/wellbeing";

const MOOD_LABEL: Record<string, string> = {
  GREAT: "😄 Great",
  GOOD: "🙂 Good",
  OKAY: "😐 Okay",
  LOW: "🙁 Low",
  STRUGGLING: "😔 Struggling",
};

export function WellbeingHistoryCard({ checkIns }: { checkIns: CheckInRow[] }) {
  return (
    <Card className="feed-card" style={{ marginTop: 16, marginBottom: 16 }}>
      <div className="feed-title">Wellbeing</div>
      {checkIns.length === 0 ? (
        <div className="feed-empty">No check-ins yet.</div>
      ) : (
        checkIns.map((c) => (
          <div key={c.id} className="feed-item">
            <div>
              <div className="feed-t">
                {MOOD_LABEL[c.mood]}
                {c.note ? ` — ${c.note}` : ""}
              </div>
              <div className="feed-s">
                {new Date(c.date).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
              </div>
            </div>
          </div>
        ))
      )}
    </Card>
  );
}
