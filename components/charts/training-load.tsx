import type { LoadChartPoint, TrainingLoadReport, WeeklyLoadRow } from "@/lib/analytics/training-load";
import { gaugeGeometry, roundMinutes5, type Habit, type HoursReport, type HoursZone } from "@/lib/analytics/weekly-load";
import { formatDuration } from "@/lib/duration";
import { fmt, intlLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { trainingLoadDictionary } from "@/lib/i18n/training-load";
import { cn } from "@/components/ui/cn";
import { Fold } from "@/components/ui/fold";
import { LoadChart } from "./load-chart";
import { RatioChart } from "./ratio-chart";
import { WeeklyHoursChart, SOURCE_FILL } from "./weekly-hours-chart";
import { HarmonisedResults } from "./harmonised-results";

const ZONE_TONE: Record<HoursZone, string> = { light: "text-tone-sky", zone: "text-ok", heavy: "text-warn" };
const ZONE_SURFACE: Record<HoursZone, string> = { light: "border-tone-sky/30 bg-tone-sky-soft", zone: "border-ok/40 bg-ok/10", heavy: "border-warn/40 bg-warn/10" };
const ZONE_DOT: Record<HoursZone, string> = { light: "bg-tone-sky", zone: "bg-ok", heavy: "bg-warn" };
/** Flags still shown above the charts: the ratio flags are replaced by the gauge. */
const SHOWN_FLAGS = new Set(["monotony", "pain"]);
const hm = (m: number) => formatDuration(roundMinutes5(m));

/** Three plain zones on one bar, the last 7 days as a dot, the habit as a tick. Geometry from lib/analytics/weekly-load. */
function ZoneGauge({ last7, habit, zone, labels }: {
  last7: number; habit: Habit; zone: HoursZone;
  labels: { zone: Record<HoursZone, string>; aria: string; habit: string };
}) {
  const g = gaugeGeometry(last7, habit);
  const widths: Record<HoursZone, number> = { light: g.low, zone: g.high - g.low, heavy: 100 - g.high };
  return <div role="img" aria-label={fmt(labels.aria, { zone: labels.zone[zone], low: hm(habit.low), high: hm(habit.high) })} className="mt-4">
    <div className="relative h-4">
      <span className="absolute -top-0.5 -translate-x-1/2 text-[10px] font-semibold whitespace-nowrap text-ink-3" style={{ left: `${g.habit}%` }}>{labels.habit}</span>
    </div>
    <div className="relative">
      <div className="flex h-3 overflow-hidden rounded-full">
        <span className="bg-tone-sky/25" style={{ width: `${widths.light}%` }} />
        <span className="bg-ok/40" style={{ width: `${widths.zone}%` }} />
        <span className="bg-warn/35" style={{ width: `${widths.heavy}%` }} />
      </div>
      <span className="absolute -top-1 h-5 w-0.5 -translate-x-1/2 rounded bg-ink-3" style={{ left: `${g.habit}%` }} />
      <span className={cn("absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-[3px] ring-surface shadow", ZONE_DOT[zone])} style={{ left: `${g.marker}%` }} />
    </div>
    <div className="mt-2 flex text-[11px] leading-tight sm:text-xs">
      {(["light", "zone", "heavy"] as const).map((z) => <span key={z} className={cn("px-0.5 text-center", z === zone ? cn("font-black", ZONE_TONE[z]) : "font-semibold text-ink-3")}
        style={{ width: `${widths[z]}%` }}>{labels.zone[z]}</span>)}
    </div>
  </div>;
}

/**
 * Progrès › Charge, for climbers who are not sport scientists: the last 7
 * days against their usual week as a three-zone gauge with the fact in hours,
 * the next 7 days in séances, hours per week stacked by type with the usual
 * zone behind, results on two scales, then the day-by-day ratio and the
 * fitness–fatigue model behind "Détails". Figures come from lib/analytics.
 */
export function TrainingLoad({ t, locale, report, hours, points, weeks }: {
  t: Dictionary; locale: Locale; report: TrainingLoadReport; hours: HoursReport;
  points: LoadChartPoint[]; weeks: WeeklyLoadRow[];
}) {
  const d = trainingLoadDictionary(locale);
  const hd = d.hours;
  const num = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 });
  const share = new Intl.NumberFormat(intlLocale(locale), { style: "percent", maximumFractionDigits: 0 });
  const dec = new Intl.NumberFormat(intlLocale(locale), { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const short = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", day: "numeric", month: "short" });
  const { status, next } = hours;
  const flags = report.verdict.flags.filter((f) => SHOWN_FLAGS.has(f));

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

    {/* The headline: three plain zones and the fact in hours. No ratio here. */}
    <div className={cn("rounded-2xl border p-4", status.zone ? ZONE_SURFACE[status.zone] : "border-line bg-surface-2")} data-testid="load-today">
      <p className="text-xs font-semibold text-ink-3">{hd.headlineLabel}</p>
      {status.habit && status.zone ? <>
        <p className={cn("mt-1 text-2xl font-black", ZONE_TONE[status.zone])}>{hd.zone[status.zone]}</p>
        <p className="mt-0.5 text-base font-bold">{fmt(hd.fact, { done: hm(status.last7), habit: hm(status.habit.minutes) })}</p>
        <ZoneGauge last7={status.last7} habit={status.habit} zone={status.zone} labels={{ zone: hd.zone, aria: hd.gaugeAria, habit: hd.gaugeHabit }} />
        <p className="mt-3 text-sm text-ink-2">{hd.zoneText[status.zone]}</p>
      </> : <>
        <p className="mt-1 text-xl font-black text-ink-2">{hd.noHabitTitle}</p>
        <p className="mt-0.5 text-base font-bold">{fmt(hd.factNoHabit, { done: hm(status.last7) })}</p>
        <p className="mt-1.5 text-sm text-ink-2">{status.noHabit?.reason === "history" ? fmt(hd.noHistory, { n: status.noHabit.daysLeft }) : hd.noActivity}</p>
      </>}
      {status.mobility7 > 0 ? <p className="mt-1 text-xs font-semibold text-ink-3">{fmt(hd.mobilityExtra, { m: hm(status.mobility7) })}</p> : null}
    </div>

    {flags.length ? <ul className="flex flex-wrap gap-2">
      {flags.map((f) => <li key={f} className={cn("rounded-full border px-3 py-1 text-xs font-bold", f === "pain" ? "border-danger/40 text-danger" : "border-warn/40 text-ink-2")}>⚠ {d.flags[f]}</li>)}
    </ul> : null}

    <div className="rounded-2xl bg-accent-soft p-4" data-testid="load-next-week">
      <h3 className="text-base font-bold">{hd.nextTitle}</h3>
      {next ? <>
        <p className="mt-1 text-lg font-black">{next.minSessions === next.maxSessions
          ? (next.minSessions === 1 ? hd.nextOne : fmt(hd.nextSame, { n: next.minSessions }))
          : fmt(hd.nextRange, { min: next.minSessions, max: next.maxSessions })}</p>
        <p className="mt-1 text-sm text-ink-2">{fmt(hd.nextDetail, { min: hm(next.minMinutes), max: hm(next.maxMinutes), typical: hm(next.typicalMinutes) })}</p>
      </> : <p className="mt-1 text-sm text-ink-2">{hd.nextNone}</p>}
    </div>

    <div className="border-t border-line pt-4">
      <h3 className="text-base font-bold">{hd.weeksTitle}</h3>
      <p className="mt-1 mb-3 text-sm text-ink-2">{hd.weeksHint}</p>
      <WeeklyHoursChart weeks={hours.weeks} locale={locale} labels={{
        sources: d.sources, band: hd.bandLegend, current: hd.current, tooltip: hd.weekTooltip, habit: hd.weekHabit, noHabit: hd.weekNoHabit, empty: hd.weeksEmpty,
      }} />
      {report.estimated && report.estimated.minutes > 0 ? <p className="mt-2 text-xs text-ink-3">{fmt(hd.estimatedMinutes, { share: share.format(report.estimated.minutes) })}</p> : null}
      <div className="sr-only"><table>
        <caption>{hd.weeksTableCaption}</caption>
        <thead><tr><th scope="col">{d.week}</th><th scope="col">{hd.colTotal}</th>
          {(["BOULDER", "ROUTE", "BOARD", "TRAINING", "MOBILITY"] as const).map((s) => <th key={s} scope="col">{d.sources[s]}</th>)}
          <th scope="col">{hd.colZone}</th><th scope="col">{hd.colRatio}</th></tr></thead>
        <tbody>{hours.weeks.map((w) => <tr key={w.weekStart}>
          <td>{short.format(new Date(w.weekStart + "T00:00:00Z"))}{w.partial ? ` (${hd.current})` : ""}</td><td>{formatDuration(w.total)}</td>
          {(["BOULDER", "ROUTE", "BOARD", "TRAINING", "MOBILITY"] as const).map((s) => <td key={s}>{formatDuration(w.bySource[s])}</td>)}
          <td>{w.habit ? fmt(hd.weekHabit, { low: hm(w.habit.low), high: hm(w.habit.high) }) : hd.weekNoHabit}</td>
          <td>{w.ratio === null ? "—" : `${dec.format(w.ratio)}${w.zone ? ` · ${hd.zone[w.zone]}` : ""}`}</td>
        </tr>)}</tbody>
      </table></div>
    </div>

    <HarmonisedResults t={t} locale={locale} report={report} />

    <Fold title={hd.detailsTitle} hint={hd.detailsHint} testId="load-details">
      <div className="space-y-6">
        <div>
          <h4 className="text-base font-bold">{hd.ratioTitle}</h4>
          <p className="mt-1 mb-3 text-sm text-ink-2">{hd.ratioHint}</p>
          <RatioChart days={hours.days} locale={locale} labels={{ line: hd.ratioLine, band: hd.ratioBand, tooltip: hd.ratioTooltip, empty: hd.ratioEmpty }} />
        </div>
        {hours.bySource.length ? <div>
          <h4 className="text-base font-bold">{hd.sourcesTitle}</h4>
          <ul className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {hours.bySource.map((s) => <li key={s.source} className="rounded-2xl bg-surface-2 p-3">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-ink-3"><span className={cn("size-2.5 rounded-sm", SOURCE_FILL[s.source])} />{d.sources[s.source]}</p>
              <p className="mt-1 leblond-number text-lg">{formatDuration(s.minutes)}</p>
              <p className="text-xs text-ink-3">{fmt(d.sourceRow, { n: s.sessions })}</p>
            </li>)}
          </ul>
        </div> : null}
        <div>
          <h4 className="text-base font-bold">{hd.fitnessTitle}</h4>
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
