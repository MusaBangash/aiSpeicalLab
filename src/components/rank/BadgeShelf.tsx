import { Icon } from "@/components/shell/Icon";
import type { BadgeShelfItem } from "@/lib/badges";

export function BadgeShelf({ badges }: { badges: BadgeShelfItem[] }) {
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
        </div>
      ))}
    </div>
  );
}
