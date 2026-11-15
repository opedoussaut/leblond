import type { LevelPoint } from "@/lib/analytics/charts";
import type { GradeSystem } from "@/lib/climbing/types";
import { scoreToGrade } from "@/lib/grading/ordering";
import { gradeLabel } from "@/lib/grading/labels";
import { fmt, intlLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { chartsDictionary } from "@/lib/i18n/charts";
import { LinePlot } from "./line-plot";

const WEEK_MS = 7 * 86_400_000;

/** How a diagram names grades and finds the grade at a score, whatever the scale. */
export type GradeScaleView = { label: (grade: string) => string; gradeAt: (score: number) => string | null };

/** A boulder grading system as a scale view (native grades, never converted). */
export const boulderScale = (t: Dictionary, system: GradeSystem): GradeScaleView => ({
  label: (grade) => gradeLabel(t, system, grade),
  gradeAt: (score) => scoreToGrade(system, score),
});

/** The hardest send of each week as a line, weeks without a send left as gaps in time (figures from lib/analytics/charts). */
export function LevelCurve({ t, locale, system, scale, points, now, plain = false, id = "level-curve", title, hint, texts }: {
  t: Dictionary; locale: Locale; points: LevelPoint[]; now: Date;
  /** A boulder grade system, or any other scale (routes) given as its own label and score → grade functions. */
  system?: GradeSystem; scale?: GradeScaleView;
  /** Inside another card: no frame of its own. */
  plain?: boolean;
  id?: string; title?: string; hint?: string;
  /** Wording for another discipline (routes): empty state, tooltip, table. */
  texts?: Partial<Pick<ReturnType<typeof chartsDictionary>, "levelEmpty" | "levelPoint" | "levelCaption" | "sendsCol">>;
}) {
  const c = { ...chartsDictionary(locale), ...texts };
  const view = scale ?? boulderScale(t, system!);
  const label = view.label;
  const short = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", day: "numeric", month: "short" });
  const first = points[0] ? Date.parse(points[0].weekStart + "T00:00:00Z") : 0;
  const weekIndex = (weekStart: string) => Math.round((Date.parse(weekStart + "T00:00:00Z") - first) / WEEK_MS);
  const lastIndex = points.length ? Math.max(weekIndex(points.at(-1)!.weekStart), Math.floor((now.getTime() - first) / WEEK_MS)) : 0;
  const scores = points.map((p) => p.score);
  const lo = Math.min(...scores), hi = Math.max(...scores);
  const every = hi - lo > 6 ? 2 : 1;
  const ticks: Array<{ value: number; label: string }> = [];
  for (let s = lo; s <= hi; s += every) {
    const g = view.gradeAt(s);
    if (g) ticks.push({ value: s, label: label(g) });
  }
  const dateOf = (index: number) => short.format(new Date(first + index * WEEK_MS));

  const Heading = plain ? "h3" : "h2";
  return <section aria-labelledby={`${id}-heading`} className={plain ? "" : "rounded-2xl border border-line bg-surface p-5 sm:p-6"}>
    <Heading id={`${id}-heading`} className={plain ? "text-base font-bold" : "text-lg font-bold"}>{title ?? c.levelTitle}</Heading>
    <p className="mt-1 text-sm text-ink-2">{hint ?? c.levelHint}</p>
    {points.length < 2 ? <p className="mt-4 text-sm text-ink-3">{c.levelEmpty}</p> : <>
      <div className="mt-5">
        <LinePlot columns={lastIndex + 1} yMin={lo - 0.5} yMax={hi + 0.5} yTicks={ticks}
          xLabels={[{ x: 0, label: dateOf(0) }, ...(lastIndex > 0 ? [{ x: lastIndex, label: dateOf(lastIndex) }] : [])]}
          series={[{ id: "you", label: c.you, tone: "accent", points: points.map((p) => ({
            x: weekIndex(p.weekStart), y: p.score,
            title: fmt(c.levelPoint, { date: short.format(new Date(p.weekStart + "T00:00:00Z")), grade: label(p.grade), n: p.sends }),
          })) }]} />
      </div>
      <div className="sr-only"><table>
        <caption>{title ?? c.levelCaption}</caption>
        <thead><tr><th scope="col">{c.week}</th><th scope="col">{c.hardest}</th><th scope="col">{c.sendsCol}</th></tr></thead>
        <tbody>{points.map((p) => <tr key={p.weekStart}>
          <td>{short.format(new Date(p.weekStart + "T00:00:00Z"))}</td><td>{label(p.grade)}</td><td>{p.sends}</td>
        </tr>)}</tbody>
      </table></div>
    </>}
  </section>;
}
