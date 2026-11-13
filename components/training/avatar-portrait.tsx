import { AVATAR_LEVELS, type AvatarColour } from "@/lib/analytics/avatar";

/** Ring colour of each avatar level (also used for the pillar chips). */
export const AVATAR_RING: Record<AvatarColour, string> = {
  WHITE: "#C9D1DC", YELLOW: "#F2B705", ORANGE: "#EA7A26", GREEN: "#4CAF50", VIOLET: "#8A5CD6", BLUE: "#2F7FDB", BLACK: "#1C2230",
};

/**
 * The climber's avatar: the same framing, size and crop for all seven levels
 * (static 256 px WebP files in public/brand/avatar), with a ring in the
 * level's colour drawn here so it stays sharp at every size.
 */
export function AvatarPortrait({ level, size = 56, label }: { level: number; size?: number; label?: string }) {
  const colour = AVATAR_LEVELS[Math.max(0, Math.min(AVATAR_LEVELS.length - 1, level))]!;
  const ring = Math.max(2, Math.round(size / 18));
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a tiny static image; next/image adds nothing here.
    <img src={`/brand/avatar/${colour.toLowerCase()}.webp`} width={size} height={size} alt={label ?? ""} aria-hidden={label ? undefined : true}
      loading="lazy" decoding="async" draggable={false} data-avatar={colour}
      className="shrink-0 rounded-full bg-[#9DB0CB] object-cover"
      style={{ boxShadow: `0 0 0 ${ring}px ${AVATAR_RING[colour]}` }} />
  );
}
