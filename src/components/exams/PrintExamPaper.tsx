"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type Option = { id: string; text: string; isCorrect: boolean };
type Question = { id: string; text: string; active: boolean; options: Option[] };

const KEYS = ["A", "B", "C", "D"];

/**
 * A handout (no answers) or a proctor's answer key (correct options
 * marked), toggled before printing — reuses the same window.print() +
 * .print-only pattern as the results-PDF export.
 */
export function PrintExamPaper({ examTitle, questions }: { examTitle: string; questions: Question[] }) {
  const [includeAnswerKey, setIncludeAnswerKey] = useState(false);
  const active = questions.filter((q) => q.active);

  return (
    <>
      <div
        className="card no-print"
        style={{ padding: 14, marginBottom: 16, display: "flex", alignItems: "center", gap: 16 }}
      >
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={includeAnswerKey}
            onChange={(e) => setIncludeAnswerKey(e.target.checked)}
          />
          Include answer key
        </label>
        <Button type="button" variant="ghost" onClick={() => window.print()}>
          Print exam paper
        </Button>
      </div>

      <div className="print-only">
        <h2>{examTitle}</h2>
        <p>
          {active.length} question{active.length === 1 ? "" : "s"}
          {includeAnswerKey ? " — Answer key" : ""}
        </p>
        {active.map((q, i) => (
          <div key={q.id} style={{ marginBottom: 18 }}>
            <div style={{ fontWeight: 600 }}>
              {i + 1}. {q.text}
            </div>
            {q.options.map((o, oi) => (
              <div
                key={o.id}
                style={{ marginLeft: 18, fontWeight: includeAnswerKey && o.isCorrect ? 700 : 400 }}
              >
                {KEYS[oi]}) {o.text}
                {includeAnswerKey && o.isCorrect ? " ✓" : ""}
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
