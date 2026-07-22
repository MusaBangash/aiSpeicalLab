"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

function minutesToTimeValue(m: number): string {
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

export function ClassScheduleForm({
  classId,
  scheduledStartMinutes,
}: {
  classId: string;
  scheduledStartMinutes: number | null;
}) {
  const router = useRouter();
  const [time, setTime] = useState(scheduledStartMinutes != null ? minutesToTimeValue(scheduledStartMinutes) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(scheduledStartTime: string | null) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/classes/${classId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ scheduledStartTime }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not update schedule");
      return;
    }
    router.refresh();
  }

  return (
    <div className="journal-entry-form" style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 13, color: "var(--muted)" }}>Scheduled start (weekdays)</label>
      <input type="time" value={time} disabled={saving} onChange={(e) => setTime(e.target.value)} />
      <button className="btn" disabled={saving || !time} onClick={() => save(time)}>
        {saving ? "Saving…" : "Save"}
      </button>
      {scheduledStartMinutes != null ? (
        <button
          className="btn ghost"
          disabled={saving}
          onClick={() => {
            setTime("");
            save(null);
          }}
        >
          Clear
        </button>
      ) : null}
      {error ? <div className="field-error">{error}</div> : null}
    </div>
  );
}
