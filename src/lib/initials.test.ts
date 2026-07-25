import { describe, test, expect } from "vitest";
import { initials } from "./initials";

describe("initials", () => {
  test("two-word name -> both first letters, uppercased", () => {
    expect(initials("ahmad ali")).toBe("AA");
  });

  test("single-word name -> just that one letter", () => {
    expect(initials("Madonna")).toBe("M");
  });

  test("three-or-more-word name -> only the first two words count", () => {
    expect(initials("Zeeshan Tariq Malik")).toBe("ZT");
  });

  test("extra internal whitespace is collapsed", () => {
    expect(initials("Ahmad   Ali")).toBe("AA");
  });
});
