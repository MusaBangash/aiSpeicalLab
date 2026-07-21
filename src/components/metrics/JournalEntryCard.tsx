"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/Card";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/shell/Icon";
import { ConfirmSheet } from "@/components/exams/ConfirmSheet";
import type { JournalEntryStatus } from "@/lib/metrics";

const CATEGORY_LABELS: Record<string, string> = {
  PARTICIPATION: "Participation",
  BEHAVIOUR: "Behaviour",
  EXTRA_ACTIVITY: "Extra activity",
};

export type JournalEntryCardData = {
  id: string;
  category: "PARTICIPATION" | "BEHAVIOUR" | "EXTRA_ACTIVITY";
  rating: number;
  note: string | null;
  createdAt: string;
  teacherName: string;
  status: JournalEntryStatus;
  correctedFromRating: number | null;
  canManage: boolean;
};

export function JournalEntryCard({ entry }: { entry: JournalEntryCardData }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(entry.rating);
  const [note, setNote] = useState(entry.note ?? "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [pending, setPending] = useState(false);

  const inactive = entry.status !== "ACTIVE";
  const showControls = entry.canManage && entry.status === "ACTIVE";

  async function saveEdit() {
    setPending(true);
    const res = await fetch(`/api/metrics/entries/${entry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, note: note || undefined }),
    });
    setPending(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    }
  }

  async function confirmDelete() {
    setPending(true);
    await fetch(`/api/metrics/entries/${entry.id}`, { method: "DELETE" });
    setPending(false);
    setConfirmingDelete(false);
    router.refresh();
  }

  return (
    <Card className={inactive ? "pr-muted" : undefined}>
      <div className="pr-ic">
        <Icon name="star" size={20} />
      </div>
      <div className="pr-body">
        {editing ? (
          <div className="journal-entry-form" style={{ padding: 0 }}>
            <select value={rating} onChange={(e) => setRating(Number(e.target.value))} disabled={pending}>
              {[1, 2, 3, 4, 5].map((r) => (
                <option key={r} value={r}>
                  {r} / 5
                </option>
              ))}
            </select>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Note (optional)"
              disabled={pending}
              style={{ flex: 1 }}
            />
            <button className="btn" disabled={pending} onClick={saveEdit}>
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              className="btn ghost"
              disabled={pending}
              onClick={() => {
                setEditing(false);
                setRating(entry.rating);
                setNote(entry.note ?? "");
              }}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div className="pr-top">
              <div className="pr-t">
                {CATEGORY_LABELS[entry.category]}
                {entry.note ? ` — ${entry.note}` : ""}
              </div>
              <div className="pr-pct">{entry.rating}/5</div>
            </div>
            <div className={`pr-bar${entry.category === "BEHAVIOUR" ? " leaf" : ""}`}>
              <i style={{ width: `${(entry.rating / 5) * 100}%` }} />
            </div>
            <div
              style={{
                fontSize: 12,
                color: "var(--muted)",
                marginTop: 6,
                display: "flex",
                gap: 8,
                alignItems: "center",
                flexWrap: "wrap",
              }}
            >
              <span>
                {entry.teacherName} ·{" "}
                {new Date(entry.createdAt).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                })}
              </span>
              {entry.correctedFromRating !== null ? (
                <Chip variant="star">Corrected from {entry.correctedFromRating}/5</Chip>
              ) : null}
              {entry.status === "RETRACTED" ? <Chip variant="locked">Retracted</Chip> : null}
              {entry.status === "SUPERSEDED" ? <Chip variant="locked">Edited</Chip> : null}
            </div>
            {showControls ? (
              <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                <button className="btn ghost" onClick={() => setEditing(true)}>
                  <Icon name="pencil" size={14} /> Edit
                </button>
                <button className="btn ghost" onClick={() => setConfirmingDelete(true)}>
                  Delete
                </button>
              </div>
            ) : null}
          </>
        )}
      </div>

      {confirmingDelete ? (
        <ConfirmSheet
          title="Delete this entry?"
          message="This entry will be hidden from the active history. It is never removed and stays fully recoverable for audit."
          confirmLabel="Delete"
          confirmVariant="coral"
          pending={pending}
          onCancel={() => setConfirmingDelete(false)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </Card>
  );
}
