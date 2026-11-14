import { cn } from "@/components/ui/cn";

export type PlotSeries = {
  id: string;
  label: string;
  /** Solid accent for the climber; a dashed, muted line for anything compared with them. */
  tone: "accent" | "muted";
  points: Array<{ x: number; y: number; title: string }>;
};

/**
 * A small line diagram built in HTML around an SVG path, so labels keep their
 * size on a phone and on a desktop: the lines stretch with the box, the dots
 * and text do not. Each dot has a tooltip; callers also render a hidden table.
 */
export function LinePlot({ series, columns, yMin, yMax, yTicks, xLabels, step = false, height = "h-44" }: {
  series: PlotSeries[];
  /** Number of x positions (0 … columns − 1). */
  columns: number;
  yMin: number;
  yMax: number;
  yTicks: Array<{ value: number; label: string }>;
  xLabels: Array<{ x: number; label: string }>;
  /** Steps between points (running totals) rather than straight segments. */
  step?: boolean;
  height?: string;
}) {
  const span = Math.max(1, yMax - yMin);
  const left = (x: number) => (columns <= 1 ? 50 : (x / (columns - 1)) * 100);
  const top = (y: number) => 100 - ((y - yMin) / span) * 100;
  const path = (pts: PlotSeries["points"]) => pts.map((p, i) => {
    const xy = `${left(p.x)} ${top(p.y)}`;
    if (i === 0) return `M${xy}`;
    return step ? `H${left(p.x)} V${top(p.y)}` : `L${xy}`;
  }).join(" ");

  return <div aria-hidden="true" className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
    <div className={cn("relative", height)}>
      {yTicks.map((t) => <span key={t.value} className="absolute right-0 -translate-y-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums text-ink-3"
        style={{ top: `${top(t.value)}%` }}>{t.label}</span>)}
      <span className="invisible block text-[11px] font-semibold">{yTicks.reduce((a, t) => (t.label.length > a.length ? t.label : a), "")}</span>
    </div>
    <div className={cn("relative mx-2", height)}>
      {yTicks.map((t) => <span key={t.value} className="absolute inset-x-0 border-t border-line" style={{ top: `${top(t.value)}%` }} />)}
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        {series.map((s) => s.points.length > 1 ? <path key={s.id} d={path(s.points)} fill="none" vectorEffect="non-scaling-stroke"
          strokeWidth={2} strokeLinejoin="round" strokeLinecap="round"
          className={s.tone === "accent" ? "stroke-accent" : "stroke-ink-3"} strokeDasharray={s.tone === "muted" ? "5 4" : undefined} /> : null)}
      </svg>
      {series.flatMap((s) => s.points.map((p) => <span key={`${s.id}-${p.x}`} title={p.title}
        className={cn("absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface",
          s.tone === "accent" ? "bg-accent" : "bg-ink-3")}
        style={{ left: `${left(p.x)}%`, top: `${top(p.y)}%` }} />))}
    </div>
    <span />
    <div className="relative mx-2 mt-1 h-4">
      {xLabels.map((l) => <span key={l.x} className={cn("absolute whitespace-nowrap text-[11px] text-ink-3",
        columns > 1 && l.x === 0 ? "" : columns > 1 && l.x === columns - 1 ? "-translate-x-full" : "-translate-x-1/2")}
        style={{ left: `${left(l.x)}%` }}>{l.label}</span>)}
    </div>
  </div>;
}
