/**
 * Parses the teacher-facing bulk question template — used by both the
 * "paste multiple" form (client) and the PDF-extract route (server), so
 * it must have no Node-only or browser-only imports.
 *
 * Template:
 *   Q: question text
 *   A) option
 *   B) option *          <- "*" (leading or trailing), "(correct)",
 *   C) option                "[correct]", or "✓" marks the correct one
 *   D) option
 *
 * The letter (A-D) only detects an option line; its position within the
 * block — not the letter itself — sets its order, so a mislettered line
 * still parses correctly as long as exactly 4 appear in the block.
 */

export type ParsedQuestion = { text: string; options: string[]; correctIndex: number };
export type ParseResult = { parsed: ParsedQuestion[]; warnings: string[]; unparsedText: string };

const QUESTION_LINE = /^Q[:.)]?\s+(.*)$/i;
const OPTION_LINE = /^\*?\s*[A-Da-d][:.)]\s*(.+)$/;
const CORRECT_MARKER = /(^\*\s*|\s*\*$|\(correct\)|\[correct\]|✓)/gi;

function isMarkedCorrect(rawLine: string): boolean {
  return /^\*/.test(rawLine.trim()) || /\*\s*$/.test(rawLine) || /\(correct\)|\[correct\]|✓/i.test(rawLine);
}

export function parseQuestionTemplate(raw: string): ParseResult {
  const lines = raw.split("\n");
  const blocks: string[][] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    if (QUESTION_LINE.test(line.trim())) {
      if (current) blocks.push(current);
      current = [line];
    } else if (current) {
      current.push(line);
    }
  }
  if (current) blocks.push(current);

  const parsed: ParsedQuestion[] = [];
  const warnings: string[] = [];
  const unparsed: string[] = [];

  for (const block of blocks) {
    const rawText = block.join("\n").trim();
    const firstLine = block[0].trim();
    const text = firstLine.replace(QUESTION_LINE, "$1").trim();
    const label = text.length > 0 ? `"${text.slice(0, 60)}"` : "an unlabeled question";

    if (!text) {
      warnings.push(`A question block had no question text and was skipped.`);
      unparsed.push(rawText);
      continue;
    }

    const optionLines = block
      .slice(1)
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && OPTION_LINE.test(l));

    if (optionLines.length !== 4) {
      warnings.push(`Question ${label} was skipped: found ${optionLines.length} options, need exactly 4.`);
      unparsed.push(rawText);
      continue;
    }

    let correctIndex = -1;
    const options = optionLines.map((line, i) => {
      if (isMarkedCorrect(line)) correctIndex = i;
      const optionText = line.replace(OPTION_LINE, "$1").replace(CORRECT_MARKER, "").trim();
      return optionText;
    });

    if (correctIndex === -1) {
      warnings.push(`Question ${label} was skipped: no option marked correct (use * before or after the correct option).`);
      unparsed.push(rawText);
      continue;
    }
    const correctCount = optionLines.filter(isMarkedCorrect).length;
    if (correctCount > 1) {
      warnings.push(`Question ${label} was skipped: ${correctCount} options marked correct, expected exactly 1.`);
      unparsed.push(rawText);
      continue;
    }
    if (options.some((o) => !o)) {
      warnings.push(`Question ${label} was skipped: one or more options had no text.`);
      unparsed.push(rawText);
      continue;
    }

    parsed.push({ text, options, correctIndex });
  }

  return { parsed, warnings, unparsedText: unparsed.join("\n\n") };
}
