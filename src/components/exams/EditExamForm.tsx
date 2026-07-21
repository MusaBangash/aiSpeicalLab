"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ModuleField, resolveModuleId } from "./ModuleField";
import { useUnsavedChangesWarning } from "@/lib/useUnsavedChangesWarning";

type Exam = {
  id: string;
  title: string;
  moduleId: string;
  durationMinutes: number;
  cooldownHours: number;
  passMarkPercent: number;
  questionsShown: number;
  opensAt: Date | string | null;
  closesAt: Date | string | null;
};

/** Local "YYYY-MM-DDTHH:mm" for a <input type="datetime-local"> value — "" if unset. */
function toDatetimeLocalValue(d: Date | string | null): string {
  if (!d) return "";
  const date = new Date(d);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function EditExamForm({ exam, modules }: { exam: Exam; modules: { id: string; title: string }[] }) {
  const router = useRouter();
  const [title, setTitle] = useState(exam.title);
  const [moduleName, setModuleName] = useState(modules.find((m) => m.id === exam.moduleId)?.title ?? "");
  const [durationMinutes, setDurationMinutes] = useState(exam.durationMinutes);
  const [cooldownHours, setCooldownHours] = useState(exam.cooldownHours);
  const [passMarkPercent, setPassMarkPercent] = useState(exam.passMarkPercent);
  const [questionsShown, setQuestionsShown] = useState(exam.questionsShown);
  const [opensAt, setOpensAt] = useState(toDatetimeLocalValue(exam.opensAt));
  const [closesAt, setClosesAt] = useState(toDatetimeLocalValue(exam.closesAt));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const initialModuleName = modules.find((m) => m.id === exam.moduleId)?.title ?? "";
  useUnsavedChangesWarning(
    title !== exam.title ||
      moduleName !== initialModuleName ||
      durationMinutes !== exam.durationMinutes ||
      cooldownHours !== exam.cooldownHours ||
      passMarkPercent !== exam.passMarkPercent ||
      questionsShown !== exam.questionsShown ||
      opensAt !== toDatetimeLocalValue(exam.opensAt) ||
      closesAt !== toDatetimeLocalValue(exam.closesAt)
  );

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const moduleId = resolveModuleId(modules, moduleName);
    if (!moduleId) {
      setError(`No module named "${moduleName}" — pick one from the suggestions.`);
      return;
    }
    setPending(true);

    const res = await fetch(`/api/exams/${exam.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title,
        moduleId,
        durationMinutes,
        cooldownHours,
        passMarkPercent,
        questionsShown,
        opensAt: opensAt ? new Date(opensAt).toISOString() : null,
        closesAt: closesAt ? new Date(closesAt).toISOString() : null,
      }),
    });

    if (!res.ok) {
      setError("Could not save changes. Check the fields and try again.");
      setPending(false);
      return;
    }
    router.push("/teacher/exams");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="card set-card exam-form-card">
      <div className="field">
        <label htmlFor="title">Title</label>
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} required />
      </div>
      <ModuleField modules={modules} moduleName={moduleName} onChange={setModuleName} />
      <div className="field">
        <label htmlFor="duration">Duration (minutes)</label>
        <input
          id="duration"
          type="number"
          min={1}
          value={durationMinutes}
          onChange={(e) => setDurationMinutes(Number(e.target.value))}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="cooldown">Retake cooldown (hours)</label>
        <input
          id="cooldown"
          type="number"
          min={1}
          value={cooldownHours}
          onChange={(e) => setCooldownHours(Number(e.target.value))}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="passmark">Pass mark (%)</label>
        <input
          id="passmark"
          type="number"
          min={0}
          max={100}
          value={passMarkPercent}
          onChange={(e) => setPassMarkPercent(Number(e.target.value))}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="shown">Questions shown per attempt</label>
        <input
          id="shown"
          type="number"
          min={1}
          value={questionsShown}
          onChange={(e) => setQuestionsShown(Number(e.target.value))}
          required
        />
      </div>
      <div className="field">
        <label htmlFor="opensAt">Opens (optional)</label>
        <input id="opensAt" type="datetime-local" value={opensAt} onChange={(e) => setOpensAt(e.target.value)} />
      </div>
      <div className="field">
        <label htmlFor="closesAt">Closes (optional)</label>
        <input id="closesAt" type="datetime-local" value={closesAt} onChange={(e) => setClosesAt(e.target.value)} />
      </div>
      {error ? <div className="field-error">{error}</div> : null}
      <div className="form-actions">
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save changes"}
        </Button>
        <Button type="button" variant="ghost" onClick={() => router.push("/teacher/exams")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
