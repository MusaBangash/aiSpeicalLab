import { describe, test, expect } from "vitest";
import {
  computeScoreTrend,
  pickWeakestTopic,
  countDoubtsOnTopicThisTerm,
  generateDnaSummary,
  INDEPENDENCE_THRESHOLD,
} from "./dna";
import type { TopicBreakdownRow } from "./exam";
import type { DoubtRow } from "./doubts";

describe("computeScoreTrend", () => {
  test("fewer than 2 records -> insufficient", () => {
    expect(computeScoreTrend([])).toBe("insufficient");
    expect(computeScoreTrend([{ scorePercent: 80, updatedAt: new Date(2026, 0, 1) }])).toBe("insufficient");
  });

  test("latest well above prior average -> up", () => {
    const records = [
      { scorePercent: 60, updatedAt: new Date(2026, 0, 1) },
      { scorePercent: 65, updatedAt: new Date(2026, 0, 5) },
      { scorePercent: 90, updatedAt: new Date(2026, 0, 10) },
    ];
    expect(computeScoreTrend(records)).toBe("up");
  });

  test("latest well below prior average -> down", () => {
    const records = [
      { scorePercent: 90, updatedAt: new Date(2026, 0, 1) },
      { scorePercent: 85, updatedAt: new Date(2026, 0, 5) },
      { scorePercent: 60, updatedAt: new Date(2026, 0, 10) },
    ];
    expect(computeScoreTrend(records)).toBe("down");
  });

  test("within the +-3pp threshold -> flat", () => {
    const records = [
      { scorePercent: 80, updatedAt: new Date(2026, 0, 1) },
      { scorePercent: 82, updatedAt: new Date(2026, 0, 10) },
    ];
    expect(computeScoreTrend(records)).toBe("flat");
  });

  test("out-of-order input is sorted by updatedAt before comparing", () => {
    const records = [
      { scorePercent: 90, updatedAt: new Date(2026, 0, 10) },
      { scorePercent: 60, updatedAt: new Date(2026, 0, 1) },
    ];
    expect(computeScoreTrend(records)).toBe("up");
  });
});

describe("pickWeakestTopic", () => {
  function row(overrides: Partial<TopicBreakdownRow>): TopicBreakdownRow {
    return { moduleId: "m1", moduleTitle: "Loops", correctCount: 1, totalCount: 4, percentCorrect: 25, ...overrides };
  }

  test("no rows -> null", () => {
    expect(pickWeakestTopic([])).toBeNull();
  });

  test("picks the first row meeting the sample-size floor (rows already weakest-first)", () => {
    const rows = [row({ moduleTitle: "Loops", percentCorrect: 58, totalCount: 6 }), row({ moduleTitle: "Arrays", percentCorrect: 90, totalCount: 8 })];
    expect(pickWeakestTopic(rows)).toEqual({ moduleTitle: "Loops", percentCorrect: 58 });
  });

  test("skips a row under the minimum sample size, even if weakest", () => {
    const rows = [
      row({ moduleTitle: "Loops", percentCorrect: 0, totalCount: 1 }),
      row({ moduleTitle: "Arrays", percentCorrect: 58, totalCount: 6 }),
    ];
    expect(pickWeakestTopic(rows)).toEqual({ moduleTitle: "Arrays", percentCorrect: 58 });
  });

  test("all rows under the sample-size floor -> null", () => {
    const rows = [row({ totalCount: 1 }), row({ totalCount: 2 })];
    expect(pickWeakestTopic(rows)).toBeNull();
  });
});

describe("countDoubtsOnTopicThisTerm", () => {
  function doubt(overrides: Partial<DoubtRow>): DoubtRow {
    return {
      id: "d1",
      body: "help",
      createdAt: new Date(2026, 6, 10),
      studentName: "Test Student",
      moduleTitle: "Loops",
      answerBody: null,
      answeredAt: null,
      answeredByName: null,
      resolvedAt: null,
      resolvedByName: null,
      status: "UNANSWERED",
      ...overrides,
    };
  }

  test("counts only doubts matching both moduleTitle and the current calendar month", () => {
    const today = new Date(2026, 6, 25);
    const doubts = [
      doubt({ moduleTitle: "Loops", createdAt: new Date(2026, 6, 5) }),
      doubt({ moduleTitle: "Loops", createdAt: new Date(2026, 6, 20) }),
      doubt({ moduleTitle: "Loops", createdAt: new Date(2026, 5, 20) }), // last month — excluded
      doubt({ moduleTitle: "Arrays", createdAt: new Date(2026, 6, 20) }), // different topic — excluded
    ];
    expect(countDoubtsOnTopicThisTerm(doubts, "Loops", today)).toBe(2);
  });

  test("no matches -> 0", () => {
    expect(countDoubtsOnTopicThisTerm([], "Loops", new Date(2026, 6, 25))).toBe(0);
  });
});

describe("generateDnaSummary", () => {
  test("full example: strong score, holding steady, leans on help, matches the plan's worked example", () => {
    const summary = generateDnaSummary({
      avgScorePercent: 92,
      examsTaken: 5,
      scoreTrend: "flat",
      weakestTopic: { moduleTitle: "Loops", percentCorrect: 58 },
      doubtsOnWeakestTopicThisTerm: 6,
      attendancePercent: 88,
      rankName: "Builder",
    });
    expect(summary).toBe(
      "Strong technical execution (92% average across exams), holding steady; leans on help with Loops — 6 questions this term, weakest topic at 58% correct; 88% attendance this term; ranked Builder."
    );
  });

  test("no exam history yet -> opens with that clause, no weakest-topic clause", () => {
    const summary = generateDnaSummary({
      avgScorePercent: 0,
      examsTaken: 0,
      scoreTrend: "insufficient",
      weakestTopic: null,
      doubtsOnWeakestTopicThisTerm: 0,
      attendancePercent: 50,
      rankName: "Recruit",
    });
    expect(summary).toBe("No exam history yet; 50% attendance this term; ranked Recruit.");
  });

  test("doubt count below the independence threshold reads as independent, not leaning on help", () => {
    const summary = generateDnaSummary({
      avgScorePercent: 70,
      examsTaken: 3,
      scoreTrend: "up",
      weakestTopic: { moduleTitle: "Recursion", percentCorrect: 65 },
      doubtsOnWeakestTopicThisTerm: INDEPENDENCE_THRESHOLD - 1,
      attendancePercent: 95,
      rankName: "Apprentice",
    });
    expect(summary).toContain("tackled Recursion mostly independently");
    expect(summary).not.toContain("leans on help");
  });
});
