import { cn } from "@/components/ui/cn";
import { IconCheck, IconFlash, IconStar, IconTry } from "@/components/ui/icons";

/**
 * One visual language for climbing outcomes, used in both loggers, lists and
 * summaries: flash / onsight in orange (lightning), top / redpoint in blue
 * (check), project in fuchsia (star). The icon and the text always accompany
 * the colour. `symbol` is the same mark as text, for places that take no icon
 * (a dropdown option).
 */
export type ResultTone = "flash" | "top" | "rest" | "attempt" | "project";

export const RESULT_TONES: Record<ResultTone, { bg: string; fg: string; symbol: string }> = {
  flash: { bg: "#F97316", fg: "#ffffff", symbol: "⚡" },
  top: { bg: "#2563EB", fg: "#ffffff", symbol: "✓" },
  rest: { bg: "#DBEAFE", fg: "#1E3A8A", symbol: "✓" },
  attempt: { bg: "#E5E7EB", fg: "#374151", symbol: "·" },
  project: { bg: "#C026D3", fg: "#ffffff", symbol: "★" },
};

export function boulderTone(result: "ATTEMPT" | "TOP" | "FLASH"): ResultTone {
  return result === "FLASH" ? "flash" : result === "TOP" ? "top" : "attempt";
}

export function routeTone(result: "ONSIGHT" | "FLASH" | "REDPOINT" | "TOP_WITH_REST" | "ATTEMPT"): ResultTone {
  if (result === "ONSIGHT" || result === "FLASH") return "flash";
  if (result === "REDPOINT") return "top";
  if (result === "TOP_WITH_REST") return "rest";
  return "attempt";
}

const ICONS: Record<ResultTone, () => React.JSX.Element> = {
  flash: IconFlash, top: IconCheck, rest: IconCheck, attempt: IconTry, project: IconStar,
};

/** The icon of a result, inline with its label. */
export function ResultIcon({ tone }: { tone: ResultTone }) {
  const Icon = ICONS[tone];
  return <Icon />;
}

export function ResultBadge({ tone, label, className }: { tone: ResultTone; label: string; className?: string }) {
  const t = RESULT_TONES[tone];
  return <span className={cn("inline-flex min-h-6 items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold", className)}
    style={{ backgroundColor: t.bg, color: t.fg }}>
    <ResultIcon tone={tone} />{label}
  </span>;
}

/** Style for a big result button in a logger. */
export function toneButtonStyle(tone: ResultTone): React.CSSProperties {
  const t = RESULT_TONES[tone];
  return { backgroundColor: t.bg, color: t.fg, borderColor: t.bg };
}
