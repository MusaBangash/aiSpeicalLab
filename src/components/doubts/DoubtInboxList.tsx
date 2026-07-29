"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import type { DoubtRow } from "@/lib/doubts";

const STATUS_CHIP: Record<DoubtRow["status"], { variant: "coral" | "active" | "done"; label: string }> = {
  UNANSWERED: { variant: "coral", label: "Unanswered" },
  ANSWERED: { variant: "active", label: "Answered" },
  RESOLVED: { variant: "done", label: "Resolved" },
};

function DoubtCard({ doubt }: { doubt: DoubtRow }) {
  const router = useRouter();
  const [answerBody, setAnswerBody] = useState(doubt.answerBody ?? "");
  const [pending, setPending] = useState(false);

  async function saveAnswer() {
    setPending(true);
    await fetch(`/api/doubts/${doubt.id}/answer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ answerBody }),
    });
    setPending(false);
    router.refresh();
  }

  async function markResolved() {
    setPending(true);
    await fetch(`/api/doubts/${doubt.id}/resolve`, { method: "POST" });
    setPending(false);
    router.refresh();
  }

  const chip = STATUS_CHIP[doubt.status];

  return (
    <Card style={{ padding: "var(--space-5)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "var(--space-2)" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "var(--text-md)" }}>{doubt.studentName}</div>
          <div style={{ fontSize: "var(--text-sm)", color: "var(--muted)" }}>
            {doubt.moduleTitle} ·{" "}
            {doubt.createdAt.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </div>
        </div>
        <Chip variant={chip.variant}>{chip.label}</Chip>
      </div>

      <div style={{ marginTop: "var(--space-3)", fontSize: "var(--text-md)" }}>{doubt.body}</div>

      {doubt.answeredByName ? (
        <div style={{ marginTop: "var(--space-2)", fontSize: "var(--text-sm)", color: "var(--muted)" }}>
          Last answered by {doubt.answeredByName}
        </div>
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          saveAnswer();
        }}
        className="journal-entry-form"
        style={{ padding: "var(--space-3) 0 0" }}
      >
        <textarea
          value={answerBody}
          onChange={(e) => setAnswerBody(e.target.value)}
          placeholder="Write an answer…"
          rows={2}
          disabled={pending}
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn" disabled={pending}>
          {pending ? "Saving…" : doubt.answerBody ? "Update answer" : "Answer"}
        </button>
        {doubt.answeredAt && doubt.status !== "RESOLVED" ? (
          <button type="button" className="btn ghost" disabled={pending} onClick={markResolved}>
            Mark resolved
          </button>
        ) : null}
      </form>
    </Card>
  );
}

export function DoubtInboxList({ doubts }: { doubts: DoubtRow[] }) {
  if (doubts.length === 0) {
    return <Card style={{ padding: "var(--space-5)" }}>No questions yet.</Card>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {doubts.map((d) => (
        <DoubtCard key={d.id} doubt={d} />
      ))}
    </div>
  );
}
