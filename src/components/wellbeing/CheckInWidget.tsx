"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import type { Mood } from "@prisma/client";

const MOOD_OPTIONS: { value: Mood; emoji: string; label: string }[] = [
  { value: "GREAT", emoji: "😄", label: "Great" },
  { value: "GOOD", emoji: "🙂", label: "Good" },
  { value: "OKAY", emoji: "😐", label: "Okay" },
  { value: "LOW", emoji: "🙁", label: "Low" },
  { value: "STRUGGLING", emoji: "😔", label: "Struggling" },
];

export function CheckInWidget({
  initialMood,
  initialNote,
}: {
  initialMood: Mood | null;
  initialNote: string | null;
}) {
  const [mood, setMood] = useState<Mood | null>(initialMood);
  const [note, setNote] = useState(initialNote ?? "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function submit(nextMood: Mood) {
    setMood(nextMood);
    setSaving(true);
    const res = await fetch("/api/wellbeing/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mood: nextMood, note: note || undefined }),
    });
    setSaving(false);
    if (res.ok) {
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }

  return (
    <Card className="feed-card" style={{ marginBottom: "var(--space-6)" }}>
      <div className="feed-title">How are you feeling today?</div>
      <div style={{ display: "flex", gap: "var(--space-2)", marginTop: "var(--space-2)", flexWrap: "wrap" }}>
        {MOOD_OPTIONS.map((m) => (
          <button
            key={m.value}
            className="btn ghost"
            style={mood === m.value ? { borderColor: "var(--gold)" } : undefined}
            disabled={saving}
            onClick={() => submit(m.value)}
          >
            {m.emoji} {m.label}
          </button>
        ))}
      </div>
      <textarea
        placeholder="Anything you want to add? (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => mood && submit(mood)}
        style={{ width: "100%", marginTop: "var(--space-2)" }}
      />
      {saved ? <div style={{ color: "var(--leaf-mid)", fontWeight: 600, marginTop: "var(--space-2)" }}>Saved</div> : null}
    </Card>
  );
}
