/** Hand-rolled CSV — no dependency needed at this scale (a few dozen rows). */
export function csvField(value: string | number): string {
  const s = String(value);
  return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Generic CSV builder — rowsToCsv below is hardcoded to the exam-results
 *  shape, so this is the reusable sibling for anything else (e.g. bulk
 *  student-import credentials/templates in csvImport.ts). */
export function toCsv(headers: string[], rows: (string | number)[][]): string {
  const lines = [headers.map(csvField).join(",")];
  for (const row of rows) lines.push(row.map(csvField).join(","));
  return lines.join("\n");
}

export type CsvRow = {
  name: string;
  email: string;
  record: { scorePercent: number; passed: boolean; verificationId: string } | null;
  attempts: unknown[];
};

export function rowsToCsv(rows: CsvRow[]): string {
  const header = ["Name", "Email", "Score %", "Passed", "Attempts", "Verification ID"];
  const lines = [header.map(csvField).join(",")];
  for (const row of rows) {
    lines.push(
      [
        row.name,
        row.email,
        row.record?.scorePercent ?? "—",
        row.record ? (row.record.passed ? "Yes" : "No") : "—",
        row.attempts.length,
        row.record?.verificationId ?? "—",
      ]
        .map(csvField)
        .join(",")
    );
  }
  return lines.join("\n");
}

export function downloadCsv(filename: string, csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
