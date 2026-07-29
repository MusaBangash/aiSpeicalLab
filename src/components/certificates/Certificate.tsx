"use client";

import { Button } from "@/components/ui/Button";

export function Certificate({
  labName,
  studentName,
  achievementTitle,
  dateLabel,
  date,
}: {
  labName: string | null;
  studentName: string;
  achievementTitle: string;
  dateLabel: string;
  date: string;
}) {
  return (
    <>
      <div className="card no-print" style={{ padding: 14, marginBottom: 16 }}>
        <Button type="button" variant="ghost" onClick={() => window.print()}>
          Print certificate
        </Button>
      </div>

      <div className="print-only certificate">
        <div className="certificate-frame">
          <div className="certificate-lab">{labName ?? "STLab"}</div>
          <div className="certificate-kicker">Certificate of Achievement</div>
          <div className="certificate-line">This certifies that</div>
          <div className="certificate-name">{studentName}</div>
          <div className="certificate-achievement">{achievementTitle}</div>
          <div className="certificate-date">
            {dateLabel}: {date}
          </div>
        </div>
      </div>
    </>
  );
}
