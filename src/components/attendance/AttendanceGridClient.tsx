"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AttendanceOverrideRow, type Status } from "./AttendanceOverrideRow";
import { ConfirmSheet } from "@/components/exams/ConfirmSheet";

export type AttendanceGridRow = {
  studentId: string;
  studentName: string;
  date: string;
  initialStatus: Status | null;
  initialNote: string | null;
  initialSource: "AUTO" | "MANUAL" | null;
  initialCheckedInAt: string | null;
  classId: string | null;
  studentClassName: string | null;
};

type StatusFilter = "ALL" | Status | "UNMARKED";
type BulkStatus = "PRESENT" | "ABSENT";

export function AttendanceGridClient({ rows }: { rows: AttendanceGridRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [classFilter, setClassFilter] = useState("all"); // "all" or a classId
  const [confirming, setConfirming] = useState<BulkStatus | null>(null);
  const [pending, setPending] = useState(false);

  // Classes actually present in today's roster, not a separate fetch —
  // same "derive from what's already on screen" approach as the
  // students page's class filter.
  const classes = useMemo(() => {
    const byId = new Map<string, string>();
    for (const r of rows) {
      if (r.classId && r.studentClassName) byId.set(r.classId, r.studentClassName);
    }
    return [...byId.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const visible = useMemo(() => {
    return rows.filter((r) => {
      const matchesSearch = r.studentName.toLowerCase().includes(search.trim().toLowerCase());
      const effectiveStatus = r.initialStatus ?? "UNMARKED";
      const matchesStatus = statusFilter === "ALL" || effectiveStatus === statusFilter;
      const matchesClass = classFilter === "all" || r.classId === classFilter;
      return matchesSearch && matchesStatus && matchesClass;
    });
  }, [rows, search, statusFilter, classFilter]);

  const selectedClassName = classes.find(([id]) => id === classFilter)?.[1] ?? null;
  const date = rows[0]?.date;

  // Always targets every student enrolled in the selected class for
  // this date (same server-authoritative scope as the class page's own
  // bulk action) — independent of the search box/status filter above,
  // so a bulk mark never silently excludes someone just because they
  // didn't match a leftover search term.
  async function runBulk(status: BulkStatus) {
    if (!selectedClassName || !date) return;
    setPending(true);
    await fetch(`/api/classes/${classFilter}/attendance/bulk`, {
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
      <div className="list-toolbar">
        <input placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          <option value="all">All classes</option>
          {classes.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
          <option value="ALL">All statuses</option>
          <option value="PRESENT">Present</option>
          <option value="LATE">Late</option>
          <option value="ABSENT">Absent</option>
          <option value="EXCUSED">Excused</option>
          <option value="UNMARKED">Not marked</option>
        </select>
      </div>

      {selectedClassName ? (
        <div className="journal-entry-form" style={{ marginBottom: 16 }}>
          <button className="btn leaf" disabled={pending} onClick={() => setConfirming("PRESENT")}>
            Mark all present in {selectedClassName}
          </button>
          <button className="btn coral" disabled={pending} onClick={() => setConfirming("ABSENT")}>
            Mark all absent in {selectedClassName}
          </button>
        </div>
      ) : null}

      {visible.length === 0 ? (
        <div className="card" style={{ padding: 24 }}>
          No students match this filter.
        </div>
      ) : (
        <div className="mod-grid">
          {visible.map((r) => (
            <AttendanceOverrideRow key={r.studentId} {...r} />
          ))}
        </div>
      )}

      {confirming ? (
        <ConfirmSheet
          title={confirming === "PRESENT" ? "Mark everyone present?" : "Mark everyone absent?"}
          message={`This overwrites today's attendance for every student enrolled in ${selectedClassName}, including any existing marks (notes are kept).`}
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
