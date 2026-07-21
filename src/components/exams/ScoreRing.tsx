"use client";

import { useEffect, useState } from "react";

const RADIUS = 82;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export function ScoreRing({ scorePercent, passed }: { scorePercent: number; passed: boolean }) {
  const [display, setDisplay] = useState(0);
  const [offset, setOffset] = useState(CIRCUMFERENCE);

  useEffect(() => {
    const t = setTimeout(() => {
      setOffset(CIRCUMFERENCE * (1 - scorePercent / 100));
      const start = performance.now();
      const dur = 1300;
      function step(ts: number) {
        const p = Math.min((ts - start) / dur, 1);
        setDisplay(Math.round(scorePercent * (1 - Math.pow(1 - p, 3))));
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }, 150);
    return () => clearTimeout(t);
  }, [scorePercent]);

  return (
    <div className="score-ring">
      <svg width="190" height="190" viewBox="0 0 190 190">
        <circle cx="95" cy="95" r={RADIUS} fill="none" stroke="var(--gold-mist)" strokeWidth="14" />
        <circle
          cx="95"
          cy="95"
          r={RADIUS}
          fill="none"
          stroke={passed ? "var(--leaf-mid)" : "var(--coral)"}
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={offset}
          transform="rotate(-90 95 95)"
          style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(.2,.7,.3,1)" }}
        />
      </svg>
      <div className="n">
        <b>{display}%</b>
        <span>Your score</span>
      </div>
    </div>
  );
}
