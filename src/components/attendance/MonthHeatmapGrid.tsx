import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { mondayIndex } from "@/lib/attendance";
import type { MonthCell } from "@/lib/attendance";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function MonthHeatmapGrid({
  year,
  month,
  cells,
}: {
  year: number;
  month: number;
  cells: MonthCell[];
}) {
  const startPad = mondayIndex(new Date(year, month, 1));
  return (
    <Card className="heat-card">
      <div className="rc-title">
        {MONTH_NAMES[month]} {year}
      </div>
      <div className="heat-grid">
        {DAY_LABELS.map((l, i) => (
          <div key={i} className="heat-day">
            {l}
          </div>
        ))}
        {Array.from({ length: startPad }, (_, i) => (
          <div key={"pad" + i} />
        ))}
        {cells.map((c) =>
          c.href ? (
            <Link key={c.day} href={c.href} className={c.className}>
              {c.day}
            </Link>
          ) : (
            <div key={c.day} className={c.className}>
              {c.day}
            </div>
          )
        )}
      </div>
    </Card>
  );
}
