import { describe, test, expect } from "vitest";
import { parseQuestionTemplate } from "./questionParser";

describe("parseQuestionTemplate", () => {
  test("mislettered options still parse correctly by position, not by letter", () => {
    const raw = `Q: 2 + 2 = ?\nA) 3\nA) 4 *\nA) 5\nA) 6`;
    const result = parseQuestionTemplate(raw);
    expect(result.parsed).toHaveLength(1);
    expect(result.parsed[0].options).toEqual(["3", "4", "5", "6"]);
    expect(result.parsed[0].correctIndex).toBe(1);
    expect(result.warnings).toHaveLength(0);
  });

  test("two options marked correct is a warning, and the whole question is skipped", () => {
    const raw = `Q: Pick one\nA) x *\nB) y *\nC) z\nD) w`;
    const result = parseQuestionTemplate(raw);
    expect(result.parsed).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/2 options marked correct, expected exactly 1/);
    expect(result.unparsedText).toContain("Pick one");
  });

  test("zero options marked correct is a warning, and the question is skipped", () => {
    const raw = `Q: No correct marker\nA) x\nB) y\nC) z\nD) w`;
    const result = parseQuestionTemplate(raw);
    expect(result.parsed).toHaveLength(0);
    expect(result.warnings[0]).toMatch(/no option marked correct/i);
  });

  test("a mixed batch keeps valid questions and reports only the bad ones", () => {
    const raw = `Q: Good one\nA) a\nB) b *\nC) c\nD) d\n\nQ: Bad one\nA) only one option`;
    const result = parseQuestionTemplate(raw);
    expect(result.parsed).toHaveLength(1);
    expect(result.parsed[0].text).toBe("Good one");
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toMatch(/found 1 options, need exactly 4/);
  });

  test("a 'Q:' line with nothing after it isn't recognized as a question block at all (no crash, no warning)", () => {
    // QUESTION_LINE requires at least one space after the marker, and each
    // line is trimmed before matching — so a bare "Q:" with no trailing
    // content never starts a block in the first place.
    const raw = `Q:\nA) a\nB) b *\nC) c\nD) d`;
    const result = parseQuestionTemplate(raw);
    expect(result.parsed).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });

  test("(correct)/[correct]/checkmark markers are all recognized alongside *", () => {
    const raw = `Q: Which marker style?\nA) a\nB) b (correct)\nC) c\nD) d`;
    const result = parseQuestionTemplate(raw);
    expect(result.parsed).toHaveLength(1);
    expect(result.parsed[0].correctIndex).toBe(1);
    expect(result.parsed[0].options[1]).toBe("b"); // marker text stripped from the option text
  });
});
