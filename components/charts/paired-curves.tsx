import type { WeeklyPoint } from "@/lib/analytics/notebook";
import { fmt, intlLocale, type Locale } from "@/lib/i18n";
import { notebookDictionary } from "@/lib/i18n/notebook";
import { LinePlot } from "./line-plot";
import { SeriesPicker } from "./series-picker";

export type CurveSeries = {
  id: string; title: string; help: string;
  points: WeeklyPoint[];
  yTicks: Array<{ value: number; label: string }>;
};

/**
 * Two weekly series one above the other on the same weeks, each on its own
 * scale (never two scales on one plot), so the climber can see whether they
 * move together.
 */
export function PairedCurves({ locale, weeks, firstWeek, options, top, bottom }: {
  locale: Locale; weeks: number;
  /** Monday of the first week of the period (YYYY-MM-DD). */
  firstWeek: string;
  options: Array<{ id: string; label: string }>;
  top: CurveSeries; bottom: CurveSeries;
}) {
  const n = notebookDictionary(locale);
  const short = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", day: "numeric", month: "short" });
  const dateOf = (week: number) => short.format(new Date(Date.parse(firstWeek + "T00:00:00Z") + week * 7 * 86_400_000));
  const mid = Math.floor((weeks - 1) / 2);
  const xLabels = [{ x: 0, label: dateOf(0) }, { x: mid, label: dateOf(mid) }, { x: weeks - 1, label: dateOf(weeks - 1) }];

  const curve = (s: CurveSeries, tone: "accent" | "muted") => {
    const values = s.points.map((p) => p.value);
    const ticks = s.yTicks.map((t) => t.value);
    const lo = Math.min(...values, ...ticks), hi = Math.max(...values, ...ticks);
    const pad = Math.max(0.5, (hi - lo) * 0.08);
    return <figure className="space-y-2">
      <figcaption>
        <span className="flex items-center gap-2 text-sm font-bold">
          <span aria-hidden="true" className={tone === "accent" ? "w-5 border-t-2 border-accent" : "w-5 border-t-2 border-dashed border-ink-3"} />
          {s.title}
        </span>
        <span className="mt-0.5 block text-xs text-ink-3">{s.help}</span>
      </figcaption>
      {s.points.length ? <>
        <LinePlot columns={weeks} yMin={lo - pad} yMax={hi + pad} yTicks={s.yTicks} height="h-32" xLabels={xLabels}
          series={[{ id: s.id, label: s.title, tone, points: s.points.map((p) => ({
            x: p.week, y: p.value, title: fmt(n.point, { date: dateOf(p.week), value: p.label }),
          })) }]} />
        <div className="sr-only"><table>
          <caption>{s.title}</caption>
          <thead><tr><th scope="col">{n.week}</th><th scope="col">{s.title}</th></tr></thead>
          <tbody>{s.points.map((p) => <tr key={p.week}><td>{dateOf(p.week)}</td><td>{p.label}</td></tr>)}</tbody>
        </table></div>
      </> : <p className="rounded-xl bg-surface-2 px-3 py-6 text-center text-sm text-ink-3">{n.noData}</p>}
    </figure>;
  };

  return <section aria-labelledby="relate-heading" className="leblond-premium-surface space-y-4 p-5 sm:p-6">
    <div>
      <h2 id="relate-heading" className="text-lg font-bold">{n.relateTitle}</h2>
      <p className="mt-1 text-sm text-ink-2">{n.relateHint}</p>
    </div>
    <SeriesPicker options={options} a={top.id} b={bottom.id} labels={{ a: n.seriesA, b: n.seriesB }} />
    <div className="space-y-5 border-t border-line pt-4">
      {curve(top, "accent")}
      {curve(bottom, "muted")}
    </div>
  </section>;
}
