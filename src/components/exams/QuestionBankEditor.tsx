"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Chip } from "@/components/ui/Chip";
import { PasteQuestionsForm } from "./PasteQuestionsForm";
import { PdfUploadForm } from "./PdfUploadForm";
import { useUnsavedChangesWarning } from "@/lib/useUnsavedChangesWarning";

export type Option = { id: string; text: string; isCorrect: boolean; order: number };
export type Question = { id: string; text: string; active: boolean; order: number; options: Option[] };
export type QuestionStats = { total: number; correct: number };

const EMPTY_OPTIONS = ["", "", "", ""];

function QuestionForm({
  initialText = "",
  initialOptions = EMPTY_OPTIONS,
  initialCorrectIndex = 0,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initialText?: string;
  initialOptions?: string[];
  initialCorrectIndex?: number;
  submitLabel: string;
  onSubmit: (text: string, options: string[], correctIndex: number) => Promise<void>;
  onCancel?: () => void;
}) {
  const [text, setText] = useState(initialText);
  const [options, setOptions] = useState(initialOptions);
  const [correctIndex, setCorrectIndex] = useState(initialCorrectIndex);
  const [pending, setPending] = useState(false);

  useUnsavedChangesWarning(
    text !== initialText ||
      correctIndex !== initialCorrectIndex ||
      options.some((o, i) => o !== initialOptions[i])
  );

  async function handleSubmit() {
    if (!text.trim() || options.some((o) => !o.trim())) return;
    setPending(true);
    await onSubmit(text, options, correctIndex);
    setPending(false);
  }

  return (
    <div className="card" style={{ padding: 20, marginBottom: 12 }}>
      <div className="field">
        <label>Question text</label>
        <input value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {options.map((opt, i) => (
        <div key={i} className="field" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <input
            type="radio"
            name="correct"
            checked={correctIndex === i}
            onChange={() => setCorrectIndex(i)}
            aria-label={`Option ${i + 1} is correct`}
          />
          <input
            style={{ flex: 1 }}
            value={opt}
            placeholder={`Option ${String.fromCharCode(65 + i)}`}
            onChange={(e) => setOptions((prev) => prev.map((o, j) => (j === i ? e.target.value : o)))}
          />
        </div>
      ))}
      <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
        <Button type="button" disabled={pending} onClick={handleSubmit}>
          {pending ? "Saving…" : submitLabel}
        </Button>
        {onCancel ? (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        ) : null}
      </div>
    </div>
  );
}

export function QuestionBankEditor({
  examId,
  examStatus,
  questionsShown,
  initialQuestions,
  stats,
}: {
  examId: string;
  examStatus: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  questionsShown: number;
  initialQuestions: Question[];
  stats: Record<string, QuestionStats>;
}) {
  const router = useRouter();
  const [questions, setQuestions] = useState(initialQuestions);
  const [adding, setAdding] = useState(false);
  const [pasting, setPasting] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const activeCount = questions.filter((q) => q.active).length;
  const bankOk = activeCount >= questionsShown;
  const activeSorted = [...questions].filter((q) => q.active).sort((a, b) => a.order - b.order);

  function toggleSelected(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function moveQuestion(id: string, direction: "up" | "down") {
    const index = activeSorted.findIndex((q) => q.id === id);
    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (index === -1 || swapIndex < 0 || swapIndex >= activeSorted.length) return;
    const other = activeSorted[swapIndex];
    const self = activeSorted[index];

    const res = await fetch(`/api/exams/${examId}/questions/${id}/reorder`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ direction }),
    });
    if (res.ok) {
      setQuestions((prev) =>
        prev.map((q) => {
          if (q.id === self.id) return { ...q, order: other.order };
          if (q.id === other.id) return { ...q, order: self.order };
          return q;
        })
      );
    }
  }

  async function duplicateQuestion(id: string) {
    const res = await fetch(`/api/exams/${examId}/questions/${id}/duplicate`, { method: "POST" });
    if (res.ok) {
      const q = await res.json();
      setQuestions((prev) => [...prev, q]);
    }
  }

  async function bulkSetActive(active: boolean) {
    if (selected.size === 0) return;
    setBulkBusy(true);
    const res = await fetch(`/api/exams/${examId}/questions/bulk-active`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ questionIds: [...selected], active }),
    });
    setBulkBusy(false);
    if (res.ok) {
      setQuestions((prev) => prev.map((q) => (selected.has(q.id) ? { ...q, active } : q)));
      setSelected(new Set());
    }
  }

  function closeAllPanels() {
    setAdding(false);
    setPasting(false);
    setUploadingPdf(false);
    setEditingId(null);
  }

  function onBulkAdded(created: Question[]) {
    setQuestions((prev) => [...prev, ...created]);
    closeAllPanels();
  }

  async function addQuestion(text: string, options: string[], correctIndex: number) {
    const res = await fetch(`/api/exams/${examId}/questions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, options, correctIndex }),
    });
    if (res.ok) {
      const q = await res.json();
      setQuestions((prev) => [...prev, q]);
      setAdding(false);
    }
  }

  async function editQuestion(id: string, text: string, options: string[], correctIndex: number) {
    const res = await fetch(`/api/exams/${examId}/questions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, options, correctIndex }),
    });
    if (res.ok) {
      const q = await res.json();
      setQuestions((prev) => prev.map((old) => (old.id === id ? q : old)));
      setEditingId(null);
    }
  }

  async function toggleActive(id: string, active: boolean) {
    const res = await fetch(`/api/exams/${examId}/questions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active }),
    });
    if (res.ok) {
      setQuestions((prev) => prev.map((q) => (q.id === id ? { ...q, active } : q)));
    }
  }

  async function publish() {
    setPublishing(true);
    setPublishError(null);
    const res = await fetch(`/api/exams/${examId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PUBLISHED" }),
    });
    if (!res.ok) {
      const body = await res.json();
      setPublishError(body.error ?? "Could not publish.");
      setPublishing(false);
      return;
    }
    router.refresh();
    setPublishing(false);
  }

  return (
    <div>
      <div className="card bank-summary">
        <div>
          <b style={{ fontFamily: "var(--mono)" }}>
            {activeCount} active
          </b>{" "}
          · shows {questionsShown}
          {!bankOk ? <Chip variant="coral">Under threshold</Chip> : null}
        </div>
        {examStatus === "DRAFT" ? (
          <div>
            <Button onClick={publish} disabled={publishing}>
              {publishing ? "Publishing…" : "Publish"}
            </Button>
          </div>
        ) : (
          <Chip variant="active">{examStatus}</Chip>
        )}
      </div>
      {publishError ? <div className="field-error" style={{ marginBottom: 16 }}>{publishError}</div> : null}

      {questions.length > 5 ? (
        <input
          placeholder="Search questions…"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: "9px 12px",
            border: "1.5px solid var(--line-2)",
            borderRadius: 10,
            fontFamily: "var(--sans)",
            fontSize: 13,
            marginBottom: 12,
            width: "100%",
            maxWidth: 320,
          }}
        />
      ) : null}

      {selected.size > 0 ? (
        <div className="card" style={{ padding: 14, marginBottom: 12, display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ fontSize: 13, color: "var(--muted)" }}>{selected.size} selected</span>
          <Button type="button" variant="ghost" disabled={bulkBusy} onClick={() => bulkSetActive(false)}>
            Retire selected
          </Button>
          <Button type="button" variant="ghost" disabled={bulkBusy} onClick={() => bulkSetActive(true)}>
            Restore selected
          </Button>
          <Button type="button" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      ) : null}

      {[...questions]
        .filter((q) => q.text.toLowerCase().includes(searchQuery.trim().toLowerCase()))
        .sort((a, b) => a.order - b.order)
        .map((q) =>
        editingId === q.id ? (
          <QuestionForm
            key={q.id}
            initialText={q.text}
            initialOptions={q.options.map((o) => o.text)}
            initialCorrectIndex={q.options.findIndex((o) => o.isCorrect)}
            submitLabel="Save changes"
            onSubmit={(text, options, correctIndex) => editQuestion(q.id, text, options, correctIndex)}
            onCancel={() => setEditingId(null)}
          />
        ) : (
          <div key={q.id} className="card" style={{ padding: 18, marginBottom: 10, opacity: q.active ? 1 : 0.55 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", gap: 12 }}>
              <div style={{ display: "flex", gap: 12, alignItems: "start", flex: 1, minWidth: 0 }}>
                <input
                  type="checkbox"
                  checked={selected.has(q.id)}
                  onChange={() => toggleSelected(q.id)}
                  aria-label={`Select "${q.text}"`}
                  style={{ marginTop: 4 }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 600 }}>
                    {q.text} {!q.active ? <Chip variant="locked">Retired</Chip> : null}
                  </div>
                  {stats[q.id] && stats[q.id].total > 0 ? (
                    <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 4, fontFamily: "var(--mono)" }}>
                      Answered correctly by {stats[q.id].correct}/{stats[q.id].total} attempts (
                      {Math.round((100 * stats[q.id].correct) / stats[q.id].total)}%)
                    </div>
                  ) : null}
                  <div style={{ fontSize: 13, color: "var(--muted)", marginTop: 6 }}>
                    {q.options.map((o) => (
                      <div key={o.id} style={{ color: o.isCorrect ? "var(--leaf)" : undefined }}>
                        {o.isCorrect ? "✓ " : "· "}
                        {o.text}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, flexShrink: 0, flexWrap: "wrap" }}>
                {q.active ? (
                  <>
                    <Button type="button" variant="ghost" onClick={() => moveQuestion(q.id, "up")} aria-label="Move up">
                      ↑
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => moveQuestion(q.id, "down")} aria-label="Move down">
                      ↓
                    </Button>
                  </>
                ) : null}
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    closeAllPanels();
                    setEditingId(q.id);
                  }}
                >
                  Edit
                </Button>
                <Button type="button" variant="ghost" onClick={() => duplicateQuestion(q.id)}>
                  Duplicate
                </Button>
                <Button type="button" variant="ghost" onClick={() => toggleActive(q.id, !q.active)}>
                  {q.active ? "Retire" : "Restore"}
                </Button>
              </div>
            </div>
          </div>
        )
      )}

      {adding ? (
        <QuestionForm submitLabel="Add question" onSubmit={addQuestion} onCancel={closeAllPanels} />
      ) : pasting ? (
        <PasteQuestionsForm examId={examId} onAdded={onBulkAdded} onCancel={closeAllPanels} />
      ) : uploadingPdf ? (
        <PdfUploadForm examId={examId} onAdded={onBulkAdded} onCancel={closeAllPanels} />
      ) : (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              closeAllPanels();
              setAdding(true);
            }}
          >
            + Add question
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              closeAllPanels();
              setPasting(true);
            }}
          >
            + Paste multiple
          </Button>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              closeAllPanels();
              setUploadingPdf(true);
            }}
          >
            + Upload PDF
          </Button>
        </div>
      )}
    </div>
  );
}
