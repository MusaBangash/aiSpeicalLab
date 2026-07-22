"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AttendanceOverrideRow } from "@/components/attendance/AttendanceOverrideRow";
import { ConfirmSheet } from "@/components/exams/ConfirmSheet";
import type { ClassAttendanceRow } from "@/lib/attendance";

type BulkStatus = "PRESENT" | "ABSENT";

export function ClassAttendanceSection({
  classId,
  date,
  rows,
}: {
  classId: string;
  date: string;
  rows: ClassAttendanceRow[];
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState<BulkStatus | null>(null);
  const [pending, setPending] = useState(false);

  async function runBulk(status: BulkStatus) {
    setPending(true);
    await fetch(`/api/classes/${classId}/attendance/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, status }),
    });
    setPending(false);
    setConfirming(null);
    router.refresh();
  }

  return (
    <div>
      <div className="journal-entry-form" style={{ marginBottom: 16 }}>
        <button className="btn leaf" disabled={pending || rows.length === 0} onClick={() => setConfirming("PRESENT")}>
          Mark all present
        </button>
        <button className="btn coral" disabled={pending || rows.length === 0} onClick={() => setConfirming("ABSENT")}>
          Mark all absent
        </button>
      </div>

      {rows.length === 0 ? (
        <div className="card" style={{ padding: 20 }}>No students enrolled yet.</div>
      ) : (
        <div className="mod-grid">
          {rows.map((r) => (
            <AttendanceOverrideRow key={r.studentId} {...r} />
          ))}
        </div>
      )}

      {confirming ? (
        <ConfirmSheet
          title={confirming === "PRESENT" ? "Mark everyone present?" : "Mark everyone absent?"}
          message={`This overwrites today's attendance for all ${rows.length} enrolled student${rows.length === 1 ? "" : "s"}, including any existing marks (notes are kept).`}
          confirmLabel={confirming === "PRESENT" ? "Mark all present" : "Mark all absent"}
          confirmVariant={confirming === "PRESENT" ? "leaf" : "coral"}
          pending={pending}
          onCancel={() => setConfirming(null)}
          onConfirm={() => runBulk(confirming)}
        />
      ) : null}
    </div>
  );
}
