"use client";

import { useEffect, useRef, useState } from "react";
import { initials } from "@/lib/initials";
import { ScreenViewPanel } from "@/components/screenview/ScreenViewPanel";
import type { ClassActivityStudent } from "@/lib/activity";

const POLL_MS = 12000;
const STALE_AFTER_MISSES = 3;

export function ClassLivePanel({
  classId,
  initialStudents,
}: {
  classId: string;
  initialStudents: ClassActivityStudent[];
}) {
  const [students, setStudents] = useState(initialStudents);
  const [stale, setStale] = useState(false);
  const misses = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/classes/${classId}/activity`, { cache: "no-store" });
        if (cancelled) return;
        if (res.ok) {
          misses.current = 0;
          setStale(false);
          const data = await res.json();
          setStudents(data.students);
        } else {
          misses.current += 1;
        }
      } catch {
        misses.current += 1;
      } finally {
        if (misses.current >= STALE_AFTER_MISSES) setStale(true);
        if (!cancelled) timer = setTimeout(poll, POLL_MS);
      }
    }

    timer = setTimeout(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [classId]);

  if (students.length === 0) {
    return <div className="card" style={{ padding: 20 }}>No students enrolled yet.</div>;
  }

  return (
    <div>
      {stale ? (
        <div style={{ fontSize: 12.5, color: "var(--coral)", marginBottom: 12 }}>Live status may be out of date</div>
      ) : null}
      <div className="mod-grid">
        {students.map((s) => (
          <div key={s.studentId} className="card mod-card">
            <div className="mod-head">
              <div className="me-avatar">{initials(s.name)}</div>
              <span className="status-dot" style={{ background: s.online ? "var(--leaf-soft)" : "var(--line-2)" }} />
            </div>
            <div className="mod-title">{s.name}</div>
            <div className="mod-meta">
              {s.online && s.current ? (
                <span>
                  {s.current.appName} — {s.current.windowTitle || "(no title)"} · {s.current.idle ? "Idle" : "Active"}
                </span>
              ) : (
                <span>Offline</span>
              )}
            </div>
            <ScreenViewPanel studentId={s.studentId} />
          </div>
        ))}
      </div>
    </div>
  );
}
