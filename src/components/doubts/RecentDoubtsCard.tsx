import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { DoubtHistoryCard } from "@/components/doubts/DoubtHistoryCard";
import type { DoubtRow } from "@/lib/doubts";

const RECENT_COUNT = 5;

export function RecentDoubtsCard({ doubts, viewAllHref }: { doubts: DoubtRow[]; viewAllHref: string }) {
  const recent = doubts.slice(0, RECENT_COUNT);

  return (
    <Card className="feed-card" style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div className="feed-title" style={{ marginBottom: 0 }}>
          Recent questions
        </div>
        <Link href={viewAllHref} style={{ fontSize: 13 }}>
          View all
        </Link>
      </div>
      {recent.length === 0 ? (
        <div className="feed-empty">No questions asked yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
          {recent.map((d) => (
            <DoubtHistoryCard key={d.id} doubt={d} />
          ))}
        </div>
      )}
    </Card>
  );
}
