"use client";

import { useState } from "react";
import { initials } from "@/lib/initials";
import { Icon } from "@/components/shell/Icon";
import type { RosterEntry } from "@/lib/classes";

export function ClassStarSection({ classId, roster }: { classId: string; roster: RosterEntry[] }) {
  const [flashId, setFlashId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});

  async function give(studentId: string) {
    setPendingId(studentId);
    const res = await fetch(`/api/classes/${classId}/stars`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId, reason: reasons[studentId] || undefined }),
    });
    setPendingId(null);
    if (res.ok) {
      setReasons((prev) => ({ ...prev, [studentId]: "" }));
      setFlashId(studentId);
      setTimeout(() => setFlashId((id) => (id === studentId ? null : id)), 1200);
    }
  }

  if (roster.length === 0) {
    return <div className="card" style={{ padding: 20 }}>No students enrolled yet.</div>;
  }

  return (
    <div className="mod-grid">
      {roster.map((r) => (
        <div key={r.studentId} className="card mod-card att-day-card">
          <div className="mod-head">
            <div className="me-avatar">{initials(r.name)}</div>
          </div>
          <div className="mod-title">{r.name}</div>
          <input
            placeholder="Reason (optional)"
            value={reasons[r.studentId] ?? ""}
            onChange={(e) => setReasons((prev) => ({ ...prev, [r.studentId]: e.target.value }))}
            style={{
              marginBottom: 10,
              width: "100%",
              padding: "8px 10px",
              border: "1.5px solid var(--line-2)",
              borderRadius: 9,
              fontFamily: "var(--sans)",
              fontSize: 13,
            }}
          />
          <button className="btn" disabled={pendingId === r.studentId} onClick={() => give(r.studentId)}>
            <Icon name="star" size={16} /> Give a star
          </button>
          <div className="mod-meta">
            <span />
            <span style={{ color: "var(--gold)", fontWeight: 600, opacity: flashId === r.studentId ? 1 : 0 }}>
              +1 star
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
