"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ParsedQuestionsReview } from "./ParsedQuestionsReview";
import { PasteQuestionsForm } from "./PasteQuestionsForm";
import type { ParsedQuestion } from "@/lib/questionParser";
import type { Question } from "./QuestionBankEditor";

const MAX_SIZE_BYTES = 10 * 1024 * 1024;

type ExtractResult = { parsed: ParsedQuestion[]; warnings: string[]; unparsedText: string };

export function PdfUploadForm({
  examId,
  onAdded,
  onCancel,
}: {
  examId: string;
  onAdded: (created: Question[]) => void;
  onCancel: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<ExtractResult | null>(null);
  const [cleanup, setCleanup] = useState(false);

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > MAX_SIZE_BYTES) {
      setError("PDF must be under 10MB.");
      e.target.value = "";
      return;
    }

    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`/api/exams/${examId}/questions/extract-pdf`, { method: "POST", body: form });
    setUploading(false);
    e.target.value = "";

    if (!res.ok) {
      const body = await res.json().catch(() => ({ error: "Could not process this PDF." }));
      setError(body.error);
      return;
    }
    setResult(await res.json());
  }

  if (cleanup && result) {
    return (
      <PasteQuestionsForm
        examId={examId}
        initialText={result.unparsedText}
        onAdded={onAdded}
        onCancel={() => setCleanup(false)}
      />
    );
  }

  if (result) {
    return (
      <div>
        <ParsedQuestionsReview
          examId={examId}
          parsed={result.parsed}
          warnings={result.warnings}
          onCommit={onAdded}
          onCancel={onCancel}
        />
        {result.unparsedText ? (
          <Button type="button" variant="ghost" onClick={() => setCleanup(true)}>
            Edit and parse the leftover text manually
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 20, marginBottom: 12 }}>
      <div className="field">
        <label htmlFor="pdf-upload">Upload a PDF</label>
        <input id="pdf-upload" type="file" accept="application/pdf" onChange={onFileChange} disabled={uploading} />
        <div style={{ fontSize: 12, color: "var(--muted)", marginTop: 6 }}>
          Text is extracted locally on this server (no internet, no AI) and parsed with the same format as
          "Paste multiple." Scanned/image-only PDFs can't be read this way.
        </div>
      </div>
      {uploading ? <div style={{ fontSize: 13, color: "var(--muted)" }}>Reading PDF…</div> : null}
      {error ? <div className="field-error">{error}</div> : null}
      <div className="form-actions">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
