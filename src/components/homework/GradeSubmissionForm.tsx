"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Status = "SUBMITTED" | "REVIEWED" | "NEEDS_REVISION" | "COMPLETE";

export function GradeSubmissionForm({
  submissionId,
  currentStatus,
  currentGrade,
  currentFeedback,
}: {
  submissionId: string;
  currentStatus: Status;
  currentGrade: number | null;
  currentFeedback: string | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>(currentStatus);
  const [grade, setGrade] = useState(currentGrade !== null ? String(currentGrade) : "");
  const [feedback, setFeedback] = useState(currentFeedback ?? "");
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    await fetch(`/api/homework/submissions/${submissionId}/grade`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, grade: grade === "" ? undefined : Number(grade), feedback: feedback || undefined }),
    });
    setPending(false);
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="journal-entry-form" style={{ padding: "12px 0 0" }}>
      <select value={status} onChange={(e) => setStatus(e.target.value as Status)} disabled={pending}>
        <option value="SUBMITTED">Submitted</option>
        <option value="REVIEWED">Reviewed</option>
        <option value="NEEDS_REVISION">Needs revision</option>
        <option value="COMPLETE">Complete</option>
      </select>
      <input
        type="number"
        min={0}
        max={100}
        value={grade}
        onChange={(e) => setGrade(e.target.value)}
        placeholder="Grade"
        disabled={pending}
        style={{ width: 80 }}
      />
      <input
        value={feedback}
        onChange={(e) => setFeedback(e.target.value)}
        placeholder="Feedback (optional)"
        disabled={pending}
        style={{ flex: 1 }}
      />
      <button type="submit" className="btn" disabled={pending}>
        {pending ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
