import { cn } from "@/components/ui/cn";

/**
 * A small, wordless trend for a summary tile: a line (gaps where a value is
 * missing, the last value marked, an optional green band) or bars. Purely
 * decorative: the tile says the figure in words. Figures come from
 * lib/analytics; this only draws them.
 */
export function Sparkline({ values, kind = "line", band, min, max, className }: {
  values: ReadonlyArray<number | null>;
  kind?: "line" | "bars";
  /** A range drawn behind the line (the load ratio's 0.8–1.3). */
  band?: { low: number; high: number };
  /** Fixed ends of the scale; by default the values (and the band) set it, bars always start at 0. */
  min?: number; max?: number;
  className?: string;
}) {
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
          className={i === n - 1 ? "fill-accent" : "fill-accent/45"} /> : null)}
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
      <path d={d.trim()} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="stroke-accent" />
    </svg>
    <span className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-surface"
      style={{ left: `${x(last)}%`, top: `${y(values[last]!)}%` }} />
  </div>;
}
