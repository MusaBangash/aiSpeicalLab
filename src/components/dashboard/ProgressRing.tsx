"use client";

import { useEffect, useState } from "react";

const DEFAULT_SIZE = 118;
const STROKE_WIDTH = 11;

export function ProgressRing({
  percent,
  label = "Complete",
  color = "#E8A317",
  trackColor = "#FBEED3",
  size = DEFAULT_SIZE,
}: {
  percent: number;
  label?: string;
  color?: string;
  trackColor?: string;
  size?: number;
}) {
  const radius = size / 2 - STROKE_WIDTH;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const [display, setDisplay] = useState(0);
  const [offset, setOffset] = useState(circumference);

  useEffect(() => {
    const t = setTimeout(() => {
      setOffset(circumference * (1 - percent / 100));
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
  }, [percent, circumference]);

  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={center} cy={center} r={radius} fill="none" stroke={trackColor} strokeWidth={STROKE_WIDTH} />
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: "stroke-dashoffset 1.3s cubic-bezier(.2,.7,.3,1)" }}
        />
      </svg>
      <div className="ring-num">
        <span className="n">{display}%</span>
        <span className="l">{label}</span>
      </div>
    </div>
  );
}
