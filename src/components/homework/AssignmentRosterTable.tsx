import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { GradeSubmissionForm } from "./GradeSubmissionForm";
import type { AssignmentDetailRow } from "@/lib/homework";

export function AssignmentRosterTable({
  items,
  rows,
  canGrade,
}: {
  items: { id: string; label: string; requiresSubmission: boolean }[];
  rows: AssignmentDetailRow[];
  canGrade: boolean;
}) {
  if (rows.length === 0) {
    return <Card style={{ padding: 20 }}>No students to show for this assignment.</Card>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {rows.map((row) => (
        <Card key={row.studentId} style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5, marginBottom: 4 }}>{row.name}</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)", marginBottom: 10 }}>{row.email}</div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 10 }}>
            {items.map((item) => {
              const rowItem = row.items.find((i) => i.itemId === item.id);
              return (
                <div key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                  <span>{rowItem?.checked ? "✓" : "—"}</span>
                  <span>{item.label}</span>
                  {item.requiresSubmission ? (
                    <span style={{ fontSize: 11, color: "var(--muted)" }}>(needs submission)</span>
                  ) : null}
                  {rowItem?.late ? <Chip variant="coral">Late</Chip> : null}
                </div>
              );
            })}
          </div>

          {row.submission ? (
            <div style={{ fontSize: 13, marginBottom: canGrade ? 8 : 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <span style={{ color: "var(--muted)" }}>
                  Submitted{" "}
                  {row.submission.submittedAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
                {row.submission.late ? <Chip variant="coral">Late</Chip> : null}
                {row.submission.grade !== null ? <Chip variant="star">Grade: {row.submission.grade}</Chip> : null}
              </div>
              {row.submission.body ? <div style={{ marginTop: 6 }}>{row.submission.body}</div> : null}
              {row.submission.linkUrl ? (
                <div style={{ marginTop: 4 }}>
                  <a href={row.submission.linkUrl} target="_blank" rel="noreferrer">
                    {row.submission.linkUrl}
                  </a>
                </div>
              ) : null}
              {row.submission.attachmentPath ? (
                <div style={{ marginTop: 4 }}>
                  <a href={`/api/homework/submissions/${row.submission.id}/attachment`} target="_blank" rel="noreferrer">
                    View attachment
                  </a>
                </div>
              ) : null}
              {row.submission.feedback ? (
                <div style={{ marginTop: 6, fontStyle: "italic", color: "var(--muted)" }}>Feedback: {row.submission.feedback}</div>
              ) : null}
            </div>
          ) : (
            <div style={{ fontSize: 13, color: "var(--muted)" }}>No submission yet.</div>
          )}

          {canGrade && row.submission ? (
            <GradeSubmissionForm
              submissionId={row.submission.id}
              currentStatus={row.submission.status}
              currentGrade={row.submission.grade}
              currentFeedback={row.submission.feedback}
            />
          ) : null}
        </Card>
      ))}
    </div>
  );
}
