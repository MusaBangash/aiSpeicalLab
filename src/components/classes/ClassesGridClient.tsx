"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { ClassSummary } from "@/lib/classes";

export function ClassesGridClient({ classes }: { classes: ClassSummary[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function createClass(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const res = await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    setSaving(false);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not create class");
      return;
    }
    setName("");
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={createClass} className="journal-entry-form" style={{ marginBottom: 16 }}>
        <input
          placeholder="Class name (e.g. Evening Batch A)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={saving}
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn" disabled={saving || !name.trim()}>
          {saving ? "Creating…" : "Create class"}
        </button>
      </form>
      {error ? <div className="screenview-error" style={{ marginBottom: 12 }}>{error}</div> : null}

      {classes.length === 0 ? (
        <div className="card" style={{ padding: 24 }}>
          No classes yet — create one above to get started.
        </div>
      ) : (
        <div className="mod-grid">
          {classes.map((c) => (
            <Link
              key={c.id}
              href={`/teacher/classes/${c.id}`}
              className="card mod-card"
              style={{ textDecoration: "none", color: "inherit" }}
            >
              <div className="mod-head">
                <div className="mod-title">{c.name}</div>
              </div>
              <div className="mod-meta">
                <span>{c.activeStudentCount} student{c.activeStudentCount === 1 ? "" : "s"}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
