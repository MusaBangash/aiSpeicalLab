import { describe, test, expect } from "vitest";
import { seededShuffle } from "./exam";

describe("seededShuffle", () => {
  test("same seed always yields the same order", () => {
    const items = ["a", "b", "c", "d"];
    const first = seededShuffle(items, "attempt1-question1");
    const second = seededShuffle(items, "attempt1-question1");
    expect(second).toEqual(first);
  });

  test("different seeds usually yield different orders", () => {
    const items = ["a", "b", "c", "d"];
    const a = seededShuffle(items, "seed-a");
    const b = seededShuffle(items, "seed-b");
    expect(a).not.toEqual(b);
  });

  test("the shuffle is a permutation — same elements, same length, original array untouched", () => {
    const items = ["a", "b", "c", "d"];
    const result = seededShuffle(items, "some-seed");
    expect(result).toHaveLength(items.length);
    expect([...result].sort()).toEqual([...items].sort());
    expect(items).toEqual(["a", "b", "c", "d"]); // original not mutated
  });
});
