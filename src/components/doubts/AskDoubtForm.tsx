"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ModuleField, resolveModuleId } from "@/components/exams/ModuleField";

export function AskDoubtForm({ modules }: { modules: { id: string; title: string }[] }) {
  const router = useRouter();
  const [moduleName, setModuleName] = useState(modules[0]?.title ?? "");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const moduleId = resolveModuleId(modules, moduleName);
    if (!moduleId) {
      setError(`No module named "${moduleName}" — pick one from the suggestions.`);
      return;
    }
    setPending(true);

    const res = await fetch("/api/doubts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ moduleId, body }),
    });
    setPending(false);
    if (!res.ok) {
      setError("Could not submit the question. Check the fields and try again.");
      return;
    }
    setBody("");
    router.refresh();
  }

  return (
    <form
      onSubmit={onSubmit}
      className="card"
      style={{ padding: "var(--space-5)", marginBottom: "var(--space-6)", display: "flex", flexDirection: "column", gap: "var(--space-3)" }}
    >
      <ModuleField modules={modules} moduleName={moduleName} onChange={setModuleName} />
      <textarea
        value={body}
        onChange={(e) => setBody(e.target.value)}
        placeholder="What are you stuck on?"
        rows={3}
        disabled={pending}
        required
      />
      {error ? <div className="field-error">{error}</div> : null}
      <button type="submit" className="btn" disabled={pending} style={{ alignSelf: "flex-start" }}>
        {pending ? "Submitting…" : "Ask"}
      </button>
    </form>
  );
}
