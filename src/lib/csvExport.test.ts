import { describe, test, expect } from "vitest";
import { rowsToCsv, slugify, toCsv } from "./csvExport";

describe("rowsToCsv", () => {
  test("wraps fields containing a comma, quote, or newline in quotes and doubles internal quotes", () => {
    const csv = rowsToCsv([
      { name: "Ali, Jr.", email: "a@b.com", record: null, attempts: [] },
    ]);
    const lines = csv.split("\n");
    expect(lines[1]).toContain('"Ali, Jr."');
  });

  test("plain fields are left unquoted", () => {
    const csv = rowsToCsv([{ name: "Ahmad Ali", email: "a@b.com", record: { scorePercent: 90, passed: true, verificationId: "v1" }, attempts: [1] }]);
    const lines = csv.split("\n");
    expect(lines[1]).toBe("Ahmad Ali,a@b.com,90,Yes,1,v1");
  });

  test("a student with no exam record shows em-dash placeholders", () => {
    const csv = rowsToCsv([{ name: "Ahmad Ali", email: "a@b.com", record: null, attempts: [] }]);
    const lines = csv.split("\n");
    expect(lines[1]).toBe("Ahmad Ali,a@b.com,—,—,0,—");
  });
});

describe("toCsv", () => {
  test("joins headers and rows, quoting fields that need it", () => {
    const csv = toCsv(["Name", "Address"], [["Ahmad Ali", "123 Main St, Lahore"]]);
    expect(csv).toBe('Name,Address\nAhmad Ali,"123 Main St, Lahore"');
  });

  test("numbers are stringified without quoting", () => {
    const csv = toCsv(["Count"], [[42]]);
    expect(csv.split("\n")[1]).toBe("42");
  });
});

describe("slugify", () => {
  test("lowercases and replaces non-alphanumeric runs with a single hyphen", () => {
    expect(slugify("Module 4 Exam — Neural Networks!")).toBe("module-4-exam-neural-networks");
  });

  test("trims leading/trailing hyphens produced by leading/trailing punctuation", () => {
    expect(slugify("  Hello World  ")).toBe("hello-world");
  });
});
