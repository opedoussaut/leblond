"use client";

import { useEffect, useRef, useState } from "react";
import type { AssessmentCadence, FitnessPoint, MeasuredSeries, SelfRatedSeries } from "@/lib/analytics/fitness";
import { formatDate } from "@/lib/format";
import { fmt, type Locale } from "@/lib/i18n";
import { assessmentDictionary } from "@/lib/i18n/assessment";
import { trainingDictionary } from "@/lib/i18n/training";
import type { TestDefinition } from "@/lib/training/assessment-protocol";
import { EvidenceBadge } from "./structured-assessment";

export type CurrentLevels = {
  boulder: { declared: string | null; observed: string | null; sample: number; target: string | null };
  route: { declared: string | null; observed: string | null; sample: number; target: string | null };
};

const shortDate = (date: string, locale: Locale) =>
  formatDate(date + "T12:00:00", locale, { day: "numeric", month: "short" });
const longDate = (date: string, locale: Locale) =>
  formatDate(date + "T12:00:00", locale, { day: "numeric", month: "long" });

/** Where the climber stands, declared and observed side by side. Boulder and route grades are never converted. */
export function CurrentLevelPanel({ locale, levels, cadence }: {
  locale: Locale; levels: CurrentLevels; cadence: AssessmentCadence | null;
}) {
  const a = assessmentDictionary(locale);
  const rows = [
    { key: "boulder", label: a.levelBoulder, ...levels.boulder },
    { key: "route", label: a.levelRoute, ...levels.route },
  ].filter((r) => r.declared || r.observed || r.target);
  return <section aria-labelledby="level-heading" className="leblond-premium-surface p-5">
    <h2 id="level-heading" className="text-lg font-bold">{a.levelTitle}</h2>
    {rows.length ? <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
      {rows.map((r) => <dl key={r.key} className="rounded-xl bg-surface-2 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{r.label}</p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <dt className="text-sm text-ink-2">{a.levelDeclared}</dt>
          <dd className="text-lg font-black tabular-nums">{r.declared ?? "—"}</dd>
        </div>
        <div className="mt-2 flex items-center justify-between gap-3">
          <dt className="text-sm text-ink-2">{a.levelObserved}</dt>
          <dd className="text-right text-sm font-bold">{r.observed ? `${r.observed} · ${fmt(a.levelSample, { n: r.sample })}` : a.levelNotEnough}</dd>
        </div>
        {r.target ? <div className="mt-2 flex items-center justify-between gap-3">
          <dt className="text-sm text-ink-2">{a.levelGoal}</dt>
          <dd className="text-sm font-bold tabular-nums">{r.target}</dd>
        </div> : null}
      </dl>)}
    </div> : <p className="mt-2 text-sm text-ink-2">{a.levelNone}</p>}
    <details className="mt-2 text-xs leading-relaxed text-ink-3">
      <summary className="flex min-h-11 cursor-pointer items-center font-bold text-accent">{a.levelHow}</summary>
      {a.levelHint}
    </details>
    {cadence ? <p className={"mt-2 rounded-xl px-4 py-3 text-sm font-semibold " + (cadence.due ? "bg-accent-soft text-ink" : "bg-surface-2 text-ink-2")}>
      {fmt(cadence.due ? a.cadenceDue : a.cadenceNext, { last: longDate(cadence.last, locale), next: longDate(cadence.next, locale) })}
    </p> : null}
  </section>;
}

const W = 320, H = 140, SIDE = 10, PLOT_TOP = 24, PLOT_BOTTOM = 96, AXIS = 118, ABOVE = -9, BELOW = 17;
const dayNumber = (date: string) => Date.parse(date + "T00:00:00Z") / 86_400_000;

/** Tracks the rendered width so chart text and line weights stay the same size on every screen. */
function useChartWidth() {
  const ref = useRef<SVGSVGElement>(null);
  const [width, setWidth] = useState(W);
  useEffect(() => {
    if (!ref.current) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.round(entry.contentRect.width) || W));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

/** A thin single-series line; only the first and latest points carry a label. */
function MiniLine({ points, domain, label, locale, valueText }: {
  points: FitnessPoint[]; domain: [number, number]; label: string; locale: Locale;
  valueText: (value: number) => string;
}) {
  const a = assessmentDictionary(locale);
  const [ref, width] = useChartWidth();
  const first = dayNumber(points[0].date);
  const span = Math.max(1, dayNumber(points[points.length - 1].date) - first);
  const [low, high] = domain;
  const x = (date: string) => SIDE + ((dayNumber(date) - first) / span) * (width - 2 * SIDE);
  const y = (value: number) => PLOT_TOP + ((high - value) / (high - low)) * (PLOT_BOTTOM - PLOT_TOP);
  const start = points[0], end = points[points.length - 1];
  // Each end label sits on the side of its point that the line leaves free.
  const startLabel = y(start.value) + (points[1].value > start.value ? BELOW : ABOVE);
  const endLabel = y(end.value) + (points[points.length - 2].value > end.value ? BELOW : ABOVE);
  return <figure className="mt-2">
    <svg ref={ref} viewBox={`0 0 ${width} ${H}`} height={H} className="w-full" role="img" aria-label={label}>
      <line x1={SIDE} x2={width - SIDE} y1={AXIS} y2={AXIS} className="stroke-line" />
      <polyline points={points.map((p) => `${x(p.date)},${y(p.value)}`).join(" ")} fill="none"
        className="stroke-accent" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((p, i) => <g key={i}>
        <circle cx={x(p.date)} cy={y(p.value)} r="4" strokeWidth="2"
          className={p.partial ? "fill-surface stroke-accent" : "fill-accent stroke-surface"} />
        <circle cx={x(p.date)} cy={y(p.value)} r="14" fill="transparent">
          <title>{shortDate(p.date, locale)} · {valueText(p.value)}{p.partial ? ` · ${a.partialShort}` : ""}</title>
        </circle>
      </g>)}
      <text x={x(start.date)} y={startLabel} textAnchor="start" fontSize="12" fontWeight="700" className="fill-ink-2">{valueText(start.value)}</text>
      <text x={x(end.date)} y={endLabel} textAnchor="end" fontSize="12" fontWeight="700" className="fill-ink">{valueText(end.value)}</text>
      <text x={SIDE} y={H - 6} fontSize="12" className="fill-ink-3">{shortDate(start.date, locale)}</text>
      <text x={width - SIDE} y={H - 6} textAnchor="end" fontSize="12" className="fill-ink-3">{shortDate(end.date, locale)}</text>
    </svg>
    <table className="sr-only">
      <caption>{label}</caption>
      <tbody>{points.map((p, i) => <tr key={i}><th scope="row">{p.date}</th><td>{valueText(p.value)}</td></tr>)}</tbody>
    </table>
  </figure>;
}

function measuredDomain(test: TestDefinition, values: number[]): [number, number] {
  const low = Math.min(...values), high = Math.max(...values);
  const pad = Math.max(1, (high - low) * 0.25);
  return [Math.max(test.min, low - pad), Math.min(test.max, high + pad)];
}

function changeLine(series: MeasuredSeries, locale: Locale, unit: string): string {
  const a = assessmentDictionary(locale);
  if (!series.change) return a.onePoint;
  const { delta, direction, comparable } = series.change;
  const words = { better: a.changeBetter, worse: a.changeWorse, same: a.changeSame }[direction];
  const line = fmt(a.sinceFirst, { delta: `${delta > 0 ? "+" : ""}${delta} ${unit}`, words });
  return comparable ? line : `${line} · ${a.indicative}`;
}

/** Fitness over repeated assessments: one small chart per test, each in its own unit, never one combined score. */
export function FitnessCharts({ locale, measured, selfRated }: {
  locale: Locale; measured: MeasuredSeries[]; selfRated: SelfRatedSeries[];
}) {
  const a = assessmentDictionary(locale);
  const t = trainingDictionary(locale);
  const anyPartial = measured.some((s) => s.points.some((p) => p.partial));
  return <section aria-labelledby="evolution-heading" className="space-y-3">
    <div>
      <h2 id="evolution-heading" className="text-lg font-bold">{a.evolutionTitle}</h2>
      <p className="mt-1 text-sm text-ink-2">{a.evolutionHint}</p>
    </div>
    {measured.length ? <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {measured.map((s) => {
        const unit = a.units[s.test.unit];
        return <li key={s.test.id} className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-bold">{s.test.name[locale]}</h3>
            <EvidenceBadge level="measured" locale={locale} />
          </div>
          <p className="mt-1 text-2xl font-black tabular-nums">{s.latest.value} <span className="text-sm font-semibold text-ink-2">{unit}</span></p>
          <p className="text-xs text-ink-2">{changeLine(s, locale, unit)}</p>
          {s.points.length > 1 ? <MiniLine points={s.points} domain={measuredDomain(s.test, s.points.map((p) => p.value))} locale={locale}
            label={s.test.name[locale]} valueText={(v) => `${v} ${unit}`} /> : null}
        </li>;
      })}
    </ul> : <p className="rounded-xl border border-dashed border-line p-4 text-sm text-ink-2">{a.noMeasured}</p>}
    {anyPartial ? <p className="text-xs text-ink-3">{a.partialNote}</p> : null}
    {selfRated[0]?.points.length ? <details className="rounded-2xl border border-line bg-surface p-4">
      <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 text-sm font-bold text-accent">
        {a.selfRatedTitle} <EvidenceBadge level="self" locale={locale} />
      </summary>
      <p className="mt-1 text-xs text-ink-3">{a.selfRatedHint}</p>
      <ul className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
        {selfRated.map((s) => <li key={s.axis}>
          <h3 className="text-sm font-bold">{t.axis[s.axis]}</h3>
          {s.points.length > 1 ? <MiniLine points={s.points} domain={[1, 5]} locale={locale} label={t.axis[s.axis]} valueText={(v) => `${v} / 5`} />
            : <p className="mt-1 text-sm tabular-nums text-ink-2">{s.points[0].value} / 5</p>}
        </li>)}
      </ul>
    </details> : null}
  </section>;
}
