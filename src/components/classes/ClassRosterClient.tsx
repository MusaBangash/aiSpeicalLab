"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card } from "@/components/ui/Card";
import type { RosterEntry, EnrollableStudent } from "@/lib/classes";

export function ClassRosterClient({
  classId,
  roster,
  enrollable,
}: {
  classId: string;
  roster: RosterEntry[];
  enrollable: EnrollableStudent[];
}) {
  const router = useRouter();
  const [selectedStudentId, setSelectedStudentId] = useState(enrollable[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  async function enroll() {
    if (!selectedStudentId) return;
    setBusy(true);
    await fetch(`/api/classes/${classId}/enroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: selectedStudentId }),
    });
    setBusy(false);
    router.refresh();
  }

  async function remove(studentId: string) {
    setBusy(true);
    await fetch(`/api/classes/${classId}/unenroll`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div>
      <div className="journal-entry-form" style={{ marginBottom: 16 }}>
        <select value={selectedStudentId} onChange={(e) => setSelectedStudentId(e.target.value)} disabled={busy}>
          {enrollable.length === 0 ? (
            <option value="">No other students available</option>
          ) : (
            enrollable.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.currentClassName ? ` (currently in ${s.currentClassName})` : ""}
              </option>
            ))
          )}
        </select>
        <button className="btn" onClick={enroll} disabled={busy || !selectedStudentId}>
          {busy ? "Working…" : "Enroll student"}
        </button>
      </div>

      {roster.length === 0 ? (
        <Card style={{ padding: 20 }}>No students enrolled yet.</Card>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {roster.map((r) => (
            <Card
              key={r.enrollmentId}
              style={{ padding: "14px 20px", display: "flex", alignItems: "center", gap: 16 }}
            >
              <div style={{ flex: 1 }}>
                <Link href={`/teacher/students/${r.studentId}`} style={{ fontWeight: 700, fontSize: 14.5 }}>
                  {r.name}
                </Link>
                <div style={{ fontSize: 12.5, color: "var(--muted)" }}>{r.email}</div>
              </div>
              <button className="btn ghost" disabled={busy} onClick={() => remove(r.studentId)}>
                Remove
              </button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
