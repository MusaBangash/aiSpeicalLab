"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import type { ParsedQuestion } from "@/lib/questionParser";
import type { Question } from "./QuestionBankEditor";

const KEYS = ["A", "B", "C", "D"];

export function ParsedQuestionsReview({
  examId,
  parsed,
  warnings,
  onCommit,
  onCancel,
}: {
  examId: string;
  parsed: ParsedQuestion[];
  warnings: string[];
  onCommit: (created: Question[]) => void;
  onCancel: () => void;
}) {
  const [questions, setQuestions] = useState(parsed);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function remove(index: number) {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  }

  async function commit() {
    if (questions.length === 0) return;
    setPending(true);
    setError(null);
    const res = await fetch(`/api/exams/${examId}/questions/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questions }),
    });
    setPending(false);
    if (!res.ok) {
      setError("Could not add these questions. Try again.");
      return;
    }
    const body = await res.json();
    onCommit(body.created);
  }

  return (
    <div className="card" style={{ padding: 20, marginBottom: 12 }}>
      {warnings.length > 0 ? (
        <div className="field-error" style={{ marginBottom: 14 }}>
          {warnings.length} question{warnings.length > 1 ? "s" : ""} couldn't be parsed and were skipped:
          <ul style={{ margin: "6px 0 0 18px" }}>
            {warnings.map((w, i) => (
              <li key={i}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {questions.length === 0 ? (
        <div style={{ color: "var(--muted)", fontSize: 13 }}>No valid questions to add.</div>
      ) : (
        <>
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
            {questions.length} question{questions.length > 1 ? "s" : ""} ready to add — review before committing.
          </div>
          {questions.map((q, qi) => (
            <div key={qi} className="card" style={{ padding: 16, marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <div style={{ fontWeight: 600 }}>{q.text}</div>
                <Button type="button" variant="ghost" onClick={() => remove(qi)}>
                  Remove
                </Button>
              </div>
              <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
                {q.options.map((opt, oi) => (
                  <div key={oi} style={{ color: oi === q.correctIndex ? "var(--leaf)" : undefined }}>
                    {oi === q.correctIndex ? "✓ " : `${KEYS[oi]}) `}
                    {opt}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </>
      )}

      {error ? <div className="field-error">{error}</div> : null}
      <div className="form-actions" style={{ marginTop: 10 }}>
        <Button type="button" disabled={pending || questions.length === 0} onClick={commit}>
          {pending ? "Adding…" : `Add ${questions.length} question${questions.length === 1 ? "" : "s"}`}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
