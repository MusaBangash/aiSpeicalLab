"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { ModuleField, resolveModuleId } from "./ModuleField";
import { useUnsavedChangesWarning } from "@/lib/useUnsavedChangesWarning";

const DEFAULT_DURATION = 30;
const DEFAULT_COOLDOWN = 24;
const DEFAULT_PASS_MARK = 82;
const DEFAULT_QUESTIONS_SHOWN = 8;

export function CreateExamForm({ modules }: { modules: { id: string; title: string }[] }) {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [moduleName, setModuleName] = useState(modules[0]?.title ?? "");
  const [durationMinutes, setDurationMinutes] = useState(DEFAULT_DURATION);
  const [cooldownHours, setCooldownHours] = useState(DEFAULT_COOLDOWN);
  const [passMarkPercent, setPassMarkPercent] = useState(DEFAULT_PASS_MARK);
  const [questionsShown, setQuestionsShown] = useState(DEFAULT_QUESTIONS_SHOWN);
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useUnsavedChangesWarning(
    title !== "" ||
      moduleName !== (modules[0]?.title ?? "") ||
      durationMinutes !== DEFAULT_DURATION ||
      cooldownHours !== DEFAULT_COOLDOWN ||
      passMarkPercent !== DEFAULT_PASS_MARK ||
      questionsShown !== DEFAULT_QUESTIONS_SHOWN ||
      opensAt !== "" ||
      closesAt !== ""
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

    const res = await fetch("/api/exams", {
      method: "POST",
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
      setError("Could not create the exam. Check the fields and try again.");
      setPending(false);
      return;
    }
    const exam = await res.json();
    // A fresh DRAFT always needs its question bank built next.
    router.push(`/teacher/exams/${exam.id}/questions`);
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
      <Button type="submit" disabled={pending}>
        {pending ? "Creating…" : "Create exam"}
      </Button>
    </form>
  );
}
