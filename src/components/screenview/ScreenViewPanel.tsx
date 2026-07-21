"use client";

import { useCallback, useState } from "react";
import { LiveScreenViewer } from "./LiveScreenViewer";

export function ScreenViewPanel({ studentId }: { studentId: string }) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/screen-view/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId }),
    });
    setBusy(false);
    const data = await res.json();
    if (!res.ok) {
      setError(data.error ?? "Could not start viewing");
      return;
    }
    setSessionId(data.sessionId);
  }

  async function saveSession() {
    if (!sessionId) return;
    setBusy(true);
    const res = await fetch(`/api/screen-view/${sessionId}/save`, { method: "POST" });
    setBusy(false);
    if (res.ok) setSaving(true);
  }

  const stop = useCallback(async () => {
    if (!sessionId) return;
    await fetch(`/api/screen-view/${sessionId}/end`, { method: "POST" }).catch(() => {});
    setSessionId(null);
    setSaving(false);
  }, [sessionId]);

  if (!sessionId) {
    return (
      <div className="screenview-panel">
        <button className="btn" onClick={start} disabled={busy}>
          {busy ? "Starting…" : "View screen"}
        </button>
        {error ? <div className="screenview-error">{error}</div> : null}
      </div>
    );
  }

  return (
    <div className="screenview-panel">
      <LiveScreenViewer sessionId={sessionId} onEnded={stop} />
      <div className="screenview-actions">
        {saving ? (
          <span className="screenview-badge rec">● Recording — saved permanently</span>
        ) : (
          <button className="btn" onClick={saveSession} disabled={busy}>
            Save this session
          </button>
        )}
        <button className="btn ghost" onClick={stop}>
          Stop viewing
        </button>
      </div>
    </div>
  );
}
