"use client";

import { useMemo, useState } from "react";
import { Chip } from "@/components/ui/Chip";
import { Button } from "@/components/ui/Button";
import { rowsToCsv, downloadCsv, slugify } from "@/lib/csvExport";

type Attempt = {
  id: string;
  attemptNumber: number;
  status: "IN_PROGRESS" | "SUBMITTED" | "AUTO_SUBMITTED";
  startedAt: Date;
  scorePercent: number | null;
  pcHostname: string | null;
};

type StudentRow = {
  studentId: string;
  name: string;
  email: string;
  record: { scorePercent: number; passed: boolean; sealedAt: Date | null; verificationId: string } | null;
  attempts: Attempt[];
};

export function ResultsTable({ rows, examTitle }: { rows: StudentRow[]; examTitle: string }) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  const visibleRows = useMemo(
    () => rows.filter((r) => r.name.toLowerCase().includes(searchQuery.trim().toLowerCase())),
    [rows, searchQuery]
  );

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function handleDownloadCsv() {
    downloadCsv(`${slugify(examTitle)}-results.csv`, rowsToCsv(rows));
  }

  function handleDownloadPdf() {
    setExpanded(new Set(rows.map((r) => r.studentId)));
    requestAnimationFrame(() => window.print());
  }

  return (
    <div>
      <div className="list-toolbar no-print">
        <input
          placeholder="Search by name…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: "9px 12px",
            border: "1.5px solid var(--line-2)",
            borderRadius: 10,
            fontFamily: "var(--sans)",
            fontSize: 13,
            flex: 1,
            maxWidth: 280,
          }}
        />
        <Button type="button" variant="ghost" onClick={handleDownloadCsv}>
          Download CSV
        </Button>
        <Button type="button" variant="ghost" onClick={handleDownloadPdf}>
          Download PDF report
        </Button>
      </div>

      {visibleRows.length === 0 ? (
        <div className="card" style={{ padding: 24 }}>
          No students match "{searchQuery}".
        </div>
      ) : (
        visibleRows.map((row) => (
          <div key={row.studentId} className="card results-row" style={{ marginBottom: 10, overflow: "hidden" }}>
            <div className="results-row-head no-print" onClick={() => toggle(row.studentId)}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{row.name}</div>
                <div style={{ fontSize: 12, color: "var(--muted)" }}>{row.email}</div>
              </div>
              {row.record ? (
                <>
                  <span style={{ fontFamily: "var(--mono)", fontWeight: 700 }}>{row.record.scorePercent}%</span>
                  <Chip variant={row.record.passed ? "done" : "coral"}>{row.record.passed ? "Passed" : "Not passed"}</Chip>
                  {row.record.sealedAt ? <Chip variant="star">Sealed</Chip> : null}
                  <code className="hide-mobile" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--muted)" }}>
                    {row.record.verificationId}
                  </code>
                </>
              ) : (
                <Chip variant="locked">No attempts yet</Chip>
              )}
            </div>
            <div className="print-only" style={{ padding: "16px 20px" }}>
              <b>{row.name}</b> ({row.email}) —{" "}
              {row.record ? `${row.record.scorePercent}% · ${row.record.passed ? "Passed" : "Not passed"}` : "No attempts yet"}
            </div>
            {expanded.has(row.studentId) && row.attempts.length > 0 ? (
              <div style={{ borderTop: "1px solid var(--line)", padding: "10px 20px", overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: 12.5, borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ color: "var(--muted)", textAlign: "left" }}>
                      <th style={{ padding: "8px 6px" }}>#</th>
                      <th style={{ padding: "8px 6px" }}>Date</th>
                      <th style={{ padding: "8px 6px" }}>Score</th>
                      <th style={{ padding: "8px 6px" }}>Status</th>
                      <th style={{ padding: "8px 6px" }}>PC</th>
                    </tr>
                  </thead>
                  <tbody>
                    {row.attempts.map((a) => (
                      <tr key={a.id} style={{ borderTop: "1px solid var(--gold-mist)" }}>
                        <td style={{ padding: "8px 6px" }}>{a.attemptNumber}</td>
                        <td style={{ padding: "8px 6px", fontFamily: "var(--mono)" }}>
                          {new Date(a.startedAt).toLocaleDateString("en-GB")}
                        </td>
                        <td style={{ padding: "8px 6px" }}>{a.scorePercent ?? "—"}%</td>
                        <td style={{ padding: "8px 6px" }}>{a.status}</td>
                        <td style={{ padding: "8px 6px" }}>{a.pcHostname ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
