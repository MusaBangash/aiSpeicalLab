"use client";

import { useEffect, useRef, useState } from "react";
import type { ExamQuestion } from "@/lib/examClient";
import { Icon } from "@/components/shell/Icon";

const KEYS = ["A", "B", "C", "D"];

export function QuestionCard({
  question,
  index,
  total,
  selectedOptionId,
  justSaved,
  onSelect,
  onPrev,
  onNext,
}: {
  question: ExamQuestion;
  index: number;
  total: number;
  selectedOptionId: string | null;
  justSaved: boolean;
  onSelect: (optionId: string) => void;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="qcard">
      <div className="q-eyebrow">
        <span className="q-num">
          Question {index + 1} of {total}
        </span>
        <span className={"q-saved" + (justSaved ? " on" : "")}>
          <Icon name="check" size={13} />
          Saved
        </span>
      </div>
      <div className="q-text">{question.text}</div>
      <div>
        {question.options.map((opt, i) => (
          <div
            key={opt.id}
            className={"opt" + (selectedOptionId === opt.id ? " sel" : "")}
            onClick={() => onSelect(opt.id)}
          >
            <div className="opt-key">{KEYS[i]}</div>
            <div className="opt-txt">{opt.text}</div>
          </div>
        ))}
      </div>
      <div className="q-foot">
        <button className="btn ghost" style={{ visibility: index === 0 ? "hidden" : "visible" }} onClick={onPrev}>
          ← Previous
        </button>
        <button className="btn ghost" style={{ visibility: index === total - 1 ? "hidden" : "visible" }} onClick={onNext}>
          Next →
        </button>
      </div>
    </div>
  );
}

/** Small hook: flips a boolean on for `ms`, resetting the timer on repeat triggers. */
export function useFlash(ms: number) {
  const [on, setOn] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const trigger = () => {
    setOn(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setOn(false), ms);
  };

  useEffect(() => () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
  }, []);

  return [on, trigger] as const;
}
