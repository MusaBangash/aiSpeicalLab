"use client";

import { useMemo, useState } from "react";
import { AttendanceOverrideRow, type Status } from "./AttendanceOverrideRow";

export type AttendanceGridRow = {
  studentId: string;
  studentName: string;
  date: string;
  initialStatus: Status | null;
  initialNote: string | null;
  initialSource: "AUTO" | "MANUAL" | null;
  initialCheckedInAt: string | null;
};

type StatusFilter = "ALL" | Status | "UNMARKED";

export function AttendanceGridClient({ rows }: { rows: AttendanceGridRow[] }) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");

  const visible = useMemo(() => {
    return rows.filter((r) => {
      const matchesSearch = r.studentName.toLowerCase().includes(search.trim().toLowerCase());
      const effectiveStatus = r.initialStatus ?? "UNMARKED";
      const matchesStatus = statusFilter === "ALL" || effectiveStatus === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [rows, search, statusFilter]);

  return (
    <div>
      <div className="list-toolbar">
        <input placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}>
          <option value="ALL">All statuses</option>
          <option value="PRESENT">Present</option>
          <option value="LATE">Late</option>
          <option value="ABSENT">Absent</option>
          <option value="EXCUSED">Excused</option>
          <option value="UNMARKED">Not marked</option>
        </select>
      </div>

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
    </div>
  );
}
