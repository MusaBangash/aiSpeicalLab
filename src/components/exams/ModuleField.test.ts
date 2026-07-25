import { describe, test, expect } from "vitest";
import { resolveModuleId } from "./ModuleField";

const modules = [
  { id: "m1", title: "Python foundations" },
  { id: "m2", title: "Data structures" },
];

describe("resolveModuleId", () => {
  test("exact match (case-insensitive) resolves to the module's id", () => {
    expect(resolveModuleId(modules, "python foundations")).toBe("m1");
    expect(resolveModuleId(modules, "PYTHON FOUNDATIONS")).toBe("m1");
  });

  test("surrounding whitespace is trimmed before matching", () => {
    expect(resolveModuleId(modules, "  Data structures  ")).toBe("m2");
  });

  test("no match returns null", () => {
    expect(resolveModuleId(modules, "Nonexistent module")).toBeNull();
  });

  test("empty string returns null — this is what makes an optional module field's blank input mean 'untagged'", () => {
    expect(resolveModuleId(modules, "")).toBeNull();
  });
});
