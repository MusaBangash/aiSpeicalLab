import { describe, test, expect } from "vitest";
import { isIdle, IDLE_THRESHOLD_SECONDS } from "./activity";

describe("isIdle", () => {
  test("below the threshold is not idle", () => {
    expect(isIdle(IDLE_THRESHOLD_SECONDS - 1)).toBe(false);
  });

  test("at or above the threshold is idle", () => {
    expect(isIdle(IDLE_THRESHOLD_SECONDS)).toBe(true);
    expect(isIdle(IDLE_THRESHOLD_SECONDS + 100)).toBe(true);
  });
});
