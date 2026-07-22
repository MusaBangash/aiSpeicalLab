"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/shell/Icon";

const FLAG_KEY = "stlab-messages-toast";
const AUTO_DISMISS_MS = 5000;

export function UnreadMessagesToast() {
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem(FLAG_KEY) !== "pending") return;
    sessionStorage.removeItem(FLAG_KEY); // clear immediately — never re-fire, even on a Strict-Mode double-invoke

    fetch("/api/messages/unread-count")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (typeof data?.count === "number" && data.count > 0) setCount(data.count);
      })
      .catch(() => {
        // A toast failing must never surface as a page error — swallow.
      });
  }, []);

  useEffect(() => {
    if (count === null) return;
    const timer = setTimeout(() => setCount(null), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [count]);

  if (count === null) return null;

  return (
    <div className="card toast" role="status" aria-live="polite">
      <div className="toast-icon">
        <Icon name="megaphone" size={14} />
      </div>
      <div className="toast-body">
        <div className="toast-title">
          {count} new announcement{count === 1 ? "" : "s"}
        </div>
        <div className="toast-sub">
          <Link href="/student/messages">View inbox</Link>
        </div>
      </div>
      <button className="toast-close" aria-label="Dismiss" onClick={() => setCount(null)}>
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
