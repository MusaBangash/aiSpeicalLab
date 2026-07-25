import { describe, test, expect } from "vitest";
import { getDictionary } from "./index";
import { en } from "./en";
import { ur } from "./ur";

describe("getDictionary", () => {
  test("known language codes return their own dictionary", () => {
    expect(getDictionary("en")).toBe(en);
    expect(getDictionary("ur")).toBe(ur);
  });

  test("an unknown language code falls back to English", () => {
    expect(getDictionary("fr")).toBe(en);
    expect(getDictionary("")).toBe(en);
  });
});
