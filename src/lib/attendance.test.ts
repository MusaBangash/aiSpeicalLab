import { describe, test, expect } from "vitest";
import type { Attendance } from "@prisma/client";
import {
  startOfDay,
  toDateParam,
  parseDateParam,
  mondayIndex,
  determineAutoStatus,
  computeStreak,
  computeLongestStreak,
  countDaysPresent,
  listMonthsDescending,
} from "./attendance";

function mkRecord(dateISO: string, status: Attendance["status"]): Attendance {
  return { date: new Date(dateISO), status } as Attendance;
}

describe("startOfDay", () => {
  test("reduces a local date/time to its UTC-midnight bucket", () => {
    const d = new Date(2026, 6, 24, 15, 30); // local July 24 2026, 3:30pm
    const result = startOfDay(d);
    expect(result.getUTCFullYear()).toBe(2026);
    expect(result.getUTCMonth()).toBe(6);
    expect(result.getUTCDate()).toBe(24);
    expect(result.getUTCHours()).toBe(0);
  });
});

describe("toDateParam / parseDateParam", () => {
  test("round-trip a local date through YYYY-MM-DD", () => {
    const d = new Date(2026, 0, 5); // Jan 5 2026 — single-digit month/day must be zero-padded
    expect(toDateParam(d)).toBe("2026-01-05");
    const parsed = parseDateParam("2026-01-05");
    expect(parsed.getFullYear()).toBe(2026);
    expect(parsed.getMonth()).toBe(0);
    expect(parsed.getDate()).toBe(5);
  });
});

describe("mondayIndex", () => {
  test("Monday is 0, Sunday is 6", () => {
    expect(mondayIndex(new Date(2026, 6, 20))).toBe(0); // Mon 2026-07-20
    expect(mondayIndex(new Date(2026, 6, 26))).toBe(6); // Sun 2026-07-26
  });
});

describe("determineAutoStatus", () => {
  test("no schedule -> always PRESENT", () => {
    expect(determineAutoStatus(new Date(2026, 6, 24, 23, 0), null)).toBe("PRESENT");
    expect(determineAutoStatus(new Date(2026, 6, 24, 23, 0), undefined)).toBe("PRESENT");
  });

  test("within the grace window -> PRESENT", () => {
    // scheduled 9:00 (540 min), grace 10 min -> 9:09 is still PRESENT
    expect(determineAutoStatus(new Date(2026, 6, 24, 9, 9), 540)).toBe("PRESENT");
  });

  test("strictly past the grace window -> LATE", () => {
    expect(determineAutoStatus(new Date(2026, 6, 24, 9, 11), 540)).toBe("LATE");
  });
});

describe("computeStreak", () => {
  test("a weekend with no row does not break an otherwise-consecutive streak", () => {
    // Mon-Thu present/late, "today" = Sat (weekend, no row) -> streak counts backward through the weekday run.
    const records = [
      mkRecord("2026-07-20", "PRESENT"),
      mkRecord("2026-07-21", "PRESENT"),
      mkRecord("2026-07-22", "PRESENT"),
      mkRecord("2026-07-23", "LATE"),
      mkRecord("2026-07-24", "PRESENT"),
    ];
    expect(computeStreak(records, new Date(2026, 6, 25))).toBe(5);
  });

  test("a missing weekday (no row at all) breaks the streak", () => {
    const records = [
      mkRecord("2026-07-20", "PRESENT"),
      mkRecord("2026-07-21", "PRESENT"),
      // 2026-07-22 (Wed) has no row at all
      mkRecord("2026-07-23", "LATE"),
      mkRecord("2026-07-24", "PRESENT"),
    ];
    expect(computeStreak(records, new Date(2026, 6, 25))).toBe(2);
  });

  test("an explicit ABSENT record breaks the streak even though a row exists", () => {
    const records = [
      mkRecord("2026-07-22", "PRESENT"),
      mkRecord("2026-07-23", "ABSENT"),
      mkRecord("2026-07-24", "PRESENT"),
    ];
    expect(computeStreak(records, new Date(2026, 6, 24))).toBe(1);
  });
});

describe("computeLongestStreak", () => {
  test("finds the best historical run even if it isn't the current one", () => {
    const records = [
      // A 5-day run in the past...
      mkRecord("2026-06-01", "PRESENT"),
      mkRecord("2026-06-02", "PRESENT"),
      mkRecord("2026-06-03", "PRESENT"),
      mkRecord("2026-06-04", "PRESENT"),
      mkRecord("2026-06-05", "PRESENT"),
      mkRecord("2026-06-06", "ABSENT"),
      // ...then nothing recent.
      mkRecord("2026-07-24", "ABSENT"),
    ];
    expect(computeLongestStreak(records)).toBe(5);
  });

  test("empty input returns 0", () => {
    expect(computeLongestStreak([])).toBe(0);
  });
});

describe("countDaysPresent", () => {
  test("counts PRESENT and LATE, excludes ABSENT/EXCUSED", () => {
    const records = [{ status: "PRESENT" }, { status: "LATE" }, { status: "ABSENT" }, { status: "EXCUSED" }, { status: "PRESENT" }] as { status: Attendance["status"] }[];
    expect(countDaysPresent(records)).toBe(3);
  });
});

describe("listMonthsDescending", () => {
  test("every month from start through end, inclusive, most-recent-first", () => {
    const months = listMonthsDescending(new Date(2026, 4, 15), new Date(2026, 6, 10)); // May -> July
    expect(months).toEqual([
      { year: 2026, month: 6 },
      { year: 2026, month: 5 },
      { year: 2026, month: 4 },
    ]);
  });

  test("same month for start and end returns exactly one entry", () => {
    expect(listMonthsDescending(new Date(2026, 6, 1), new Date(2026, 6, 28))).toEqual([{ year: 2026, month: 6 }]);
  });
});
