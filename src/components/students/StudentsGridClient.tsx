"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { initials } from "@/lib/initials";
import { Chip } from "@/components/ui/Chip";
import { RISK_THRESHOLD_PERCENT, type StudentSummary } from "@/lib/metrics";

type SortBy = "name" | "examLow" | "attendanceLow";

export function StudentsGridClient({ students }: { students: StudentSummary[] }) {
  const searchParams = useSearchParams();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [classFilter, setClassFilter] = useState("all");
  // Lets a link like /teacher/students?risk=1 (the console's "View all
  // at-risk" link) land with the filter already applied, not one more
  // click away.
  const [onlyAtRisk, setOnlyAtRisk] = useState(() => searchParams.get("risk") === "1");

  // Derived from the roster actually on screen, not a separate class
  // fetch — only classes with at least one student show up as options,
  // and it never drifts out of sync with what's actually filterable.
  const classNames = useMemo(
    () => [...new Set(students.map((s) => s.className).filter((c): c is string => c !== null))].sort(),
    [students]
  );

  const visible = useMemo(() => {
    let rows = students.filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()));
    if (onlyAtRisk) {
      rows = rows.filter((s) => s.avgScorePercent < RISK_THRESHOLD_PERCENT || s.attendancePercent < RISK_THRESHOLD_PERCENT);
    }
    if (classFilter !== "all") {
      rows = rows.filter((s) => s.className === classFilter);
    }
    const sorted = [...rows];
    if (sortBy === "examLow") sorted.sort((a, b) => a.avgScorePercent - b.avgScorePercent);
    else if (sortBy === "attendanceLow") sorted.sort((a, b) => a.attendancePercent - b.attendancePercent);
    else sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [students, search, sortBy, onlyAtRisk, classFilter]);

  return (
    <div>
      <div className="list-toolbar">
        <input placeholder="Search by name…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <select value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          <option value="all">All classes</option>
          {classNames.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
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
                <div className="mod-desc">
                  {s.className ?? "No class assigned"} · {s.email}
                </div>
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
