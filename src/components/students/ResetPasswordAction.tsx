"use client";

import { useState } from "react";
import { ConfirmSheet } from "@/components/exams/ConfirmSheet";

type Result = { email: string; password: string };

export function ResetPasswordAction({ studentId, studentName }: { studentId: string; studentName: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  async function confirmReset() {
    setPending(true);
    setError(null);
    const res = await fetch(`/api/students/${studentId}/reset-password`, { method: "POST" });
    setPending(false);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Could not reset this student's password");
      return;
    }
    setConfirming(false);
    setResult({ email: data.email, password: data.password });
  }

  if (result) {
    return (
      <div className="card" style={{ padding: 20 }}>
        <h3 style={{ marginBottom: 12 }}>Password reset</h3>
        <p style={{ marginBottom: 16, color: "var(--muted)" }}>
          Write this down now — the password will not be shown again.
        </p>
        <div style={{ fontFamily: "var(--mono)", fontSize: 14, background: "var(--gold-mist)", borderRadius: 10, padding: 16 }}>
          <div>Email: {result.email}</div>
          <div>Password: {result.password}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="card" style={{ padding: 20 }}>
      <div className="feed-title">Password reset</div>
      {error ? <div className="field-error">{error}</div> : null}
      <p style={{ color: "var(--muted)", marginBottom: 12, fontSize: 13.5 }}>
        Generates a new password if {studentName} has forgotten theirs. The old password stops working immediately.
      </p>
      <button type="button" className="btn coral" onClick={() => setConfirming(true)}>
        Reset password
      </button>

      {confirming ? (
        <ConfirmSheet
          title="Reset this student's password?"
          message={`This immediately invalidates ${studentName}'s current password and generates a new one, shown once. Any device already logged in stays logged in until it signs out.`}
          confirmLabel="Reset"
          confirmVariant="coral"
          pending={pending}
          onCancel={() => setConfirming(false)}
          onConfirm={confirmReset}
        />
      ) : null}
    </div>
  );
}
