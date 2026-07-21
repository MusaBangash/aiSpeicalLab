"use client";

import { useState } from "react";

export type RecordingFrame = { id: string; capturedAt: string };

export function RecordingSlideshow({ recordingId, frames }: { recordingId: string; frames: RecordingFrame[] }) {
  const [index, setIndex] = useState(0);

  if (frames.length === 0) {
    return <div className="card" style={{ padding: 20 }}>No frames were captured for this recording.</div>;
  }

  const frame = frames[index];

  return (
    <div className="screenview-slideshow">
      <img
        src={`/api/screen-view/recordings/${recordingId}/frames/${frame.id}`}
        alt={`Frame ${index + 1} of ${frames.length}`}
      />
      <div className="screenview-slideshow-controls">
        <button className="btn ghost" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
          ← Prev
        </button>
        <span>
          Frame {index + 1} / {frames.length} ·{" "}
          {new Date(frame.capturedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
        </span>
        <button className="btn ghost" disabled={index === frames.length - 1} onClick={() => setIndex((i) => i + 1)}>
          Next →
        </button>
      </div>
    </div>
  );
}
