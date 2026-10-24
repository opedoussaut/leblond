import { cn } from "@/components/ui/cn";

/**
 * One visual language for climbing outcomes, used in both loggers, lists and
 * summaries: ⚡ flash / onsight in orange, ✓ top / redpoint in blue,
 * ★ project in fuchsia. The symbol and the text always accompany the colour.
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

export function ResultBadge({ tone, label, className }: { tone: ResultTone; label: string; className?: string }) {
  const t = RESULT_TONES[tone];
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold", className)}
    style={{ backgroundColor: t.bg, color: t.fg }}>
    <span aria-hidden>{t.symbol}</span>{label}
  </span>;
}

/** Style for a big result button in a logger. */
export function toneButtonStyle(tone: ResultTone): React.CSSProperties {
  const t = RESULT_TONES[tone];
  return { backgroundColor: t.bg, color: t.fg, borderColor: t.bg };
}
