"use client";

import { useState } from "react";
import Link from "next/link";
import { Chip } from "@/components/ui/Chip";
import { Icon } from "@/components/shell/Icon";
import type { StudentRankStatus } from "@/lib/rank";

export function RankLadderCard({
  status,
  certificateHref,
}: {
  status: StudentRankStatus;
  certificateHref?: string;
}) {
  const [showLadder, setShowLadder] = useState(false);
  const { tenureMonths, points, rank } = status;
  const nextRankMinPoints =
    rank.nextRank !== null ? points.total + (rank.pointsToNextRank ?? 0) : null;
  const progressPercent =
    nextRankMinPoints && nextRankMinPoints > 0 ? Math.min(100, (points.total / nextRankMinPoints) * 100) : 100;

  return (
    <div>
      <div className="rank-header">
        <div className="rank-shield">
          <Icon name="shield" size={22} />
        </div>
        <div>
          <div className="rank-title">{rank.currentRank}</div>
          <div className="rank-sub">
            {points.total} pts · {tenureMonths} months tenure
          </div>
        </div>
        {certificateHref ? (
          <Link href={certificateHref} style={{ marginLeft: "auto", fontSize: 12 }}>
            View certificate
          </Link>
        ) : null}
      </div>

      {rank.nextRank ? (
        <>
          <div className="bar">
            <div className="bar-fill" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="rank-next-caption">
            {rank.pointsToNextRank} pts to {rank.nextRank}
            {rank.monthsToNextTenure && rank.monthsToNextTenure > 0
              ? ` · +${rank.monthsToNextTenure} more months tenure`
              : ""}
            {!rank.nextRankExtraGateMet && rank.nextRankExtraGateLabel
              ? ` · Requires: ${rank.nextRankExtraGateLabel}`
              : ""}
          </div>
        </>
      ) : (
        <Chip variant="done">Top rank achieved</Chip>
      )}

      <div className="rank-points-breakdown">
        <div className="rpb-row">
          <div className="rpb-val">{points.examPoints}</div>
          <div className="rpb-label">Exams</div>
          <div className="rpb-rule">10 pts / passed</div>
        </div>
        <div className="rpb-row">
          <div className="rpb-val">{points.attendancePoints}</div>
          <div className="rpb-label">Attendance</div>
          <div className="rpb-rule">1 pt / 2 days present</div>
        </div>
        <div className="rpb-row">
          <div className="rpb-val">{points.journalPoints}</div>
          <div className="rpb-label">Journal</div>
          <div className="rpb-rule">5 pts / high rating</div>
        </div>
        <div className="rpb-row">
          <div className="rpb-val">{points.badgePoints}</div>
          <div className="rpb-label">Badges</div>
          <div className="rpb-rule">20 pts / badge</div>
        </div>
        <div className="rpb-row">
          <div className="rpb-val">{points.starPoints}</div>
          <div className="rpb-label">Stars</div>
          <div className="rpb-rule">1 pt / star</div>
        </div>
      </div>

      <button type="button" className="rank-ladder-toggle" onClick={() => setShowLadder((v) => !v)}>
        {showLadder ? "Hide" : "Show"} full rank ladder
      </button>
      {showLadder ? (
        <div className="rank-ladder-strip">
          {rank.ladder.map((entry, i) => (
            <Chip
              key={entry.rank}
              variant={entry.achieved ? "done" : i === rank.currentRankIndex + 1 ? "active" : "locked"}
            >
              {entry.rank}
            </Chip>
          ))}
        </div>
      ) : null}
    </div>
  );
}
