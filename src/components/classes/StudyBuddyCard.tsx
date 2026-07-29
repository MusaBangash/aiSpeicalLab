import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/shell/Icon";
import type { StudyBuddySuggestion } from "@/lib/studybuddy";

export function StudyBuddyCard({ suggestions }: { suggestions: StudyBuddySuggestion[] }) {
  if (suggestions.length === 0) {
    return (
      <Card className="feed-card" style={{ marginBottom: "var(--space-6)" }}>
        <div className="feed-title">Study buddy suggestions</div>
        <div className="feed-empty">No pairing suggestions yet — need more exam history in this class.</div>
      </Card>
    );
  }

  return (
    <Card className="feed-card" style={{ marginBottom: "var(--space-6)" }}>
      <div className="feed-title">Study buddy suggestions</div>
      {suggestions.map((s) => (
        <div key={s.studentId} className="feed-item">
          <div className="feed-dot l">
            <Icon name="people" size={16} />
          </div>
          <div>
            <div className="feed-t">
              {s.studentName} ({s.weakPercent}%) ↔ {s.partnerName} ({s.partnerPercent}%)
            </div>
            <div className="feed-s">Topic: {s.weakTopic}</div>
          </div>
        </div>
      ))}
    </Card>
  );
}
