"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Category = "PARTICIPATION" | "BEHAVIOUR" | "EXTRA_ACTIVITY";

const CATEGORY_LABELS: Record<Category, string> = {
  PARTICIPATION: "Participation",
  BEHAVIOUR: "Behaviour",
  EXTRA_ACTIVITY: "Extra activity",
};

export function JournalEntryForm({ studentId }: { studentId: string }) {
  const router = useRouter();
  const [category, setCategory] = useState<Category>("PARTICIPATION");
  const [rating, setRating] = useState(5);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/metrics/entries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, category, rating, note: note || undefined }),
    });
    setSaving(false);
    if (res.ok) {
      setNote("");
      setRating(5);
      // This form's data lives in a separately-rendered server list (the entry
      // history below), not in this component's own state — refresh to pick it up.
      router.refresh();
    }
  }

  return (
    <form onSubmit={onSubmit} className="journal-entry-form">
      <select value={category} onChange={(e) => setCategory(e.target.value as Category)} disabled={saving}>
        {(Object.keys(CATEGORY_LABELS) as Category[]).map((c) => (
          <option key={c} value={c}>
            {CATEGORY_LABELS[c]}
          </option>
        ))}
      </select>
      <select value={rating} onChange={(e) => setRating(Number(e.target.value))} disabled={saving}>
        {[1, 2, 3, 4, 5].map((r) => (
          <option key={r} value={r}>
            {r} / 5
          </option>
        ))}
      </select>
      <input
        placeholder="Note (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        disabled={saving}
        style={{ flex: 1 }}
      />
      <button type="submit" className="btn" disabled={saving}>
        {saving ? "Saving…" : "Add entry"}
      </button>
    </form>
  );
}
