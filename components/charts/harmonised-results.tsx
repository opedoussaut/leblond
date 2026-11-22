import Link from "next/link";
import type { PerfPoint, PerfTrend, TrainingLoadReport } from "@/lib/analytics/training-load";
import { HARMONISED_BOULDER_KEY } from "@/lib/analytics/harmonised";
import { BOARD_SHORT } from "@/lib/climbing/boards";
import type { GradeSystem } from "@/lib/climbing/types";
import { confidenceBand } from "@/lib/grading/harmonise";
import { gradeLabel } from "@/lib/grading/labels";
import { fmt, type Dictionary, type Locale } from "@/lib/i18n";
import { gradeHarmoniseDictionary } from "@/lib/i18n/grade-harmonise";
import { trainingLoadDictionary } from "@/lib/i18n/training-load";
import { cn } from "@/components/ui/cn";
import { Fold } from "@/components/ui/fold";

const VERDICT_TONE = {
  progressing: "bg-ok/15 text-ok",
  stagnating: "bg-warn/15 text-warn",
  declining: "bg-danger/15 text-danger",
  insufficient: "bg-surface-2 text-ink-2",
} as const;
const VERDICT_MARK = { progressing: "↗", stagnating: "→", declining: "↘", insufficient: "…" } as const;
const DIRECTION_MARK = { up: "↗", flat: "→", down: "↘", insufficient: "·" } as const;

/**
 * Progrès › Charge › results: boulders on Font (every gym scale converted
 * through the correspondence table, labelled as an estimate) and routes on the
 * French scale, each best entry with its grade as logged; board and hangs as
 * before; the per-native-scale cards folded away below. Figures come from
 * lib/analytics (training-load, harmonised).
 */
export function HarmonisedResults({ t, locale, report }: { t: Dictionary; locale: Locale; report: TrainingLoadReport }) {
  const d = trainingLoadDictionary(locale);
  const h = gradeHarmoniseDictionary(locale);
  const scaleName = t.grades.systems as Record<string, string>;
  const { verdict } = report;
  const shown = (list: readonly PerfTrend[]) => list.filter((tr) => tr.recentCount + tr.previousCount > 0);
  const boulder = report.trends.find((tr) => tr.key === HARMONISED_BOULDER_KEY && tr.recentCount + tr.previousCount > 0);
  const route = report.trends.find((tr) => tr.kind === "route" && tr.recentCount + tr.previousCount > 0);
  const others = shown(report.trends.filter((tr) => tr.kind === "board" || tr.kind === "hang"));
  const detail = shown(report.detailTrends);
  const extra = report.harmonised;
  const native = (system: GradeSystem, grade: string) => `${gradeLabel(t, system, grade)}, ${scaleName[system] ?? system}`;

  const otherName = (tr: PerfTrend) => {
    const s = tr.series;
    if (s.kind === "board") return fmt(d.perfBoard, { board: BOARD_SHORT[s.board!], scale: s.scale === "V" ? "V" : "Font" });
    if (s.kind === "hang") return fmt(d.perfHang, { mm: s.edgeMm ?? "—" });
    if (s.kind === "boulder") return fmt(d.perfBoulder, { system: scaleName[s.system!] ?? s.system! });
    return d.perfRoute;
  };
  const bestOf = (tr: PerfTrend) => tr.recentBest ?? tr.previousBest;
  const nativeBest = (tr: PerfTrend, p: PerfPoint) => (tr.series.kind === "boulder" && tr.series.system ? gradeLabel(t, tr.series.system, p.display) : p.display);

  const direction = (tr: PerfTrend) => <span className={cn("rounded-full px-2 py-0.5 text-xs font-bold",
    tr.direction === "up" ? "bg-ok/15 text-ok" : tr.direction === "down" ? "bg-danger/15 text-danger" : "bg-surface text-ink-2")}>
    <span aria-hidden="true">{DIRECTION_MARK[tr.direction]} </span>{d.perfDirection[tr.direction]}</span>;
  const counts = (tr: PerfTrend) => fmt(d.perfCounts, { recent: tr.recentCount, previous: tr.previousCount });

  return <div className="border-t border-line pt-4" data-testid="harmonised-results">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h3 className="text-base font-bold">{d.perfTitle}</h3>
      <span className={cn("rounded-full px-3 py-1 text-sm font-bold", VERDICT_TONE[verdict.verdict])} data-testid="load-verdict">
        <span aria-hidden="true">{VERDICT_MARK[verdict.verdict]} </span>{d.verdict[verdict.verdict]}
      </span>
    </div>
    <p className="mt-1 text-sm text-ink-2">{verdict.basis === "performance" ? d.basisPerformance : d.basisNone}</p>
    <p className="mt-1 text-sm text-ink-2">{d.perfHint}</p>

    {!boulder && !route && !others.length ? <p className="mt-3 text-sm text-ink-3">{d.perfEmpty}</p>
      : <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        {boulder ? <li className="rounded-2xl bg-surface-2 p-3" data-testid="harmonised-boulder">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold">{h.boulderTitle}</span>
            <span className="flex items-center gap-1.5">
              <span className="rounded-full border border-warn/40 px-2 py-0.5 text-xs font-bold text-ink-2">{h.converted}</span>
              {direction(boulder)}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-2">
            {bestOf(boulder) ? <>{fmt(d.perfBest, { grade: bestOf(boulder)!.display })}{" · "}</> : null}{counts(boulder)}
          </p>
          {extra?.boulderEntries.length ? <>
            <p className="mt-2 text-xs font-semibold text-ink-3">{h.entriesLabel}</p>
            <ul className="mt-1 space-y-0.5 text-sm">
              {extra.boulderEntries.map((p, i) => <li key={`${p.date}-${i}`} className="flex flex-wrap items-baseline justify-between gap-x-2">
                <span><span className="font-bold">{p.display}</span>
                  {p.native && p.native.system !== "FONT" ? <span className="text-ink-2"> ← {native(p.native.system, p.native.grade)}</span> : null}</span>
                {p.source && p.source !== "FONT_NATIVE" ? <span className="text-xs text-ink-3">{h.source[p.source]} · {h.confidence[confidenceBand(p.confidence ?? 0)]}</span> : null}
              </li>)}
            </ul>
          </> : null}
          {extra?.bySystem.length ? <p className="mt-2 text-xs text-ink-3">{fmt(h.fromScales, {
            list: extra.bySystem.map((s) => fmt(h.scaleCount, { scale: scaleName[s.system] ?? s.system, n: s.sends })).join(" · "),
          })}</p> : null}
          {extra?.unconverted ? <p className="mt-1 text-xs text-ink-3">{fmt(h.unconverted, { n: extra.unconverted })}</p> : null}
          <Link href="/settings/grades" className="mt-2 inline-flex min-h-11 items-center text-sm font-bold text-accent underline underline-offset-2">{h.refine}</Link>
        </li> : null}

        {route ? <li className="rounded-2xl bg-surface-2 p-3" data-testid="harmonised-route">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-sm font-bold">{h.routeTitle}</span>
            <span className="flex items-center gap-1.5">
              <span className="rounded-full border border-line px-2 py-0.5 text-xs font-bold text-ink-2">{h.asLogged}</span>
              {direction(route)}
            </span>
          </div>
          <p className="mt-1 text-xs text-ink-2">
            {bestOf(route) ? <>{fmt(d.perfBest, { grade: bestOf(route)!.display })}{" · "}</> : null}{counts(route)}
          </p>
          {extra?.routeEntries.length ? <>
            <p className="mt-2 text-xs font-semibold text-ink-3">{h.entriesLabel}</p>
            <ul className="mt-1 space-y-0.5 text-sm">
              {extra.routeEntries.map((p, i) => <li key={`${p.date}-${i}`}>
                <span className="font-bold">{p.display}</span>
                {p.native ? <span className="text-ink-2"> · {native(p.native.system, p.native.grade)}</span> : null}
              </li>)}
            </ul>
          </> : null}
        </li> : null}

        {others.map((tr) => <li key={tr.key} className="rounded-2xl bg-surface-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold">{otherName(tr)}</span>
            {direction(tr)}
          </div>
          <p className="mt-1 text-xs text-ink-2">
            {bestOf(tr) ? <>{fmt(d.perfBest, { grade: bestOf(tr)!.display })}{" · "}</> : null}{counts(tr)}
          </p>
        </li>)}
      </ul>}

    {detail.length ? <Fold title={h.detailTitle} hint={h.detailHint} className="mt-3" testId="results-detail">
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {detail.map((tr) => <li key={tr.key} className="rounded-2xl bg-surface-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm font-bold">{otherName(tr)}</span>
            {direction(tr)}
          </div>
          <p className="mt-1 text-xs text-ink-2">
            {bestOf(tr) ? <>{fmt(d.perfBest, { grade: nativeBest(tr, bestOf(tr)!) })}{" · "}</> : null}{counts(tr)}
          </p>
        </li>)}
      </ul>
    </Fold> : null}
  </div>;
}
