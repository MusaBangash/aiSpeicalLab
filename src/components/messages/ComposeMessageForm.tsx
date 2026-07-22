"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClassSummary } from "@/lib/classes";

type TargetType = "STUDENT" | "CLASS" | "ALL";
type Urgency = "NORMAL" | "IMPORTANT" | "URGENT";

export function ComposeMessageForm({
  classes,
  students,
}: {
  classes: ClassSummary[];
  students: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [targetType, setTargetType] = useState<TargetType>("ALL");
  const [targetStudentId, setTargetStudentId] = useState(students[0]?.id ?? "");
  const [targetClassId, setTargetClassId] = useState(classes[0]?.id ?? "");
  const [urgency, setUrgency] = useState<Urgency>("NORMAL");
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const payload =
      targetType === "STUDENT"
        ? { targetType, targetStudentId, urgency, body }
        : targetType === "CLASS"
          ? { targetType, targetClassId, urgency, body }
          : { targetType, urgency, body };

    const res = await fetch("/api/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setPending(false);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Could not send this message");
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12 }}>
      <div className="journal-entry-form" style={{ padding: 0 }}>
        <select value={targetType} onChange={(e) => setTargetType(e.target.value as TargetType)} disabled={pending}>
          <option value="ALL">All students</option>
          <option value="CLASS">One class</option>
          <option value="STUDENT">One student</option>
        </select>

        {targetType === "CLASS" ? (
          <select value={targetClassId} onChange={(e) => setTargetClassId(e.target.value)} disabled={pending}>
            {classes.length === 0 ? (
              <option value="">No classes yet</option>
            ) : (
              classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))
            )}
          </select>
        ) : null}

        {targetType === "STUDENT" ? (
          <select value={targetStudentId} onChange={(e) => setTargetStudentId(e.target.value)} disabled={pending}>
            {students.length === 0 ? (
              <option value="">No students yet</option>
            ) : (
              students.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))
            )}
          </select>
        ) : null}

        <select value={urgency} onChange={(e) => setUrgency(e.target.value as Urgency)} disabled={pending}>
          <option value="NORMAL">Normal</option>
          <option value="IMPORTANT">Important</option>
          <option value="URGENT">Urgent</option>
        </select>
      </div>

      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="Write your announcement…"
        rows={4}
        disabled={pending}
        required
      />

      {error ? <div className="field-error">{error}</div> : null}
      <button type="submit" className="btn" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Sending…" : "Send"}
      </button>
    </form>
  );
}
