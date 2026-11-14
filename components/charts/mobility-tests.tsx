import { assessmentSeries, type AssessmentPoint } from "@/lib/analytics/mobility";
import { CORE_TESTS, TEST_BY_ID } from "@/lib/training/hip-mobility/assessment";
import { fmt, intlLocale, type Locale } from "@/lib/i18n";
import { chartsDictionary } from "@/lib/i18n/charts";
import { LinePlot, type PlotSeries } from "./line-plot";

/**
 * The core hip tests over time, one small diagram per test: the level (0–4,
 * as the test defines it) on each side at every assessment the climber did.
 */
export function MobilityTests({ locale, points }: { locale: Locale; points: readonly AssessmentPoint[] }) {
  const c = chartsDictionary(locale);
  const dates = [...new Set(points.map((p) => p.date))].sort();
  if (!dates.length) return <p className="text-sm text-ink-3">{c.noTests}</p>;
  const short = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", day: "numeric", month: "short" });
  const label = (date: string) => short.format(new Date(date + "T12:00:00Z"));
  const x = (date: string) => dates.indexOf(date);
  const ticks = [0, 1, 2, 3, 4].map((v) => ({ value: v, label: String(v) }));

  return <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
    {CORE_TESTS.map((test) => {
      const def = TEST_BY_ID.get(test)!;
      const unit = def.value.unit === "cm" ? " cm" : "";
      const side = (s: "LEFT" | "RIGHT", tone: PlotSeries["tone"]): PlotSeries => ({
        id: s, label: s === "LEFT" ? c.left : c.right, tone,
        points: assessmentSeries(points, test, s).filter((p) => p.level !== null).map((p) => ({
          x: x(p.date), y: p.level!,
          title: fmt(c.mobTestPoint, { date: label(p.date), side: s === "LEFT" ? c.left : c.right, level: p.level!,
            value: p.value === null ? "" : ` · ${p.value}${unit}` }),
        })),
      });
      const series = [side("RIGHT", "muted"), side("LEFT", "accent")];
      const rows = dates.map((d) => ({ d, l: series[1].points.find((p) => p.x === x(d))?.y, r: series[0].points.find((p) => p.x === x(d))?.y }));
      return <figure key={test} className="rounded-xl bg-surface-2 p-3">
        <figcaption className="text-sm font-bold leading-snug">{def.name[locale]}</figcaption>
        <div className="mt-3">
          <LinePlot columns={Math.max(2, dates.length)} yMin={-0.3} yMax={4.3} yTicks={ticks} height="h-28" series={series}
            xLabels={dates.length > 1 ? [{ x: 0, label: label(dates[0]) }, { x: dates.length - 1, label: label(dates.at(-1)!) }] : [{ x: 0, label: label(dates[0]) }]} />
        </div>
        <div className="sr-only"><table>
          <caption>{def.name[locale]}</caption>
          <thead><tr><th scope="col">Date</th><th scope="col">{c.left}</th><th scope="col">{c.right}</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.d}><td>{label(r.d)}</td><td>{r.l ?? "—"}</td><td>{r.r ?? "—"}</td></tr>)}</tbody>
        </table></div>
      </figure>;
    })}
  </div>;
}
