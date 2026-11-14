import type { LevelPoint } from "@/lib/analytics/charts";
import type { GradeSystem } from "@/lib/climbing/types";
import { scoreToGrade } from "@/lib/grading/ordering";
import { gradeLabel } from "@/lib/grading/labels";
import { fmt, intlLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { chartsDictionary } from "@/lib/i18n/charts";
import { LinePlot } from "./line-plot";

const WEEK_MS = 7 * 86_400_000;

/** The hardest send of each week as a line, weeks without a send left as gaps in time (figures from lib/analytics/charts). */
export function LevelCurve({ t, locale, system, points, now }: {
  t: Dictionary; locale: Locale; system: GradeSystem; points: LevelPoint[]; now: Date;
}) {
  const c = chartsDictionary(locale);
  const label = (grade: string) => gradeLabel(t, system, grade);
  const short = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", day: "numeric", month: "short" });
  const first = points[0] ? Date.parse(points[0].weekStart + "T00:00:00Z") : 0;
  const weekIndex = (weekStart: string) => Math.round((Date.parse(weekStart + "T00:00:00Z") - first) / WEEK_MS);
  const lastIndex = points.length ? Math.max(weekIndex(points.at(-1)!.weekStart), Math.floor((now.getTime() - first) / WEEK_MS)) : 0;
  const scores = points.map((p) => p.score);
  const lo = Math.min(...scores), hi = Math.max(...scores);
  const every = hi - lo > 6 ? 2 : 1;
  const ticks: Array<{ value: number; label: string }> = [];
  for (let s = lo; s <= hi; s += every) {
    const g = scoreToGrade(system, s);
    if (g) ticks.push({ value: s, label: label(g) });
  }
  const dateOf = (index: number) => short.format(new Date(first + index * WEEK_MS));

  return <section aria-labelledby="level-curve-heading" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
    <h2 id="level-curve-heading" className="text-lg font-bold">{c.levelTitle}</h2>
    <p className="mt-1 text-sm text-ink-2">{c.levelHint}</p>
    {points.length < 2 ? <p className="mt-4 text-sm text-ink-3">{c.levelEmpty}</p> : <>
      <div className="mt-5">
        <LinePlot columns={lastIndex + 1} yMin={lo - 0.5} yMax={hi + 0.5} yTicks={ticks}
          xLabels={[{ x: 0, label: dateOf(0) }, ...(lastIndex > 0 ? [{ x: lastIndex, label: dateOf(lastIndex) }] : [])]}
          series={[{ id: "you", label: c.you, tone: "accent", points: points.map((p) => ({
            x: weekIndex(p.weekStart), y: p.score,
            title: fmt(c.levelPoint, { date: short.format(new Date(p.weekStart + "T00:00:00Z")), grade: label(p.grade), n: p.sends }),
          })) }]} />
      </div>
      <table className="sr-only">
        <caption>{c.levelCaption}</caption>
        <thead><tr><th scope="col">{c.week}</th><th scope="col">{c.hardest}</th><th scope="col">{c.sendsCol}</th></tr></thead>
        <tbody>{points.map((p) => <tr key={p.weekStart}>
          <td>{short.format(new Date(p.weekStart + "T00:00:00Z"))}</td><td>{label(p.grade)}</td><td>{p.sends}</td>
        </tr>)}</tbody>
      </table>
    </>}
  </section>;
}
