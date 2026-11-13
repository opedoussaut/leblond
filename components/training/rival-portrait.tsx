import type { RivalPortrait as Portrait } from "@/lib/analytics/rival";

/*
 * LEBLOND's own drawn rival portraits: flat, geometric heads in the app's
 * palette. No photo, no real person. Each one differs by skin, hair and a
 * climbing detail (cap, headband, beanie, chalk bag strap).
 */
type Look = { skin: string; hair: string; bg: string; style: "short" | "bun" | "cap" | "band" | "beanie" | "curly" };
const LOOKS: Record<Portrait, Look> = {
  p1: { skin: "#E8B48F", hair: "#2B2118", bg: "#DCE9F7", style: "short" },
  p2: { skin: "#C98B62", hair: "#1B1410", bg: "#F6E3D3", style: "bun" },
  p3: { skin: "#F2C9A6", hair: "#B8642E", bg: "#E1F0E6", style: "cap" },
  p4: { skin: "#8D5A3B", hair: "#120D0A", bg: "#EDE4F7", style: "curly" },
  p5: { skin: "#EDC1A0", hair: "#E0C17A", bg: "#FCEFD6", style: "band" },
  p6: { skin: "#A86F4C", hair: "#2E2A28", bg: "#DDEFF2", style: "beanie" },
};

export function RivalPortrait({ portrait, size = 56, label }: { portrait: Portrait; size?: number; label?: string }) {
  const l = LOOKS[portrait];
  return <svg viewBox="0 0 64 64" width={size} height={size} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}
    className="shrink-0 rounded-full">
    <rect width="64" height="64" rx="32" fill={l.bg} />
    {/* shoulders and t-shirt */}
    <path d="M10 64c2-12 11-18 22-18s20 6 22 18z" fill="#1F6FC5" />
    <path d="M26 47l6 7 6-7" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
    {/* neck and head */}
    <rect x="27" y="36" width="10" height="10" rx="3" fill={l.skin} />
    <ellipse cx="32" cy="27" rx="12" ry="13.5" fill={l.skin} />
    {/* eyes and mouth */}
    <circle cx="27.5" cy="28" r="1.4" fill="#10233F" />
    <circle cx="36.5" cy="28" r="1.4" fill="#10233F" />
    <path d="M28.5 34c2 1.6 5 1.6 7 0" fill="none" stroke="#10233F" strokeWidth="1.5" strokeLinecap="round" />
    {l.style === "short" ? <path d="M20 25c0-9 6-13 12-13s12 4 12 13c-3-4-7-6-12-6s-9 2-12 6z" fill={l.hair} /> : null}
    {l.style === "bun" ? <>
      <circle cx="32" cy="11" r="5" fill={l.hair} />
      <path d="M20 26c0-9 5-14 12-14s12 5 12 14c-2-5-6-8-12-8s-10 3-12 8z" fill={l.hair} />
    </> : null}
    {l.style === "cap" ? <>
      <path d="M19 23c0-8 6-12 13-12s13 4 13 12z" fill="#E4572E" />
      <path d="M32 22h17c0 2-2 3-4 3H32z" fill="#C2410C" />
    </> : null}
    {l.style === "curly" ? <g fill={l.hair}>
      {[[22, 18], [27, 14], [32, 13], [37, 14], [42, 18], [20, 23], [44, 23]].map(([x, y]) => <circle key={`${x}-${y}`} cx={x} cy={y} r="4.5" />)}
    </g> : null}
    {l.style === "band" ? <>
      <path d="M20 26c0-9 6-14 12-14s12 5 12 14c-3-5-7-7-12-7s-9 2-12 7z" fill={l.hair} />
      <rect x="20" y="20" width="24" height="3.5" rx="1.75" fill="#14B8A6" />
    </> : null}
    {l.style === "beanie" ? <>
      <path d="M19 24c0-8 6-13 13-13s13 5 13 13z" fill="#10233F" />
      <rect x="19" y="21" width="26" height="4" rx="2" fill="#334E73" />
      <circle cx="32" cy="10" r="2.5" fill="#334E73" />
    </> : null}
  </svg>;
}
