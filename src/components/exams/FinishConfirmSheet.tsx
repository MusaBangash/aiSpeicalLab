"use client";

import { useEffect, useRef } from "react";

export function FinishConfirmSheet({
  unansweredCount,
  onCancel,
  onConfirm,
}: {
  unansweredCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const titleId = "finish-confirm-title";

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    cancelRef.current?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onCancel();
        return;
      }
      if (e.key !== "Tab" || !sheetRef.current) return;
      const focusable = sheetRef.current.querySelectorAll<HTMLElement>("button:not(:disabled)");
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previouslyFocused?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="veil"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="sheet" ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        {unansweredCount > 0 ? (
          <div className="warn-chip">
            {unansweredCount} question{unansweredCount > 1 ? "s" : ""} unanswered
          </div>
        ) : null}
        <h3 id={titleId}>Finish and submit?</h3>
        <p>Once submitted, your answers are final and your score is calculated instantly. This can’t be undone.</p>
        <div className="sheet-btns">
          <button ref={cancelRef} className="btn ghost" onClick={onCancel}>
            Keep working
          </button>
          <button className="btn leaf" onClick={onConfirm}>
            Submit exam
          </button>
        </div>
      </div>
    </div>
  );
}
