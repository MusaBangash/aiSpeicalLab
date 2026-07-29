import { initials } from "@/lib/initials";
import { RANK_AVATAR_RING, type RankName } from "@/lib/rank";

export function RankAvatar({ name, rank, size = 48 }: { name: string; rank: RankName; size?: number }) {
  return (
    <div
      className="me-avatar"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.35),
        boxShadow: `0 0 0 3px ${RANK_AVATAR_RING[rank]}`,
      }}
    >
      {initials(name)}
    </div>
  );
}
