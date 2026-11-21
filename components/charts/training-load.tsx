import type { LoadChartPoint, PerfTrend, RatioDay, TrainingLoadReport, WeeklyLoadRow, WeeklyRatioRow } from "@/lib/analytics/training-load";
import { BOARD_SHORT } from "@/lib/climbing/boards";
import { gradeLabel } from "@/lib/grading/labels";
import { fmt, intlLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { trainingLoadDictionary } from "@/lib/i18n/training-load";
import { cn } from "@/components/ui/cn";
import { Fold } from "@/components/ui/fold";
import { LoadChart } from "./load-chart";
import { RatioChart } from "./ratio-chart";

const VERDICT_TONE = {
  progressing: "bg-ok/15 text-ok",
  stagnating: "bg-warn/15 text-warn",
  declining: "bg-danger/15 text-danger",
  insufficient: "bg-surface-2 text-ink-2",
} as const;
const VERDICT_MARK = { progressing: "↗", stagnating: "→", declining: "↘", insufficient: "…" } as const;
const ZONE_TONE = {
  calibrating: "text-ink-2", under: "text-ink-2", optimal: "text-ok", high: "text-warn", danger: "text-danger",
} as const;
const ZONE_SURFACE = {
  calibrating: "border-line bg-surface-2", under: "border-line bg-surface-2", optimal: "border-ok/40 bg-ok/10",
  high: "border-warn/40 bg-warn/10", danger: "border-danger/40 bg-danger/10",
} as const;
const DIRECTION_MARK = { up: "↗", flat: "→", down: "↘", insufficient: "·" } as const;

/**
 * Progrès › Charge: today's ratio and zone, the ratio day by day (fingers and
 * upper body, and everything) on a fixed band, the week ahead, results per
 * native scale with the verdict, then the fitness–fatigue model folded away.
 * Figures come from lib/analytics/training-load.
 */
export function TrainingLoad({ t, locale, report, ratioDays, ratioWeeks, points, weeks }: {
  t: Dictionary; locale: Locale; report: TrainingLoadReport;
  /** The ratio days in the chosen period, and the same per week for the table. */
  ratioDays: RatioDay[]; ratioWeeks: WeeklyRatioRow[];
  points: LoadChartPoint[]; weeks: WeeklyLoadRow[];
}) {
  const d = trainingLoadDictionary(locale);
  const num = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 });
  const dec = new Intl.NumberFormat(intlLocale(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const share = new Intl.NumberFormat(intlLocale(locale), { style: "percent", maximumFractionDigits: 0 });
  const short = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", day: "numeric", month: "short" });
  const load = (v: number) => `${num.format(v)} ${d.loadUnit}`;
  const ratio = (v: number | null) => (v === null ? "—" : dec.format(v));
  const { verdict, guide } = report;
  const today = report.ratios.at(-1);
  const judged = report.trends.filter((tr) => tr.recentCount + tr.previousCount > 0);

  const scaleName = (tr: PerfTrend) => {
    const s = tr.series;
    if (s.kind === "boulder") return fmt(d.perfBoulder, { system: (t.grades.scaleShort as Record<string, string>)[s.system!] ?? s.system! });
    if (s.kind === "route") return d.perfRoute;
    if (s.kind === "board") return fmt(d.perfBoard, { board: BOARD_SHORT[s.board!], scale: s.scale === "V" ? "V" : "Font" });
    return fmt(d.perfHang, { mm: s.edgeMm ?? "—" });
  };
  const gradeName = (tr: PerfTrend, display: string) => (tr.series.kind === "boulder" ? gradeLabel(t, tr.series.system!, display) : display);

  if (!report.model.length) {
    return <section aria-labelledby="load-heading" className="leblond-premium-surface space-y-3 p-5 sm:p-6">
      <h2 id="load-heading" className="text-lg font-bold">{d.title}</h2>
      <p className="text-sm text-ink-2">{d.empty}</p>
    </section>;
  }

  return <section aria-labelledby="load-heading" className="leblond-premium-surface space-y-5 p-5 sm:p-6">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="load-heading" className="text-lg font-bold">{d.title}</h2>
      <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-bold text-ink-2">{d.evidence}</span>
    </div>
    <p className="text-sm text-ink-2">{d.hint}</p>

    <div className={cn("rounded-2xl border p-4", ZONE_SURFACE[verdict.zone])} data-testid="load-today">
      <p className="text-xs font-semibold text-ink-3">{verdict.ratioBasis === "global" ? d.todayGlobal : d.todayFingers}</p>
      <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
        {verdict.ratio !== null ? <span className="leblond-number text-4xl">{dec.format(verdict.ratio)}</span> : null}
        <span className={cn("text-xl font-black", ZONE_TONE[verdict.zone])}>{d.zone[verdict.zone]}</span>
      </p>
      {verdict.ratioBasis === "fingers" && today?.global != null ? <p className="mt-0.5 text-sm font-semibold text-ink-2">{fmt(d.globalValue, { r: dec.format(today.global) })}</p> : null}
      <p className="mt-1.5 text-sm text-ink-2">{verdict.zone === "calibrating" ? fmt(d.calibrating, { n: report.calibrationLeft }) : d.zoneText[verdict.zone]}</p>
    </div>

    {verdict.flags.length ? <ul className="flex flex-wrap gap-2">
      {verdict.flags.map((f) => <li key={f} className={cn("rounded-full border px-3 py-1 text-xs font-bold",
        f === "spike" || f === "pain" ? "border-danger/40 text-danger" : "border-warn/40 text-ink-2")}>⚠ {d.flags[f]}</li>)}
    </ul> : null}

    <div className="border-t border-line pt-4">
      <h3 className="text-base font-bold">{d.ratioTitle}</h3>
      <p className="mt-1 mb-3 text-sm text-ink-2">{d.ratioHint}</p>
      <RatioChart days={ratioDays} locale={locale} labels={{
        fingers: d.fingersLine, global: d.globalLine, band: d.band, danger: d.danger, tooltip: d.ratioTooltip, empty: d.ratioEmpty,
      }} />
      <div className="sr-only"><table>
        <caption>{d.ratioTableCaption}</caption>
        <thead><tr><th scope="col">{d.week}</th><th scope="col">{d.colFingers}</th><th scope="col">{d.colGlobal}</th><th scope="col">{d.colFingersLoad}</th><th scope="col">{d.colGlobalLoad}</th></tr></thead>
        <tbody>{ratioWeeks.map((w) => <tr key={w.weekStart}>
          <td>{short.format(new Date(w.weekStart + "T00:00:00Z"))}</td><td>{ratio(w.fingers)}</td><td>{ratio(w.global)}</td><td>{num.format(w.fingersLoad)}</td><td>{num.format(w.globalLoad)}</td>
        </tr>)}</tbody>
      </table></div>
    </div>

    {guide ? <div className="rounded-2xl bg-accent-soft p-4">
      <h3 className="text-base font-bold">{d.weekTitle}</h3>
      <p className="mt-1 text-sm">{fmt(guide.minSessions !== null && guide.maxSessions !== null ? d.weekText : d.weekTextNoSessions, {
        min: load(guide.minLoad), max: load(guide.maxLoad), smin: guide.minSessions ?? "", smax: guide.maxSessions ?? "",
        what: guide.basis === "fingers" ? d.weekWhatFingers : d.weekWhatGlobal,
      })}</p>
      <p className="mt-1 text-sm text-ink-2">{fmt(d.weekDone, { done: load(guide.last7), danger: load(guide.dangerLoad) })}</p>
    </div> : null}

    <div className="border-t border-line pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-bold">{d.perfTitle}</h3>
        <span className={cn("rounded-full px-3 py-1 text-sm font-bold", VERDICT_TONE[verdict.verdict])} data-testid="load-verdict">
          <span aria-hidden="true">{VERDICT_MARK[verdict.verdict]} </span>{d.verdict[verdict.verdict]}
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-2">{verdict.basis === "performance" ? d.basisPerformance : d.basisNone}</p>
      {judged.length === 0 ? <p className="mt-3 text-sm text-ink-3">{d.perfEmpty}</p>
        : <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {judged.map((tr) => <li key={tr.key} className="rounded-2xl bg-surface-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold">{scaleName(tr)}</span>
              <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold",
                tr.direction === "up" ? "bg-ok/15 text-ok" : tr.direction === "down" ? "bg-danger/15 text-danger" : "bg-surface text-ink-2")}>
                <span aria-hidden="true">{DIRECTION_MARK[tr.direction]} </span>{d.perfDirection[tr.direction]}</span>
            </div>
            <p className="mt-1 text-xs text-ink-2">
              {tr.recentBest ? fmt(d.perfBest, { grade: gradeName(tr, tr.recentBest.display) }) : tr.previousBest ? fmt(d.perfBest, { grade: gradeName(tr, tr.previousBest.display) }) : null}
              {" · "}{fmt(d.perfCounts, { recent: tr.recentCount, previous: tr.previousCount })}
            </p>
          </li>)}
        </ul>}
    </div>

    <Fold title={d.detailsTitle} hint={d.detailsHint}>
      <div className="space-y-5">
        <div>
          <h4 className="text-base font-bold">{d.chartTitle}</h4>
          <p className="mt-1 mb-3 text-sm text-ink-2">{d.chartHint}</p>
          <LoadChart points={points} locale={locale} labels={{
            fitness: d.fitness, fatigue: d.fatigue, projection: d.projection, today: d.today,
            formTitle: d.formTitle, formHint: d.formHint, fresh: d.fresh, tired: d.tired, tooltip: d.tooltip, tooltipProjected: d.tooltipProjected,
          }} />
          <div className="sr-only"><table>
            <caption>{d.tableCaption}</caption>
            <thead><tr><th scope="col">{d.week}</th><th scope="col">{d.weekLoad}</th><th scope="col">{d.fitness}</th><th scope="col">{d.fatigue}</th><th scope="col">{d.formCol}</th></tr></thead>
            <tbody>{weeks.map((w) => <tr key={w.weekStart}>
              <td>{short.format(new Date(w.weekStart + "T00:00:00Z"))}</td><td>{num.format(w.load)}</td><td>{num.format(w.fitness)}</td><td>{num.format(w.fatigue)}</td><td>{num.format(w.form)}</td>
            </tr>)}</tbody>
          </table></div>
        </div>
        {report.bySource.length ? <div>
          <h4 className="text-base font-bold">{d.sourcesTitle}</h4>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {report.bySource.map((s) => <li key={s.source} className="rounded-2xl bg-surface-2 p-3">
              <p className="text-xs font-semibold text-ink-3">{d.sources[s.source]}</p>
              <p className="mt-1 leblond-number text-lg">{num.format(s.load)} <span className="text-xs font-semibold text-ink-3">{d.loadUnit}</span></p>
              <p className="text-xs text-ink-3">{fmt(d.sourceRow, { n: s.sessions })}</p>
            </li>)}
          </ul>
        </div> : null}
      </div>
    </Fold>

    <details className="border-t border-line pt-4">
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold">{d.howTitle}</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">{d.how.map((line) => <li key={line}>{line}</li>)}</ul>
      {report.estimated ? <p className="mt-2 text-sm font-semibold">{fmt(d.estimatedShare, {
        minutes: share.format(report.estimated.minutes), intensity: share.format(report.estimated.intensity),
      })}</p> : null}
    </details>
    <details className="border-t border-line pt-4">
      <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold">{d.limitsTitle}</summary>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-2">{d.limits.map((line) => <li key={line}>{line}</li>)}</ul>
      <h4 className="mt-3 text-sm font-bold">{d.sourcesListTitle}</h4>
      <ol className="mt-1 list-decimal space-y-1 pl-5 text-xs text-ink-2">
        {d.references.map((r) => <li key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">{r.label}</a></li>)}
      </ol>
    </details>
  </section>;
}
