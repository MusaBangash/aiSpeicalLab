/**
 * Bulk student-import CSV parsing — shared by the client upload+review form
 * and (if ever needed) a server route, so no Node-only or browser-only
 * imports, same constraint questionParser.ts follows for the same reason.
 *
 * parseCsv is a hand-rolled, quoted-field-aware parser (RFC4180 semantics:
 * a comma/newline inside a quoted field is data, not a delimiter; "" inside
 * a quoted field is one literal quote) — a naive .split(",") would break on
 * any address containing a comma. Mirrors csvExport.ts's csvField writer in
 * the opposite direction, same "no dependency needed at this scale" style.
 */
import { toCsv } from "./csvExport";

export function parseCsv(raw: string): string[][] {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentField = "";
  let inQuotes = false;

  function pushField() {
    currentRow.push(currentField);
    currentField = "";
  }
  function pushRow() {
    pushField();
    rows.push(currentRow);
    currentRow = [];
  }

  for (let i = 0; i < raw.length; i++) {
    const ch = raw[i];

    if (inQuotes) {
      if (ch === '"') {
        if (raw[i + 1] === '"') {
          currentField += '"';
          i++; // consume both quote characters
        } else {
          inQuotes = false;
        }
      } else {
        currentField += ch;
      }
      continue;
    }

    if (ch === '"' && currentField === "") {
      inQuotes = true;
    } else if (ch === ",") {
      pushField();
    } else if (ch === "\r" && raw[i + 1] === "\n") {
      pushRow();
      i++; // consume both \r and \n
    } else if (ch === "\n") {
      pushRow();
    } else {
      currentField += ch;
    }
  }
  // Flush a trailing field/row, unless the input ended cleanly on a newline
  // (in which case pushRow() already ran and there's nothing left to add).
  if (currentField !== "" || currentRow.length > 0) pushRow();

  return rows;
}

export const STUDENT_CSV_COLUMNS = [
  "name",
  "fatherName",
  "contact",
  "address",
  "gender",
  "courseType",
  "courseTypeOther",
  "category",
  "residency",
  "educationLevel",
  "educationStatus",
  "className",
] as const;

export type StudentCsvRow = Record<(typeof STUDENT_CSV_COLUMNS)[number], string>;
export type ParsedStudentCsvResult = { rows: StudentCsvRow[]; warnings: string[] };

const OPTIONAL_COLUMNS = new Set(["courseTypeOther", "className"]);

/** Header matched case-insensitively, order-independent — teachers reorder
 *  columns in Excel/Sheets. Blank rows (trailing newlines) are skipped. */
export function parseStudentCsv(raw: string): ParsedStudentCsvResult {
  const table = parseCsv(raw);
  if (table.length === 0) return { rows: [], warnings: ["The file is empty."] };

  const headerRow = table[0].map((h) => h.trim().toLowerCase());
  const headerIndex = new Map(headerRow.map((h, i) => [h, i]));

  const required = STUDENT_CSV_COLUMNS.filter((c) => !OPTIONAL_COLUMNS.has(c));
  const missing = required.filter((c) => !headerIndex.has(c.toLowerCase()));
  if (missing.length > 0) {
    return { rows: [], warnings: [`Missing required column(s): ${missing.join(", ")}.`] };
  }

  const rows: StudentCsvRow[] = [];
  for (let r = 1; r < table.length; r++) {
    const cells = table[r];
    if (cells.every((c) => c.trim() === "")) continue;
    const row = {} as StudentCsvRow;
    for (const col of STUDENT_CSV_COLUMNS) {
      const idx = headerIndex.get(col.toLowerCase());
      row[col] = idx !== undefined ? (cells[idx] ?? "").trim() : "";
    }
    rows.push(row);
  }
  return { rows, warnings: [] };
}

/** Downloadable starter CSV for the "Download CSV template" button. */
export function studentCsvTemplate(): string {
  const headers = STUDENT_CSV_COLUMNS.map((c) => c[0].toUpperCase() + c.slice(1));
  const example = [
    "Ahmad Ali",
    "Tariq Ali",
    "0300-1234567",
    "123 Main St, Lahore",
    "MALE",
    "BEGINNER",
    "",
    "PAYING",
    "DAY_SCHOLAR",
    "Intermediate",
    "Currently studying",
    "Batch 4A",
  ];
  return toCsv(headers, [example]);
}
