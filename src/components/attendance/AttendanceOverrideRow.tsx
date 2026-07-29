"use client";

import { useState, type CSSProperties } from "react";
import { initials } from "@/lib/initials";

export type Status = "PRESENT" | "ABSENT" | "EXCUSED" | "LATE";
type Source = "AUTO" | "MANUAL";

const STATUS_DOT_STYLE: Record<Status | "UNMARKED", CSSProperties> = {
  PRESENT: { background: "var(--gold)" },
  LATE: { background: "var(--gold-soft)", border: "1.5px solid var(--gold)" },
  ABSENT: { background: "var(--coral-soft)" },
  EXCUSED: { background: "var(--leaf-soft)" },
  UNMARKED: { background: "var(--line-2)" },
};

export function AttendanceOverrideRow({
  studentId,
  studentName,
  date,
  initialStatus,
  initialNote,
  initialSource,
  initialCheckedInAt,
  studentClassName,
}: {
  studentId: string;
  studentName: string;
  date: string;
  initialStatus: Status | null;
  initialNote: string | null;
  initialSource: Source | null;
  initialCheckedInAt: string | null;
  studentClassName?: string | null;
}) {
  const [status, setStatus] = useState<Status | "UNMARKED">(initialStatus ?? "UNMARKED");
  const [note, setNote] = useState(initialNote ?? "");
  const [source, setSource] = useState(initialSource);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save(nextStatus: Status) {
    setStatus(nextStatus);
    setSaving(true);
    setSaved(false);
    const res = await fetch("/api/attendance/override", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, date, status: nextStatus, note: note || undefined }),
    });
    setSaving(false);
    if (res.ok) {
      setSource("MANUAL");
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    }
  }

  return (
    <div className="card mod-card att-day-card">
      <div className="mod-head">
        <div className="me-avatar">{initials(studentName)}</div>
        <span className="status-dot" style={STATUS_DOT_STYLE[status]} />
      </div>
      <div className="mod-title">{studentName}</div>
      {studentClassName ? <div className="mod-desc">{studentClassName}</div> : null}
      <div className="att-day-card-controls">
        <select value={status} onChange={(e) => save(e.target.value as Status)} disabled={saving}>
          <option value="UNMARKED" disabled>
            Not marked
          </option>
          <option value="PRESENT">Present</option>
          <option value="LATE">Late</option>
          <option value="ABSENT">Absent</option>
          <option value="EXCUSED">Excused</option>
        </select>
        <input
          placeholder="Note (optional)"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onBlur={() => status !== "UNMARKED" && save(status)}
          style={{ flex: 1 }}
        />
      </div>
      <div className="mod-meta">
        <span>
          {source === "AUTO" && initialCheckedInAt
            ? `auto · ${new Date(initialCheckedInAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`
            : ""}
        </span>
        <span style={{ color: "var(--leaf-mid)", fontWeight: 600, opacity: saved ? 1 : 0 }}>Saved</span>
      </div>
    </div>
  );
}
