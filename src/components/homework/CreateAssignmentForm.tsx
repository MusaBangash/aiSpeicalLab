"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { ClassSummary } from "@/lib/classes";

type TargetType = "CLASS" | "STUDENT";

type ItemDraft = { label: string; requiresSubmission: boolean };

export function CreateAssignmentForm({
  classes,
  students,
}: {
  classes: ClassSummary[];
  students: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [targetType, setTargetType] = useState<TargetType>("CLASS");
  const [classId, setClassId] = useState(classes[0]?.id ?? "");
  const [targetStudentId, setTargetStudentId] = useState(students[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [items, setItems] = useState<ItemDraft[]>([{ label: "", requiresSubmission: false }]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));
  }
  function addItem() {
    setItems((prev) => [...prev, { label: "", requiresSubmission: false }]);
  }
  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const validItems = items.filter((it) => it.label.trim().length > 0);
    const payload =
      targetType === "CLASS"
        ? { target: "CLASS", classId, title, description: description || undefined, dueDate, items: validItems }
        : { target: "STUDENT", targetStudentId, title, description: description || undefined, dueDate, items: validItems };

    const res = await fetch("/api/homework", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setPending(false);
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setError(data?.error ?? "Could not create this assignment");
      return;
    }
    router.push("/teacher/homework");
  }

  return (
    <form onSubmit={onSubmit} className="card" style={{ padding: 20, display: "flex", flexDirection: "column", gap: 12, maxWidth: 640 }}>
      <div className="journal-entry-form" style={{ padding: 0 }}>
        <select value={targetType} onChange={(e) => setTargetType(e.target.value as TargetType)} disabled={pending}>
          <option value="CLASS">One class</option>
          <option value="STUDENT">One student</option>
        </select>

        {targetType === "CLASS" ? (
          <select value={classId} onChange={(e) => setClassId(e.target.value)} disabled={pending}>
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
        ) : (
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
        )}
      </div>

      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} disabled={pending} required />
      </div>

      <div className="field">
        <label htmlFor="description">Description (optional)</label>
        <textarea id="description" value={description} onChange={(e) => setDescription(e.target.value)} disabled={pending} rows={3} />
      </div>

      <div className="field">
        <label htmlFor="dueDate">Due date</label>
        <input id="dueDate" type="datetime-local" value={dueDate} onChange={(e) => setDueDate(e.target.value)} disabled={pending} required />
      </div>

      <div>
        <label style={{ fontSize: 13, fontWeight: 700, marginBottom: 8, display: "block" }}>Checklist items</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((item, i) => (
            <div key={i} className="journal-entry-form" style={{ padding: 0 }}>
              <input
                value={item.label}
                onChange={(e) => updateItem(i, { label: e.target.value })}
                placeholder="e.g. Watch the intro video"
                disabled={pending}
                style={{ flex: 1 }}
              />
              <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, whiteSpace: "nowrap" }}>
                <input
                  type="checkbox"
                  checked={item.requiresSubmission}
                  onChange={(e) => updateItem(i, { requiresSubmission: e.target.checked })}
                  disabled={pending}
                />
                Needs submission
              </label>
              <button type="button" className="btn ghost" disabled={pending || items.length === 1} onClick={() => removeItem(i)}>
                Remove
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="btn ghost" disabled={pending} onClick={addItem} style={{ marginTop: 8 }}>
          Add item
        </button>
      </div>

      {error ? <div className="field-error">{error}</div> : null}
      <button type="submit" className="btn" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Creating…" : "Create assignment"}
      </button>
    </form>
  );
}
