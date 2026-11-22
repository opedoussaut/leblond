"use client";

import { useState } from "react";
import type { ZoneDay } from "@/lib/analytics/weekly-load";
import { formatDuration } from "@/lib/duration";
import { fmt, intlLocale, type Locale } from "@/lib/i18n";
import { cn } from "@/components/ui/cn";

type Labels = { line: string; band: string; tooltip: string; empty: string };

/** The zone band, from ZONE_LOW / ZONE_HIGH (kept here as plain numbers to stay a client module). */
const BAND = { low: 0.8, high: 1.3 } as const;

/** Round ticks from 0 to just above the highest value: every 0.2 up to 2.4, then every 0.5, then every 1. */
function yScale(max: number): { top: number; ticks: number[] } {
  const hi = Math.max(1.8, max * 1.05);
  const step = hi <= 2.4 ? 0.2 : hi <= 5 ? 0.5 : 1;
  const top = Math.ceil(hi / step - 1e-9) * step;
  const ticks: number[] = [];
  for (let k = 0; k * step <= top + 1e-9; k++) ticks.push(Math.round(k * step * 10) / 10);
  return { top, ticks };
}

/**
 * The headline's comparison day by day (climbing + training hours of the 7
 * days ending that day ÷ the habit before them): a fixed green band
 * (0.8–1.3), one line, a dot per day while the days stay readable, a date
 * grid. Days without a habit are gaps, never 0. All figures come from
 * lib/analytics/weekly-load; this only draws them.
 */
export function RatioChart({ days, locale, labels }: { days: readonly ZoneDay[]; locale: Locale; labels: Labels }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = days.length;
  const values = days.map((d) => d.ratio).filter((v): v is number => v !== null);
  if (n < 2 || !values.length) return <p className="rounded-2xl bg-surface-2 p-4 text-sm text-ink-2">{labels.empty}</p>;

  const num = new Intl.NumberFormat(intlLocale(locale), { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const ratio = new Intl.NumberFormat(intlLocale(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const dayMonth = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", day: "2-digit", month: "2-digit" });
  const longDate = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", day: "numeric", month: "short" });
  const at = (d: string) => new Date(d + "T00:00:00Z");

  // Above 3 the line runs along the top edge; the tooltip keeps the real value.
  const { top, ticks } = yScale(Math.min(3, Math.max(...values)));
  const x = (i: number) => (i / (n - 1)) * 100;
  const y = (v: number) => 100 - (Math.min(v, top) / top) * 100;
  const path = (pick: (d: ZoneDay) => number | null) => {
    let d = "", pen = false;
    days.forEach((day, i) => {
      const v = pick(day);
      if (v === null) { pen = false; return; }
      d += `${pen ? "L" : "M"}${x(i)} ${y(v)} `;
      pen = true;
    });
    return d.trim();
  };
  // About six dates under the plot, the last day always among them.
  const every = Math.max(1, Math.ceil((n - 1) / 6));
  const xTicks = Array.from({ length: n }, (_, i) => i).filter((i) => (n - 1 - i) % every === 0);
  const dots = n <= 120;

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left) / r.width) * (n - 1)))));
  };
  const h = hover === null ? null : days[hover];
  const show = (v: number | null) => (v === null ? "—" : ratio.format(v));

  return <div aria-hidden="true" className="select-none">
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-ink-2">
      <li className="flex items-center gap-1.5"><span className="w-5 border-t-[3px] border-accent" />{labels.line}</li>
      <li className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm bg-ok/20" />{labels.band}</li>
    </ul>

    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
      <div className="relative h-64">
        {ticks.map((v) => <span key={v} className="absolute right-0 -translate-y-1/2 text-[11px] font-semibold tabular-nums text-ink-3" style={{ top: `${y(v)}%` }}>{num.format(v)}</span>)}
        <span className="invisible block text-[11px] font-semibold">{num.format(top)}</span>
      </div>
      <div className="relative mx-1.5 h-64 touch-pan-y" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
        <span className="absolute inset-x-0 bg-ok/15" style={{ top: `${y(BAND.high)}%`, bottom: `${100 - y(BAND.low)}%` }} />
        {ticks.map((v) => <span key={v} className="absolute inset-x-0 border-t border-line" style={{ top: `${y(v)}%` }} />)}
        {xTicks.map((i) => <span key={i} className="absolute inset-y-0 border-l border-line" style={{ left: `${x(i)}%` }} />)}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
          <path d={path((d) => d.ratio)} fill="none" vectorEffect="non-scaling-stroke" strokeWidth={3} strokeLinejoin="round" className="stroke-accent" />
        </svg>
        {dots ? days.map((d, i) => <span key={d.date}>
          {d.ratio !== null ? <span className="pointer-events-none absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-1 ring-surface" style={{ left: `${x(i)}%`, top: `${y(d.ratio)}%` }} /> : null}
        </span>) : null}
        {h ? <>
          <span className="pointer-events-none absolute inset-y-0 border-l border-ink-2" style={{ left: `${x(hover!)}%` }} />
          {h.ratio !== null ? <span className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent ring-2 ring-surface" style={{ left: `${x(hover!)}%`, top: `${y(h.ratio)}%` }} /> : null}
          <span className={cn("pointer-events-none absolute top-0 z-10 max-w-64 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink shadow-lg",
            hover! > n / 2 ? "-translate-x-[calc(100%+8px)]" : "translate-x-2")} style={{ left: `${x(hover!)}%` }}>
            {fmt(labels.tooltip, { date: longDate.format(at(h.date)), ratio: show(h.ratio), done: formatDuration(h.last7), habit: h.habit === null ? "—" : formatDuration(h.habit) })}
          </span>
        </> : null}
      </div>

      <span />
      <div className="relative mx-1.5 mt-1.5 h-4">
        {/* Every other date on a phone (the last one always), so labels never run into each other. */}
        {xTicks.map((i) => <span key={i} className={cn("absolute whitespace-nowrap text-[11px] tabular-nums text-ink-3",
          i === n - 1 ? "-translate-x-full" : i === 0 ? "" : "-translate-x-1/2",
          ((n - 1 - i) / every) % 2 === 1 && "max-sm:hidden")} style={{ left: `${x(i)}%` }}>{dayMonth.format(at(days[i].date))}</span>)}
      </div>
    </div>
  </div>;
}
