"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Icon } from "@/components/shell/Icon";
import type { StudentAssignmentView } from "@/lib/homework";

export function AssignmentCard({ assignment }: { assignment: StudentAssignmentView }) {
  const router = useRouter();
  const [checkedState, setCheckedState] = useState<Record<string, boolean>>(
    Object.fromEntries(assignment.items.map((i) => [i.id, i.checked]))
  );
  const [body, setBody] = useState(assignment.submission?.body ?? "");
  const [linkUrl, setLinkUrl] = useState(assignment.submission?.linkUrl ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allDone =
    assignment.items.every((i) => !i.requiresSubmission || assignment.submission) &&
    assignment.items.every((i) => i.requiresSubmission || checkedState[i.id]);

  async function toggleItem(itemId: string, checked: boolean) {
    setCheckedState((prev) => ({ ...prev, [itemId]: checked }));
    await fetch(`/api/homework/items/${itemId}/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ checked }),
    });
    router.refresh();
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const res = await fetch(`/api/homework/${assignment.id}/submit`, { method: "POST", body: formData });
    setPending(false);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Could not submit");
      return;
    }
    router.refresh();
  }

  const needsSubmission = assignment.items.some((i) => i.requiresSubmission);

  return (
    <Card style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <div className={"ex-ic " + (allDone ? "done" : "todo")}>
          <Icon name={allDone ? "check" : "clock"} size={20} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{assignment.title}</div>
          <div style={{ fontSize: 12.5, color: "var(--muted)" }}>
            {assignment.dueDate
              ? `Due ${assignment.dueDate.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}`
              : "No due date"}
            {assignment.submission?.late ? " · Late" : ""}
          </div>
        </div>
      </div>

      {assignment.description ? <div style={{ fontSize: 13.5 }}>{assignment.description}</div> : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {assignment.items.map((item) =>
          item.requiresSubmission ? (
            <div key={item.id} style={{ fontSize: 13.5, color: "var(--muted)" }}>
              {item.label} (submit below)
            </div>
          ) : (
            <label key={item.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13.5 }}>
              <input type="checkbox" checked={checkedState[item.id] ?? false} onChange={(e) => toggleItem(item.id, e.target.checked)} />
              {item.label}
              {item.checkedAt && assignment.dueDate && item.checkedAt.getTime() > assignment.dueDate.getTime() ? (
                <span style={{ fontSize: 11, color: "var(--coral)" }}>Late</span>
              ) : null}
            </label>
          )
        )}
      </div>

      {needsSubmission ? (
        <form onSubmit={onSubmit} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <textarea name="body" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Write your response…" rows={3} disabled={pending} />
          <input
            name="linkUrl"
            value={linkUrl}
            onChange={(e) => setLinkUrl(e.target.value)}
            placeholder="Link (optional)"
            disabled={pending}
          />
          <input type="file" name="file" disabled={pending} />
          {error ? <div className="field-error">{error}</div> : null}
          <button type="submit" className="btn" disabled={pending} style={{ alignSelf: "flex-start" }}>
            {pending ? "Submitting…" : assignment.submission ? "Update submission" : "Submit"}
          </button>
        </form>
      ) : null}

      {assignment.submission?.grade !== undefined && assignment.submission?.grade !== null ? (
        <div style={{ fontSize: 13, color: "var(--muted)" }}>
          Grade: {assignment.submission.grade}
          {assignment.submission.feedback ? ` — ${assignment.submission.feedback}` : ""}
        </div>
      ) : null}
    </Card>
  );
}
