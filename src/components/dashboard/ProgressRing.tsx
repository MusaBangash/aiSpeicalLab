"use client";

import { useEffect, useState } from "react";

const RADIUS = 50;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ProgressRing({ percent }: { percent: number }) {
  const [display, setDisplay] = useState(0);
  const [offset, setOffset] = useState(CIRCUMFERENCE);

  useEffect(() => {
    const t = setTimeout(() => {
      setOffset(CIRCUMFERENCE * (1 - percent / 100));
      const start = performance.now();
      const dur = 1200;
      function step(ts: number) {
        const p = Math.min((ts - start) / dur, 1);
        setDisplay(Math.round(percent * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }, 120);
    return () => clearTimeout(t);
  }, [percent]);

  return (
    <div className="ring-wrap">
      <svg width="118" height="118" viewBox="0 0 118 118">
        <circle cx="59" cy="59" r={RADIUS} fill="none" stroke="#FBEED3" strokeWidth="11" />
        <circle
          cx="59"
          cy="59"
          r={RADIUS}
          fill="none"
          stroke="#E8A317"
          strokeWidth="11"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 59 59)"
          style={{ transition: "stroke-dashoffset 1.3s cubic-bezier(.2,.7,.3,1)" }}
        />
      </svg>
      <div className="ring-num">
        <span className="n">{display}%</span>
        <span className="l">Complete</span>
      </div>
    </div>
  );
}
