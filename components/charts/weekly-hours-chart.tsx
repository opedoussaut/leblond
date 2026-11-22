"use client";

import { useState } from "react";
import type { LoadSource } from "@/lib/analytics/training-load";
import type { WeekHours } from "@/lib/analytics/weekly-load";
import { formatDuration } from "@/lib/duration";
import { fmt, intlLocale, type Locale } from "@/lib/i18n";
import { cn } from "@/components/ui/cn";

type Labels = {
  sources: Record<LoadSource, string>; band: string; current: string;
  tooltip: string; habit: string; noHabit: string; empty: string;
};

/** Bottom to top: the climbing and training types, mobility on top in a lighter tint. */
const ORDER: readonly LoadSource[] = ["BOULDER", "ROUTE", "BOARD", "TRAINING", "MOBILITY"];
export const SOURCE_FILL: Record<LoadSource, string> = {
  BOULDER: "bg-tone-blue", ROUTE: "bg-tone-teal", BOARD: "bg-tone-violet", TRAINING: "bg-tone-amber", MOBILITY: "bg-tone-green/45",
};

/** Round hour ticks from 0 to just above the highest bar or zone: every hour, 2 h or 5 h. */
function yScale(maxMinutes: number): { top: number; ticks: number[] } {
  const hours = Math.max(2, maxMinutes / 60);
  const step = hours <= 6 ? 1 : hours <= 14 ? 2 : 5;
  const top = Math.ceil((hours * 1.05) / step) * step;
  return { top: top * 60, ticks: Array.from({ length: top / step + 1 }, (_, k) => k * step * 60) };
}

/**
 * Hours per week, one stacked bar per week by session type, with the
 * climber's usual zone (habit × 0.8–1.3) as a light band behind each week
 * that has one. Weeks without a habit get no band, never a zero band. All
 * figures come from lib/analytics/weekly-load; this only draws them.
 */
export function WeeklyHoursChart({ weeks, locale, labels }: { weeks: readonly WeekHours[]; locale: Locale; labels: Labels }) {
  const [hover, setHover] = useState<number | null>(null);
  const n = weeks.length;
  if (!n || weeks.every((w) => w.total === 0)) return <p className="rounded-2xl bg-surface-2 p-4 text-sm text-ink-2">{labels.empty}</p>;

  const short = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", day: "numeric", month: "short" });
  const dayMonth = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", day: "2-digit", month: "2-digit" });
  const at = (d: string) => new Date(d + "T00:00:00Z");
  const { top, ticks } = yScale(Math.max(...weeks.map((w) => Math.max(w.total, w.habit?.high ?? 0))));
  const y = (m: number) => (m / top) * 100;
  const every = Math.max(1, Math.ceil(n / 6));
  const labelled = new Set(Array.from({ length: n }, (_, i) => i).filter((i) => (n - 1 - i) % every === 0));
  const h = hover === null ? null : weeks[hover];

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setHover(Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - r.left) / r.width) * n))));
  };

  return <div aria-hidden="true" className="select-none">
    <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-semibold text-ink-2">
      {ORDER.filter((s) => weeks.some((w) => w.bySource[s] > 0)).map((s) => <li key={s} className="flex items-center gap-1.5">
        <span className={cn("size-3 rounded-sm", SOURCE_FILL[s])} />{labels.sources[s]}
      </li>)}
      <li className="flex items-center gap-1.5"><span className="h-3 w-5 rounded-sm border border-ok/40 bg-ok/15" />{labels.band}</li>
    </ul>

    <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2">
      <div className="relative h-56">
        {ticks.map((v) => <span key={v} className="absolute right-0 translate-y-1/2 whitespace-nowrap text-[11px] font-semibold tabular-nums text-ink-3" style={{ bottom: `${y(v)}%` }}>{v / 60} h</span>)}
        <span className="invisible block whitespace-nowrap text-[11px] font-semibold">{top / 60} h</span>
      </div>
      <div className="relative h-56 touch-pan-y" onPointerMove={onMove} onPointerDown={onMove} onPointerLeave={() => setHover(null)}>
        {ticks.map((v) => <span key={v} className="absolute inset-x-0 border-t border-line" style={{ bottom: `${y(v)}%` }} />)}
        <div className="absolute inset-0 flex">
          {weeks.map((w, i) => <div key={w.weekStart} className="relative h-full flex-1">
            {w.habit ? <span className="absolute inset-x-0 border-y border-ok/40 bg-ok/15" style={{ bottom: `${y(w.habit.low)}%`, height: `${y(w.habit.high - w.habit.low)}%` }} /> : null}
            <div className={cn("absolute inset-x-[18%] bottom-0 flex flex-col-reverse overflow-hidden rounded-t-[3px]", w.partial && "opacity-60", hover === i && "ring-2 ring-ink/30")}
              style={{ height: `${y(w.total)}%` }}>
              {ORDER.map((s) => w.bySource[s] > 0 ? <span key={s} className={SOURCE_FILL[s]} style={{ height: `${(w.bySource[s] / w.total) * 100}%` }} /> : null)}
            </div>
          </div>)}
        </div>
        {h ? <span className={cn("pointer-events-none absolute top-0 z-10 w-max max-w-56 rounded-xl border border-line bg-surface px-3 py-2 text-xs font-semibold text-ink shadow-lg",
          hover! >= n / 2 ? "-translate-x-full" : "")} style={{ left: `${((hover! + (hover! >= n / 2 ? 0 : 1)) / n) * 100}%` }}>
          <span className="block">{fmt(labels.tooltip, { date: short.format(at(h.weekStart)), total: formatDuration(h.total) })}{h.partial ? ` (${labels.current})` : ""}</span>
          {ORDER.filter((s) => h.bySource[s] > 0).map((s) => <span key={s} className="flex items-center gap-1.5 font-normal text-ink-2">
            <span className={cn("size-2 rounded-sm", SOURCE_FILL[s])} />{labels.sources[s]} {formatDuration(h.bySource[s])}
          </span>)}
          <span className="mt-0.5 block font-normal text-ink-3">{h.habit ? fmt(labels.habit, { low: formatDuration(h.habit.low), high: formatDuration(h.habit.high) }) : labels.noHabit}</span>
        </span> : null}
      </div>

      <span />
      <div className="relative mt-1.5 h-4">
        {weeks.map((w, i) => labelled.has(i) ? <span key={w.weekStart} className={cn("absolute whitespace-nowrap text-[11px] tabular-nums text-ink-3",
          i === n - 1 ? "-translate-x-full" : "-translate-x-1/2")} style={{ left: `${i === n - 1 ? 100 : ((i + 0.5) / n) * 100}%` }}>
          {dayMonth.format(at(w.weekStart))}
        </span> : null)}
      </div>
    </div>
  </div>;
}
