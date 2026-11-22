import { cn } from "@/components/ui/cn";
import type { Tone } from "@/components/ui/hero-figure";

/** Stroke and fills per tone (full class names, so Tailwind sees them); accent when no tone is given. */
const INK = {
  accent: { stroke: "stroke-accent", fill: "fill-accent", faint: "fill-accent/45", dot: "bg-accent" },
  blue: { stroke: "stroke-tone-blue", fill: "fill-tone-blue", faint: "fill-tone-blue/45", dot: "bg-tone-blue" },
  green: { stroke: "stroke-tone-green", fill: "fill-tone-green", faint: "fill-tone-green/45", dot: "bg-tone-green" },
  violet: { stroke: "stroke-tone-violet", fill: "fill-tone-violet", faint: "fill-tone-violet/45", dot: "bg-tone-violet" },
  teal: { stroke: "stroke-tone-teal", fill: "fill-tone-teal", faint: "fill-tone-teal/45", dot: "bg-tone-teal" },
  amber: { stroke: "stroke-tone-amber", fill: "fill-tone-amber", faint: "fill-tone-amber/45", dot: "bg-tone-amber" },
  sky: { stroke: "stroke-tone-sky", fill: "fill-tone-sky", faint: "fill-tone-sky/45", dot: "bg-tone-sky" },
  rose: { stroke: "stroke-tone-rose", fill: "fill-tone-rose", faint: "fill-tone-rose/45", dot: "bg-tone-rose" },
  gold: { stroke: "stroke-tone-gold", fill: "fill-tone-gold", faint: "fill-tone-gold/45", dot: "bg-tone-gold" },
} as const;

/**
 * A small, wordless trend for a summary tile: a line (gaps where a value is
 * missing, the last value marked, an optional green band) or bars. Purely
 * decorative: the tile says the figure in words. Figures come from
 * lib/analytics; this only draws them.
 */
export function Sparkline({ values, kind = "line", band, min, max, tone, className }: {
  values: ReadonlyArray<number | null>;
  kind?: "line" | "bars";
  /** A range drawn behind the line (the load ratio's 0.8–1.3). */
  band?: { low: number; high: number };
  /** Fixed ends of the scale; by default the values (and the band) set it, bars always start at 0. */
  min?: number; max?: number;
  /** The section's tone (--tone-* in globals.css); accent by default. */
  tone?: Tone;
  className?: string;
}) {
  const ink = INK[tone ?? "accent"];
  const n = values.length;
  const nums = values.filter((v): v is number => v !== null);
  const box = cn("relative h-10 w-full", className);
  if (n < 2 || !nums.length) return <div aria-hidden="true" className={box} />;

  const lo = kind === "bars" ? 0 : min ?? Math.min(...nums, band?.low ?? Infinity);
  let hi = max ?? Math.max(...nums, band?.high ?? -Infinity);
  if (hi <= lo) hi = lo + 1;
  const y = (v: number) => 100 - ((Math.min(Math.max(v, lo), hi) - lo) / (hi - lo)) * 100;

  if (kind === "bars") {
    const w = 100 / n;
    return <div aria-hidden="true" className={box}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full">
        {values.map((v, i) => v ? <rect key={i} x={i * w + w * 0.15} width={w * 0.7} y={y(v)} height={100 - y(v)}
          className={i === n - 1 ? ink.fill : ink.faint} /> : null)}
      </svg>
      <span className="absolute inset-x-0 bottom-0 border-t border-line" />
    </div>;
  }

  const x = (i: number) => (i / (n - 1)) * 100;
  let d = "", pen = false;
  values.forEach((v, i) => {
    if (v === null) { pen = false; return; }
    d += `${pen ? "L" : "M"}${x(i)} ${y(v)} `;
    pen = true;
  });
  const last = values.findLastIndex((v) => v !== null);
  return <div aria-hidden="true" className={box}>
    {band ? <span className="absolute inset-x-0 bg-ok/15" style={{ top: `${y(band.high)}%`, bottom: `${100 - y(band.low)}%` }} /> : null}
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
      <path d={d.trim()} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className={ink.stroke} />
    </svg>
    <span className={cn("absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface", ink.dot)}
      style={{ left: `${x(last)}%`, top: `${y(values[last]!)}%` }} />
  </div>;
}
