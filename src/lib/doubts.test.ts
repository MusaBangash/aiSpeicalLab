import { describe, test, expect } from "vitest";
import { doubtStatus } from "./doubts";

describe("doubtStatus", () => {
  test("neither timestamp set -> UNANSWERED", () => {
    expect(doubtStatus({ answeredAt: null, resolvedAt: null })).toBe("UNANSWERED");
  });

  test("only answeredAt set -> ANSWERED", () => {
    expect(doubtStatus({ answeredAt: new Date(), resolvedAt: null })).toBe("ANSWERED");
  });

  test("resolvedAt set -> RESOLVED, regardless of answeredAt (resolving requires an answer first, so this is always true in practice)", () => {
    expect(doubtStatus({ answeredAt: new Date(), resolvedAt: new Date() })).toBe("RESOLVED");
  });
});
