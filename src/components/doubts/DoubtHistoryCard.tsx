import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/shell/Icon";
import type { DoubtRow } from "@/lib/doubts";

const STATUS_CHIP: Record<DoubtRow["status"], { variant: "coral" | "active" | "done"; label: string }> = {
  UNANSWERED: { variant: "coral", label: "Unanswered" },
  ANSWERED: { variant: "active", label: "Answered" },
  RESOLVED: { variant: "done", label: "Resolved" },
};

export function DoubtHistoryCard({ doubt }: { doubt: DoubtRow }) {
  const chip = STATUS_CHIP[doubt.status];

  return (
    <Card style={{ padding: 16, display: "flex", gap: 12 }}>
      <div className="pr-ic">
        <Icon name="question" size={20} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{doubt.moduleTitle}</div>
          <Chip variant={chip.variant}>{chip.label}</Chip>
        </div>
        <div style={{ fontSize: 13.5, marginTop: 4 }}>{doubt.body}</div>
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
          {doubt.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </div>
        {doubt.answerBody ? (
          <div style={{ marginTop: 10, fontSize: 13.5, borderTop: "1px solid var(--line)", paddingTop: 10 }}>
            <div style={{ color: "var(--muted)", fontSize: 12, marginBottom: 4 }}>
              Answer{doubt.answeredByName ? ` from ${doubt.answeredByName}` : ""}
            </div>
            {doubt.answerBody}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
