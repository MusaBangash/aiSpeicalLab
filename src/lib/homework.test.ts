import { describe, test, expect } from "vitest";
import { isLate } from "./homework";

describe("isLate", () => {
  test("no due date -> never late", () => {
    expect(isLate(null, new Date(2026, 6, 24))).toBe(false);
  });

  test("submitted after the due date -> late", () => {
    expect(isLate(new Date(2026, 6, 20), new Date(2026, 6, 21))).toBe(true);
  });

  test("submitted exactly at the due date -> not late (strictly after, not at-or-after)", () => {
    const due = new Date(2026, 6, 20, 12, 0, 0);
    expect(isLate(due, due)).toBe(false);
  });

  test("submitted before the due date -> not late", () => {
    expect(isLate(new Date(2026, 6, 20), new Date(2026, 6, 19))).toBe(false);
  });
});
