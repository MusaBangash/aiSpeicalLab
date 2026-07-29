import { Card } from "@/components/ui/Card";

export type DnaHighlight = { label: string; value: string; color?: string };

/** Narrative paragraph + stat-highlights row synthesizing exam/attendance/
 *  doubts/rank signals into one story — the "AI Learning DNA" vision's
 *  original composite-profile ask. Reuses the .legend/.lg classes already
 *  used for the attendance-heatmap legend — no new CSS. */
export function DnaSummaryCard({ summary, highlights }: { summary: string; highlights: DnaHighlight[] }) {
  return (
    <Card className="feed-card" style={{ marginBottom: "var(--space-6)" }}>
      <div className="feed-title">Learning DNA</div>
      <p style={{ fontSize: "var(--text-md)", lineHeight: 1.6, margin: "var(--space-1) 0 var(--space-3)" }}>{summary}</p>
      <div className="legend">
        {highlights.map((h) => (
          <span className="lg" key={h.label}>
            <i style={{ background: h.color ?? "var(--gold)" }} />
            {h.label}: {h.value}
          </span>
        ))}
      </div>
    </Card>
  );
}
