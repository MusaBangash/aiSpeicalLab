"use client";

import { useState } from "react";
import { initials } from "@/lib/initials";
import { Icon } from "@/components/shell/Icon";
import type { RosterEntry } from "@/lib/classes";

export function ClassStarSection({ classId, roster }: { classId: string; roster: RosterEntry[] }) {
  const [flashId, setFlashId] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  async function give(studentId: string) {
    setPendingId(studentId);
    const res = await fetch(`/api/classes/${classId}/stars`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    setPendingId(null);
    if (res.ok) {
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
