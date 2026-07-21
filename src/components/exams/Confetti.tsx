"use client";

import { useEffect, useState } from "react";

const COLORS = ["#E8A317", "#B97B0C", "#1B4D3E", "#2E7D5B", "#F5C860"];

export function Confetti() {
  const [pieces, setPieces] = useState<{ left: number; top: number; color: string; duration: number; delay: number }[]>([]);

  useEffect(() => {
    setPieces(
      Array.from({ length: 70 }, () => ({
        left: Math.random() * 100,
        top: -10 - Math.random() * 20,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        duration: 2.2 + Math.random() * 2,
        delay: Math.random() * 0.8,
      }))
    );
    const t = setTimeout(() => setPieces([]), 5000);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="confetti">
      {pieces.map((p, i) => (
        <div
          key={i}
          className="cf"
          style={{
            left: `${p.left}vw`,
            top: `${p.top}vh`,
            background: p.color,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
