import { JournalEntryCard, type JournalEntryCardData } from "./JournalEntryCard";

export function JournalTimeline({ entries }: { entries: JournalEntryCardData[] }) {
  const active = entries.filter((e) => e.status === "ACTIVE");
  if (active.length === 0) return <div className="feed-empty">No journal entries yet.</div>;
  return (
    <div className="jt-timeline">
      {active.map((entry) => (
        <div key={entry.id} className="jt-row">
          <div className="jt-rail">
            <span className="jt-dot" />
          </div>
          <div className="jt-content">
            <JournalEntryCard entry={entry} />
          </div>
        </div>
      ))}
    </div>
  );
}
