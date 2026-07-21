"use client";

import { useEffect, useState } from "react";
import { Icon } from "@/components/shell/Icon";

const FLAG_KEY = "stlab-attendance-toast";
const AUTO_DISMISS_MS = 5000;

const STATUS_LABEL: Record<string, string> = {
  PRESENT: "Present",
  LATE: "Late",
  ABSENT: "Absent",
  EXCUSED: "Excused",
};

export function AttendanceToast() {
  const [info, setInfo] = useState<{ status: string; checkedInAt: string } | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem(FLAG_KEY) !== "pending") return;
    sessionStorage.removeItem(FLAG_KEY); // clear immediately — never re-fire, even on a Strict-Mode double-invoke

    fetch("/api/attendance/today")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.checkedInAt && data?.status) setInfo({ status: data.status, checkedInAt: data.checkedInAt });
      })
      .catch(() => {
        // A toast failing must never surface as a page error — swallow.
      });
  }, []);

  useEffect(() => {
    if (!info) return;
    const timer = setTimeout(() => setInfo(null), AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [info]);

  if (!info) return null;

  const time = new Date(info.checkedInAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
  const date = new Date(info.checkedInAt).toLocaleDateString("en-GB", { day: "numeric", month: "short" });

  return (
    <div className="toast-stack">
      <div className="card toast" role="status" aria-live="polite">
        <div className="toast-icon">
          <Icon name="check" size={14} />
        </div>
        <div className="toast-body">
          <div className="toast-title">Attendance marked</div>
          <div className="toast-sub">
            {STATUS_LABEL[info.status] ?? info.status} · {date} at {time}
          </div>
        </div>
        <button className="toast-close" aria-label="Dismiss" onClick={() => setInfo(null)}>
          <Icon name="close" size={14} />
        </button>
      </div>
    </div>
  );
}
