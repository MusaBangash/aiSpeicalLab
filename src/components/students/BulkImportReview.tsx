"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { toCsv, downloadCsv } from "@/lib/csvExport";
import { resolveClassId } from "@/lib/classes";
import type { ClassSummary } from "@/lib/classes";
import type { StudentCsvRow } from "@/lib/csvImport";

type RowResult = { name: string } & (
  | { ok: true; id: string; email: string; password: string }
  | { ok: false; error: string; status: number }
);

export function BulkImportReview({
  rows: initialRows,
  classes,
  onCancel,
}: {
  rows: StudentCsvRow[];
  classes: ClassSummary[];
  onCancel: () => void;
}) {
  const router = useRouter();
  const [rows, setRows] = useState(initialRows);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<RowResult[] | null>(null);

  function remove(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function commit() {
    if (rows.length === 0) return;
    setPending(true);
    setError(null);

    const students = rows.map((row) => {
      const classId = row.className.trim() ? resolveClassId(classes, row.className) ?? undefined : undefined;
      return {
        name: row.name,
        fatherName: row.fatherName,
        contact: row.contact,
        address: row.address,
        gender: row.gender,
        courseType: row.courseType,
        courseTypeOther: row.courseTypeOther || undefined,
        category: row.category,
        residency: row.residency,
        educationLevel: row.educationLevel,
        educationStatus: row.educationStatus,
        classId,
      };
    });

    const res = await fetch("/api/students/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ students }),
    });
    setPending(false);
    if (!res.ok) {
      setError("Could not import these students. Check the fields and try again.");
      return;
    }
    const body = await res.json();
    setResults(body.results);
  }

  function downloadCredentials() {
    if (!results) return;
    const csvRows = results.map((r) => [r.name, r.ok ? r.email : "", r.ok ? "Created" : `Failed — ${r.error}`, r.ok ? r.password : ""]);
    downloadCsv(`stlab-new-students-${new Date().toISOString().slice(0, 10)}.csv`, toCsv(["Name", "Email", "Status", "Password"], csvRows));
  }

  if (results) {
    const successCount = results.filter((r) => r.ok).length;
    return (
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ marginBottom: 8 }}>Import complete</h3>
        <p style={{ marginBottom: 16, color: "var(--muted)" }}>
          {successCount} of {results.length} students imported successfully. Write these down now — passwords
          will not be shown again.
        </p>
        <div style={{ overflowX: "auto", marginBottom: 16 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1.5px solid var(--line-2)" }}>
                <th style={{ padding: "6px 10px" }}>Name</th>
                <th style={{ padding: "6px 10px" }}>Email</th>
                <th style={{ padding: "6px 10px" }}>Status</th>
                <th style={{ padding: "6px 10px" }}>Password</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                  <td style={{ padding: "6px 10px" }}>{r.name}</td>
                  <td style={{ padding: "6px 10px" }}>{r.ok ? r.email : "—"}</td>
                  <td style={{ padding: "6px 10px", color: r.ok ? "var(--leaf)" : "var(--coral)" }}>
                    {r.ok ? "✓ Created" : `✗ ${r.error}`}
                  </td>
                  <td style={{ padding: "6px 10px", fontFamily: "var(--mono)", background: r.ok ? "var(--gold-mist)" : undefined }}>
                    {r.ok ? r.password : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Button type="button" onClick={downloadCredentials}>
            Download credentials CSV
          </Button>
          <Button type="button" variant="ghost" onClick={() => router.push("/teacher/students")}>
            Done
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
        {rows.length} student{rows.length === 1 ? "" : "s"} ready to import — review before committing.
      </div>
      {rows.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 13 }}>No students to import.</div>
      ) : (
        <div style={{ overflowX: "auto", marginBottom: 12 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ textAlign: "left", borderBottom: "1.5px solid var(--line-2)" }}>
                <th style={{ padding: "6px 10px" }}>Name</th>
                <th style={{ padding: "6px 10px" }}>Father&apos;s name</th>
                <th style={{ padding: "6px 10px" }}>Contact</th>
                <th style={{ padding: "6px 10px" }}>Class</th>
                <th style={{ padding: "6px 10px" }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((row, i) => {
                const classId = row.className.trim() ? resolveClassId(classes, row.className) : null;
                const classUnresolved = row.className.trim() !== "" && classId === null;
                return (
                  <tr key={i} style={{ borderBottom: "1px solid var(--line)" }}>
                    <td style={{ padding: "6px 10px" }}>{row.name}</td>
                    <td style={{ padding: "6px 10px" }}>{row.fatherName}</td>
                    <td style={{ padding: "6px 10px" }}>{row.contact}</td>
                    <td style={{ padding: "6px 10px" }}>
                      {classUnresolved ? (
                        <span style={{ color: "var(--coral)" }}>⚠ &quot;{row.className}&quot; not found — will be unassigned</span>
                      ) : (
                        row.className || "—"
                      )}
                    </td>
                    <td style={{ padding: "6px 10px" }}>
                      <Button type="button" variant="ghost" onClick={() => remove(i)}>
                        Remove
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {error ? <div className="field-error">{error}</div> : null}
      <div className="form-actions" style={{ marginTop: 10 }}>
        <Button type="button" disabled={pending || rows.length === 0} onClick={commit}>
          {pending ? "Importing…" : `Import ${rows.length} student${rows.length === 1 ? "" : "s"}`}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
