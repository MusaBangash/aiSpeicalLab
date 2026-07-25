import { describe, test, expect } from "vitest";
import { tenureMonthsSince, computeRank } from "./rank";

describe("tenureMonthsSince", () => {
  test("null joinDate -> 0 months", () => {
    expect(tenureMonthsSince(null, new Date(2026, 6, 24))).toBe(0);
  });

  test("full calendar months elapsed, floored", () => {
    expect(tenureMonthsSince(new Date(2026, 0, 15), new Date(2026, 6, 20))).toBe(6); // Jan 15 -> Jul 20 = 6 full months
  });

  test("has not yet reached the day-of-month threshold this month -> rounds down", () => {
    expect(tenureMonthsSince(new Date(2026, 0, 25), new Date(2026, 6, 20))).toBe(5); // Jan 25 -> Jul 20 is 5 months + 26 days short of 6
  });

  test("never negative", () => {
    expect(tenureMonthsSince(new Date(2026, 6, 1), new Date(2026, 0, 1))).toBe(0);
  });
});

describe("computeRank", () => {
  test("zero everything -> Recruit", () => {
    const result = computeRank({ tenureMonths: 0, points: 0, hasProjectCompleteBadge: false, hasMasterEngineerNomination: false });
    expect(result.currentRank).toBe("Recruit");
    expect(result.ladder.filter((l) => l.achieved)).toHaveLength(1);
  });

  test("meets Engineer's tenure+points but lacks Architect's badge gate -> stays at Engineer, not Architect", () => {
    const result = computeRank({ tenureMonths: 20, points: 300, hasProjectCompleteBadge: false, hasMasterEngineerNomination: false });
    expect(result.currentRank).toBe("Engineer");
    expect(result.nextRank).toBe("Architect");
    expect(result.nextRankExtraGateLabel).toBe("Project Complete badge");
    expect(result.nextRankExtraGateMet).toBe(false);
  });

  test("having the Project Complete badge unlocks Architect once tenure+points are also met", () => {
    const result = computeRank({ tenureMonths: 20, points: 300, hasProjectCompleteBadge: true, hasMasterEngineerNomination: false });
    expect(result.currentRank).toBe("Architect");
  });

  test("a Master Engineer nomination alone, with insufficient tenure/points, does not vault past unmet lower ranks", () => {
    const result = computeRank({ tenureMonths: 4, points: 50, hasProjectCompleteBadge: false, hasMasterEngineerNomination: true });
    expect(result.currentRank).toBe("Apprentice");
    expect(result.pointsToNextRank).toBe(40); // Builder needs 90 points, 90-50=40
    expect(result.monthsToNextTenure).toBe(2); // Builder needs 6 months, 6-4=2
  });

  test("meeting Master Engineer's own tenure+points+nomination reaches the top rank regardless of Project Complete", () => {
    const result = computeRank({ tenureMonths: 24, points: 400, hasProjectCompleteBadge: false, hasMasterEngineerNomination: true });
    expect(result.currentRank).toBe("Master Engineer");
    expect(result.nextRank).toBeNull();
  });

  test("one point below a threshold stays at the lower rank", () => {
    const result = computeRank({ tenureMonths: 3, points: 39, hasProjectCompleteBadge: false, hasMasterEngineerNomination: false });
    expect(result.currentRank).toBe("Recruit");
  });
});
