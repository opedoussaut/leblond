import { Crown, Flame, Scale } from "lucide-react";
import type { Standing } from "@/lib/analytics/alter-ego";
import { cn } from "@/components/ui/cn";

/**
 * The duel's standing as a medal: a gold crown when you lead, a silver scale
 * when level, an ember flame when the rival leads (the chase is on). The label
 * always says it in words too, so nothing depends on the colour or the icon.
 */
const MEDALS = {
  ahead: { Icon: Crown, face: "from-[#fff1b8] via-[#f2c94c] to-[#b8860b]", ring: "ring-[#f2c94c]/60", glow: "shadow-[0_0_28px_rgba(242,201,76,0.45)]", ink: "text-[#5c4300]" },
  level: { Icon: Scale, face: "from-[#ffffff] via-[#dbe4ee] to-[#8fa3b8]", ring: "ring-white/60", glow: "shadow-[0_0_24px_rgba(219,228,238,0.40)]", ink: "text-[#2f4256]" },
  behind: { Icon: Flame, face: "from-[#ffd9b8] via-[#ff9f5a] to-[#d4541c]", ring: "ring-[#ff9f5a]/60", glow: "shadow-[0_0_28px_rgba(255,159,90,0.45)]", ink: "text-[#5a1d00]" },
} as const;

export function StandingMedal({ state, label, size = 64, className }: {
  state: Standing["state"]; label: string; size?: number; className?: string;
}) {
  const m = MEDALS[state];
  return <span role="img" aria-label={label} data-standing={state}
    className={cn("inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br ring-4", m.face, m.ring, m.glow, className)}
    style={{ width: size, height: size }}>
    <m.Icon aria-hidden="true" className={m.ink} style={{ width: size * 0.5, height: size * 0.5 }} strokeWidth={2.1} />
  </span>;
}
