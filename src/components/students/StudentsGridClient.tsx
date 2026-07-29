"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { initials } from "@/lib/initials";
import { Chip } from "@/components/ui/Chip";
import { RISK_THRESHOLD_PERCENT, type StudentSummary } from "@/lib/metrics";

type SortBy = "name" | "examLow" | "attendanceLow";

export function StudentsGridClient({ students }: { students: StudentSummary[] }) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [onlyAtRisk, setOnlyAtRisk] = useState(false);

  const visible = useMemo(() => {
    let rows = students.filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()));
    if (onlyAtRisk) {
      rows = rows.filter((s) => s.avgScorePercent < RISK_THRESHOLD_PERCENT || s.attendancePercent < RISK_THRESHOLD_PERCENT);
    }
    const sorted = [...rows];
    if (sortBy === "examLow") sorted.sort((a, b) => a.avgScorePercent - b.avgScorePercent);
    else if (sortBy === "attendanceLow") sorted.sort((a, b) => a.attendancePercent - b.attendancePercent);
    else sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [students, search, sortBy, onlyAtRisk]);

  return (
    <div>
      <div className="list-toolbar">
        <input placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}>
          <option value="name">Sort: name</option>
          <option value="examLow">Sort: exam avg (lowest first)</option>
          <option value="attendanceLow">Sort: attendance (lowest first)</option>
        </select>
        <label className="risk-toggle">
          <input type="checkbox" checked={onlyAtRisk} onChange={(e) => setOnlyAtRisk(e.target.checked)} />
          At risk only (&lt;{RISK_THRESHOLD_PERCENT}%)
        </label>
      </div>

      {visible.length === 0 ? (
        <div className="card" style={{ padding: 24 }}>
          No students match this filter.
        </div>
      ) : (
        <div className="mod-grid">
          {visible.map((s) => {
            const atRisk = s.avgScorePercent < RISK_THRESHOLD_PERCENT || s.attendancePercent < RISK_THRESHOLD_PERCENT;
            return (
              <Link key={s.id} href={`/teacher/students/${s.id}`} className="card mod-card student-card">
                <div className="mod-head">
                  <div className="me-avatar">{initials(s.name)}</div>
                  {atRisk ? <Chip variant="coral">At risk</Chip> : null}
                </div>
                <div className="mod-title">{s.name}</div>
                <div className="mod-desc">{s.email}</div>
                <div className="mod-bar">
                  <i style={{ width: `${s.attendancePercent}%` }} />
                </div>
                <div className="mod-meta">
                  <span>{s.avgScorePercent}% exam avg</span>
                  <span>{s.attendancePercent}% attendance</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
