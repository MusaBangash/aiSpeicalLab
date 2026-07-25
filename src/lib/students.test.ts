import { describe, test, expect } from "vitest";
import { generatePassword } from "./students";

const AMBIGUOUS_CHARS = /[0O1lI]/;

describe("generatePassword", () => {
  test("is 12 characters long", () => {
    expect(generatePassword()).toHaveLength(12);
  });

  test("never contains visually-ambiguous characters (0/O, 1/l/I)", () => {
    for (let i = 0; i < 50; i++) {
      expect(generatePassword()).not.toMatch(AMBIGUOUS_CHARS);
    }
  });

  test("is not deterministic — repeated calls produce different passwords", () => {
    const passwords = new Set(Array.from({ length: 20 }, () => generatePassword()));
    expect(passwords.size).toBeGreaterThan(1);
  });
});
