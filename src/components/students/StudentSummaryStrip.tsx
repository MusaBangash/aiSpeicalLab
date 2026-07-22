import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/shell/Icon";

export function StudentSummaryStrip({
  joinedDate,
  totalDaysPresent,
  longestStreak,
  examsTaken,
  examsPassed,
}: {
  joinedDate: Date | null;
  totalDaysPresent: number;
  longestStreak: number;
  examsTaken: number;
  examsPassed: number;
}) {
  return (
    <div className="hero-grid">
      <Card className="mini-card">
        <div className="mini-top">
          <div className="mini-icon g">
            <Icon name="calendar" size={18} />
          </div>
        </div>
        <div className="mini-num">
          {joinedDate ? joinedDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—"}
        </div>
        <div className="mini-label">Joined</div>
      </Card>
      <Card className="mini-card">
        <div className="mini-top">
          <div className="mini-icon g">
            <Icon name="check" size={18} />
          </div>
        </div>
        <div className="mini-num">{totalDaysPresent}</div>
        <div className="mini-label">Total days present</div>
      </Card>
      <Card className="mini-card">
        <div className="mini-top">
          <div className="mini-icon l">
            <Icon name="flame" size={18} />
          </div>
        </div>
        <div className="mini-num">{longestStreak}</div>
        <div className="mini-label">Longest streak (days)</div>
      </Card>
      <Card className="mini-card">
        <div className="mini-top">
          <div className="mini-icon l">
            <Icon name="award" size={18} />
          </div>
        </div>
        <div className="mini-num">
          {examsPassed}/{examsTaken}
        </div>
        <div className="mini-label">Exams passed</div>
      </Card>
    </div>
  );
}
