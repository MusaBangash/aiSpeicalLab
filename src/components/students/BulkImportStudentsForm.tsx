"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { parseStudentCsv, studentCsvTemplate } from "@/lib/csvImport";
import { downloadCsv } from "@/lib/csvExport";
import { BulkImportReview } from "./BulkImportReview";
import type { ClassSummary } from "@/lib/classes";

export function BulkImportStudentsForm({ classes }: { classes: ClassSummary[] }) {
  const [result, setResult] = useState<ReturnType<typeof parseStudentCsv> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(null);
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const parsed = parseStudentCsv(text);
    if (parsed.rows.length === 0) {
      setError(parsed.warnings[0] ?? "No students found in this file.");
      return;
    }
    setResult(parsed);
    e.target.value = ""; // allow re-selecting the same file later
  }

  if (result) {
    return <BulkImportReview rows={result.rows} classes={classes} onCancel={() => setResult(null)} />;
  }

  return (
    <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="field">
        <label htmlFor="bulk-csv">Upload a CSV of students</label>
        <input id="bulk-csv" type="file" accept=".csv,text/csv" onChange={onFileChange} />
      </div>
      {error ? <div className="field-error">{error}</div> : null}
      <div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => downloadCsv("stlab-student-import-template.csv", studentCsvTemplate())}
        >
          Download CSV template
        </Button>
      </div>
    </div>
  );
}
