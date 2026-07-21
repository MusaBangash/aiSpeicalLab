"use client";

import { useState } from "react";
import { Card } from "@/components/ui/Card";
import { JournalEntryCard, type JournalEntryCardData } from "./JournalEntryCard";

export function JournalHistoryList({ entries }: { entries: JournalEntryCardData[] }) {
  const [showHistory, setShowHistory] = useState(false);
  const activeEntries = entries.filter((e) => e.status === "ACTIVE");
  const hiddenCount = entries.length - activeEntries.length;
  const visible = showHistory ? entries : activeEntries;

  return (
    <div>
      {hiddenCount > 0 ? (
        <button type="button" className="btn ghost" style={{ marginBottom: 12 }} onClick={() => setShowHistory((v) => !v)}>
          {showHistory ? "Hide retracted/edited entries" : `Show retracted/edited entries (${hiddenCount})`}
        </button>
      ) : null}
      <div className="prog-rows">
        {visible.length === 0 ? (
          <Card style={{ padding: 20 }}>No entries yet.</Card>
        ) : (
          visible.map((entry) => <JournalEntryCard key={entry.id} entry={entry} />)
        )}
      </div>
    </div>
  );
}
