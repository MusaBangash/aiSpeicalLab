"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/shell/Icon";

const WARN_THRESHOLD_MS = 5 * 60 * 1000;

function format(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`;
}

/**
 * Ticks off the server's `expiresAt` using the CLIENT's clock, for display
 * only — a skewed client clock can never grant extra time, because the
 * server independently rejects any /answer or /finish call made after its
 * own `expiresAt` (see src/lib/exam.ts). This is purely the on-screen
 * countdown.
 */
export function Timer({ expiresAt, onExpire }: { expiresAt: string; onExpire: () => void }) {
  const [remaining, setRemaining] = useState(() => new Date(expiresAt).getTime() - Date.now());
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      setRemaining(ms);
      if (ms <= 0 && !expired) {
        setExpired(true);
        clearInterval(id);
        onExpire();
      }
    }, 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expiresAt]);

  const warn = remaining <= WARN_THRESHOLD_MS;

  return (
    <div className={"timer" + (warn ? " warn" : "")}>
      <span className="ic">
        <Icon name="clock" size={18} />
      </span>
      <span className="t">{format(remaining)}</span>
    </div>
  );
}
