"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { parseQuestionTemplate } from "@/lib/questionParser";
import { ParsedQuestionsReview } from "./ParsedQuestionsReview";
import type { Question } from "./QuestionBankEditor";

const PLACEHOLDER = `Q: What is the boiling point of water at sea level?
A) 90°C
B) 100°C *
C) 110°C
D) 120°C`;

export function PasteQuestionsForm({
  examId,
  initialText = "",
  onAdded,
  onCancel,
}: {
  examId: string;
  initialText?: string;
  onAdded: (created: Question[]) => void;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [result, setResult] = useState<ReturnType<typeof parseQuestionTemplate> | null>(null);

  if (result) {
    return (
      <ParsedQuestionsReview
        examId={examId}
        parsed={result.parsed}
        warnings={result.warnings}
        onCommit={onAdded}
        onCancel={() => setResult(null)}
      />
    );
  }

  return (
    <div className="card" style={{ padding: 20, marginBottom: 12 }}>
      <div className="field">
        <label htmlFor="paste-questions">Paste one or more questions</label>
        <textarea
          id="paste-questions"
          rows={12}
          style={{
            width: "100%",
            fontFamily: "var(--mono)",
            fontSize: 13,
            padding: 12,
            border: "1.5px solid var(--line-2)",
            borderRadius: 11,
            resize: "vertical",
          }}
          placeholder={PLACEHOLDER}
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
      </div>
      <div className="form-actions">
        <Button type="button" disabled={!text.trim()} onClick={() => setResult(parseQuestionTemplate(text))}>
          Parse
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
