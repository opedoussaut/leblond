"use client";

import { useState } from "react";
import type { LoadChartPoint } from "@/lib/analytics/training-load";
import { fmt, intlLocale, type Locale } from "@/lib/i18n";
import { cn } from "@/components/ui/cn";

type Labels = {
  fitness: string; fatigue: string; projection: string; today: string;
  formTitle: string; formHint: string; fresh: string; tired: string; tooltip: string; tooltipProjected: string;
};

/** About four round ticks from `lo` to `hi`. */
function ticks(lo: number, hi: number): number[] {
  const span = Math.max(1, hi - lo);
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((s) => span / s <= 4) ?? Math.ceil(span / 4);
  const out: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v < hi + step; v += step) {
    out.push(v);
    if (v >= hi) break;
  }
  return out;
}

/**
 * Fitness (chronic load) and fatigue (acute load) day by day, a projection
 * after today, and freshness underneath on its own scale. The band lives on
 * the ratio chart (RatioChart), not here. All figures come from
 * lib/analytics/training-load; this only draws them. Built like LinePlot: the
 * lines stretch with the box, text keeps its size.
 */
export function LoadChart({ points, locale, labels }: { points: LoadChartPoint[]; locale: Locale; labels: Labels }) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 2) return null;
  const n = points.length;
  const todayIndex = points.findIndex((p) => p.projected) - 1;
  const lastReal = todayIndex >= 0 ? todayIndex : n - 1;
  const short = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", day: "numeric", month: "short" });
  const dateOf = (d: string) => short.format(new Date(d + "T00:00:00Z"));

  const hi = Math.max(1, ...points.flatMap((p) => [p.fitness, p.fatigue]));
  const yTicks = ticks(0, hi * 1.05);
  const yMax = yTicks.at(-1)! || 1;
  const x = (i: number) => (i / (n - 1)) * 100;
  const y = (v: number) => 100 - (v / yMax) * 100;
  const line = (from: number, to: number, value: (p: LoadChartPoint) => number | null) => {
    let d = "", pen = false;
    for (let i = from; i <= to; i++) {
      const v = value(points[i]);
      if (v === null) { pen = false; continue; }
      d += `${pen ? "L" : "M"}${x(i)} ${y(v)} `;
      pen = true;
    }
    return d.trim();
  };

  const formMax = Math.max(5, ...points.map((p) => Math.abs(p.form)));
  const formTicks = ticks(-formMax, formMax).filter((v) => Math.abs(v) <= formMax * 1.2);
  const fLo = Math.min(-formMax, formTicks[0]), fHi = Math.max(formMax, formTicks.at(-1)!);
  const fy = (v: number) => ((fHi - v) / (fHi - fLo)) * 100;
  const formLine = (from: number, to: number) => points.slice(from, to + 1).map((p, k) => `${k ? "L" : "M"}${x(from + k)} ${fy(p.form)}`).join(" ");
  const formArea = `${formLine(0, lastReal)} L${x(lastReal)} ${fy(0)} L0 ${fy(0)} Z`;

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
  };
  const h = hover === null ? null : points[hover];
  const tip = h ? fmt(h.projected ? labels.tooltipProjected : labels.tooltip, {
    date: dateOf(h.date), fitness: Math.round(h.fitness), fatigue: Math.round(h.fatigue), load: Math.round(h.load),
  }) : "";

  // End-of-line labels, nudged apart when they would overlap.
  const end = points[lastReal];
  let fitY = y(end.fitness), fatY = y(end.fatigue);
  if (Math.abs(fitY - fatY) < 9) { const mid = (fitY + fatY) / 2; const up = end.fitness >= end.fatigue; fitY = mid + (up ? -4.5 : 4.5); fatY = mid + (up ? 4.5 : -4.5); }

  // The end date only when it does not crowd the "today" label.
  const xLabels = [{ i: 0, label: dateOf(points[0].date) }, ...(todayIndex > 0 ? [{ i: todayIndex, label: labels.today }] : []),
    ...(todayIndex <= 0 || n - 1 - todayIndex > n * 0.2 ? [{ i: n - 1, label: dateOf(points[n - 1].date) }] : [])];

  const plot = (height: string, children: React.ReactNode, overlay: React.ReactNode) => <div className={cn("relative mx-2 touch-pan-y", height)}
    onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
    {children}
    {todayIndex > 0 ? <span className="absolute inset-y-0 border-l border-dashed border-ink-3" style={{ left: `${x(todayIndex)}%` }} /> : null}
    {hover !== null ? <span className="pointer-events-none absolute inset-y-0 border-l border-ink-2" style={{ left: `${x(hover)}%` }} /> : null}
    {overlay}
  </div>;

  return <div aria-hidden="true" className="select-none">
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-ink-2">
      <li className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-accent" />{labels.fitness}</li>
      <li className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-ink-2" />{labels.fatigue}</li>
      {todayIndex > 0 ? <li className="flex items-center gap-1.5"><span className="w-5 border-t-2 border-dotted border-ink-3" />{labels.projection}</li> : null}
    </ul>

    <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-1">
      <div className="relative h-56">
        {yTicks.map((v) => <span key={v} className="absolute right-0 -translate-y-1/2 text-[11px] font-semibold tabular-nums text-ink-3" style={{ top: `${y(v)}%` }}>{v}</span>)}
        <span className="invisible block text-[11px] font-semibold">{yMax}</span>
      </div>
      {plot("h-56", <>
        {yTicks.map((v) => <span key={v} className="absolute inset-x-0 border-t border-line" style={{ top: `${y(v)}%` }} />)}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <path d={line(0, lastReal, (p) => p.fatigue)} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={1.5} strokeLinejoin="round" className="stroke-ink-2" />
          <path d={line(0, lastReal, (p) => p.fitness)} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={2.5} strokeLinejoin="round" className="stroke-accent" />
          {todayIndex > 0 ? <>
            <path d={line(lastReal, n - 1, (p) => p.fatigue)} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={1.5} strokeDasharray="2 3" className="stroke-ink-2" />
            <path d={line(lastReal, n - 1, (p) => p.fitness)} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={2.5} strokeDasharray="2 3" className="stroke-accent" />
          </> : null}
        </svg>
      </>, h ? <>
        <span className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-surface" style={{ left: `${x(hover!)}%`, top: `${y(h.fitness)}%` }} />
        <span className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink-2 ring-2 ring-surface" style={{ left: `${x(hover!)}%`, top: `${y(h.fatigue)}%` }} />
        <span className={cn("pointer-events-none absolute top-0 z-10 max-w-60 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink shadow-lg",
          hover! > n / 2 ? "-translate-x-[calc(100%+8px)]" : "translate-x-2")} style={{ left: `${x(hover!)}%` }}>{tip}</span>
      </> : null)}
      <div className="relative h-56 w-16">
        <span className="absolute left-1 -translate-y-1/2 whitespace-nowrap text-[11px] font-bold text-ink" style={{ top: `${fitY}%` }}>{Math.round(end.fitness)}</span>
        <span className="absolute left-1 -translate-y-1/2 whitespace-nowrap text-[11px] font-semibold text-ink-2" style={{ top: `${fatY}%` }}>{Math.round(end.fatigue)}</span>
      </div>

      <span />
      <div className="relative mx-2 mt-1 h-4">
        {xLabels.map((l) => <span key={l.i} className={cn("absolute whitespace-nowrap text-[11px] text-ink-3",
          l.i === 0 ? "" : l.i === n - 1 || (l.i === todayIndex && n - 1 - todayIndex < n * 0.1) ? "-translate-x-full" : "-translate-x-1/2")}
          style={{ left: `${x(l.i)}%` }}>{l.label}</span>)}
      </div>
      <span />
    </div>

    <h3 className="mt-6 text-base font-bold">{labels.formTitle}</h3>
    <p className="mt-1 text-sm text-ink-2">{labels.formHint}</p>
    <div className="mt-3 grid grid-cols-[auto_minmax(0,1fr)_auto] gap-x-1">
      <div className="relative h-24">
        {formTicks.map((v) => <span key={v} className="absolute right-0 -translate-y-1/2 text-[11px] font-semibold tabular-nums text-ink-3" style={{ top: `${fy(v)}%` }}>{v > 0 ? `+${v}` : v}</span>)}
        <span className="invisible block text-[11px] font-semibold">{`-${yMax}`}</span>
      </div>
      {plot("h-24", <>
        <span className="absolute inset-x-0 border-t border-ink-3" style={{ top: `${fy(0)}%` }} />
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <path d={formArea} className="fill-accent/10" />
          <path d={formLine(0, lastReal)} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={2} strokeLinejoin="round" className="stroke-accent" />
          {todayIndex > 0 ? <path d={formLine(lastReal, n - 1)} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={2} strokeDasharray="2 3" className="stroke-accent" /> : null}
        </svg>
      </>, h ? <span className="pointer-events-none absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-surface"
        style={{ left: `${x(hover!)}%`, top: `${fy(h.form)}%` }} /> : null)}
      <div className="relative h-24 w-16 text-[11px] font-semibold text-ink-3">
        <span className="absolute left-1 top-0">{labels.fresh}</span>
        <span className="absolute bottom-0 left-1">{labels.tired}</span>
      </div>
    </div>
  </div>;
}
