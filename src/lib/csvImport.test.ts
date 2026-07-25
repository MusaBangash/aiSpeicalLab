import { describe, test, expect } from "vitest";
import { parseCsv, parseStudentCsv, studentCsvTemplate } from "./csvImport";

describe("parseCsv", () => {
  test("splits plain comma-separated rows", () => {
    expect(parseCsv("a,b,c\n1,2,3")).toEqual([
      ["a", "b", "c"],
      ["1", "2", "3"],
    ]);
  });

  test("a comma inside a quoted field is data, not a delimiter", () => {
    expect(parseCsv('Name,Address\nAhmad,"123 Main St, Lahore"')).toEqual([
      ["Name", "Address"],
      ["Ahmad", "123 Main St, Lahore"],
    ]);
  });

  test("a doubled quote inside a quoted field is one literal quote", () => {
    expect(parseCsv('Name\n"Ali ""The Great"" Khan"')).toEqual([["Name"], ['Ali "The Great" Khan']]);
  });

  test("a newline inside a quoted field is data, not a row break", () => {
    expect(parseCsv('Name,Notes\nAhmad,"line one\nline two"')).toEqual([
      ["Name", "Notes"],
      ["Ahmad", "line one\nline two"],
    ]);
  });

  test("handles both \\r\\n and bare \\n line endings", () => {
    expect(parseCsv("a,b\r\n1,2")).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("parseStudentCsv", () => {
  const header = "name,fatherName,contact,address,gender,courseType,courseTypeOther,category,residency,educationLevel,educationStatus,className";

  test("parses a valid row with all columns present", () => {
    const raw = `${header}\nAhmad Ali,Tariq Ali,0300-1,"123 Main St, Lahore",MALE,BEGINNER,,PAYING,DAY_SCHOLAR,Intermediate,Studying,Batch 4A`;
    const result = parseStudentCsv(raw);
    expect(result.warnings).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe("Ahmad Ali");
    expect(result.rows[0].address).toBe("123 Main St, Lahore");
    expect(result.rows[0].className).toBe("Batch 4A");
  });

  test("header columns are matched case-insensitively and order-independently", () => {
    const raw = `NAME,CONTACT,fatherName,Address,GENDER,courseType,courseTypeOther,category,residency,educationLevel,educationStatus,className\nAhmad Ali,0300-1,Tariq Ali,Lahore,MALE,BEGINNER,,PAYING,DAY_SCHOLAR,Intermediate,Studying,`;
    const result = parseStudentCsv(raw);
    expect(result.warnings).toHaveLength(0);
    expect(result.rows[0].name).toBe("Ahmad Ali");
    expect(result.rows[0].contact).toBe("0300-1");
  });

  test("missing a required column produces a warning and zero rows", () => {
    const raw = `name,contact\nAhmad Ali,0300-1`;
    const result = parseStudentCsv(raw);
    expect(result.rows).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/Missing required column/);
  });

  test("blank trailing rows are skipped", () => {
    const raw = `${header}\nAhmad Ali,Tariq Ali,0300-1,Lahore,MALE,BEGINNER,,PAYING,DAY_SCHOLAR,Intermediate,Studying,\n,,,,,,,,,,,\n`;
    const result = parseStudentCsv(raw);
    expect(result.rows).toHaveLength(1);
  });

  test("an empty file produces a warning", () => {
    expect(parseStudentCsv("").warnings[0]).toMatch(/empty/);
  });
});

describe("studentCsvTemplate", () => {
  test("round-trips through parseStudentCsv with no warnings and its own comma-containing address intact", () => {
    const template = studentCsvTemplate();
    const result = parseStudentCsv(template);
    expect(result.warnings).toHaveLength(0);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].address).toContain(",");
  });
});
