import Link from "next/link";
import { Icon } from "@/components/shell/Icon";
import type { BadgeShelfItem } from "@/lib/badges";

export function BadgeShelf({
  badges,
  certificateBaseHref,
}: {
  badges: BadgeShelfItem[];
  certificateBaseHref?: string;
}) {
  return (
    <div className="badge-grid">
      {badges.map((badge) => (
        <div key={badge.type} className={"badge-tile " + (badge.earned ? "earned" : "locked")}>
          <div className="badge-tile-icon">
            <Icon name={badge.earned ? badge.icon : "lock"} size={20} />
          </div>
          <div className="badge-tile-label">{badge.label}</div>
          <div className="badge-tile-desc">{badge.description}</div>
          {badge.earned && badge.earnedAt ? (
            <div className="badge-tile-date">
              {badge.earnedAt.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
            </div>
          ) : null}
          {badge.earned && certificateBaseHref ? (
            <Link href={`${certificateBaseHref}/badge/${badge.type}`} style={{ fontSize: 12 }}>
              View certificate
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );
}
