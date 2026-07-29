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
    <Card style={{ padding: "var(--space-5)", display: "flex", gap: "var(--space-3)" }}>
      <div className="pr-ic">
        <Icon name="question" size={20} />
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)" }}>
          <div style={{ fontWeight: 700, fontSize: "var(--text-md)" }}>{doubt.moduleTitle}</div>
          <Chip variant={chip.variant}>{chip.label}</Chip>
        </div>
        <div style={{ fontSize: "var(--text-md)", marginTop: "var(--space-1)" }}>{doubt.body}</div>
        <div style={{ fontSize: "var(--text-sm)", color: "var(--muted)", marginTop: "var(--space-2)" }}>
          {doubt.createdAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
        </div>
        {doubt.answerBody ? (
          <div
            style={{
              marginTop: "var(--space-3)",
              fontSize: "var(--text-md)",
              borderTop: "1px solid var(--line)",
              paddingTop: "var(--space-3)",
            }}
          >
            <div style={{ color: "var(--muted)", fontSize: "var(--text-sm)", marginBottom: "var(--space-1)" }}>
              Answer{doubt.answeredByName ? ` from ${doubt.answeredByName}` : ""}
            </div>
            {doubt.answerBody}
          </div>
        ) : null}
      </div>
    </Card>
  );
}
