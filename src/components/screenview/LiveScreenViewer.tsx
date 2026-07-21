"use client";

import { useEffect, useRef, useState } from "react";

const POLL_MS = 1500;
const STALE_AFTER_MISSES = 4; // ~6s with no frame -> "no signal"

export function LiveScreenViewer({ sessionId, onEnded }: { sessionId: string; onEnded: () => void }) {
  const [imgUrl, setImgUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<"connecting" | "live" | "stale" | "ended">("connecting");
  const misses = useRef(0);
  const lastUrl = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;

    async function poll() {
      try {
        const res = await fetch(`/api/screen-view/${sessionId}/live`, { cache: "no-store" });
        if (cancelled) return;

        if (res.status === 410) {
          setStatus("ended");
          onEnded();
          return; // stop polling — session is over server-side
        }
        if (res.ok) {
          misses.current = 0;
          const blob = await res.blob();
          const url = URL.createObjectURL(blob);
          if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
          lastUrl.current = url;
          setImgUrl(url);
          setStatus("live");
        } else {
          misses.current += 1; // 202 "waiting" or a transient error
        }
        if (misses.current >= STALE_AFTER_MISSES) setStatus("stale");
      } catch {
        misses.current += 1;
        if (misses.current >= STALE_AFTER_MISSES) setStatus("stale");
      } finally {
        if (!cancelled) timer = setTimeout(poll, POLL_MS);
      }
    }

    poll();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      if (lastUrl.current) URL.revokeObjectURL(lastUrl.current);
    };
  }, [sessionId, onEnded]);

  return (
    <div className="screenview-frame">
      {imgUrl ? <img src={imgUrl} alt="Live student screen" /> : <div className="screenview-placeholder">Connecting…</div>}
      {status === "stale" && <div className="screenview-badge warn">No signal — no frame recently</div>}
      {status === "ended" && <div className="screenview-badge">Session ended</div>}
    </div>
  );
}
