import type { GradeSystem } from "@/lib/climbing/types";
import { convertBoulder, formatSpan, type ConversionTable } from "@/lib/grading/harmonise";
import type { PerfPoint, PerfSeries, PerfTrend, TrainingLoadReport } from "./training-load";
import type { AttemptFact, ProblemFact } from "./types";

/**
 * Results on two common scales: every boulder on Font (converted through the
 * correspondence table, an estimate). Routes need no conversion: routePerf
 * (training-load.ts) already reads them on the French scale, as logged. Each point keeps the grade as logged, so the page can show it next
 * to the converted one. Pure: the table comes in, nothing is stored.
 */

const isSend = (r: AttemptFact["result"]) => r === "TOP" || r === "FLASH";

export const HARMONISED_BOULDER_KEY = "boulder:FONT_CONVERTED";

export type HarmonisedBoulders = {
  series: PerfSeries | null;
  /** First sends per native scale that went into the series (most first). */
  bySystem: Array<{ system: GradeSystem; sends: number }>;
  /** First sends with no conversion (custom colours, the mystery pink…), left out of the series. */
  unconverted: number;
};

/** First send of each boulder, every scale converted to Font, in one series. */
export function harmonisedBoulderPerf(problems: readonly ProblemFact[], attempts: readonly AttemptFact[], table: ConversionTable): HarmonisedBoulders {
  const byId = new Map(problems.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const points: PerfPoint[] = [];
  const counts = new Map<GradeSystem, number>();
  let unconverted = 0;
  for (const a of [...attempts].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())) {
    if (!isSend(a.result) || seen.has(a.problemId)) continue;
    seen.add(a.problemId);
    const p = byId.get(a.problemId);
    if (!p) continue;
    const c = convertBoulder(p, table);
    if (!c) { unconverted++; continue; }
    points.push({
      date: a.createdAt.toISOString().slice(0, 10), score: c.score, display: formatSpan(c),
      native: { system: p.nativeGradeSystem, grade: p.nativeGrade }, confidence: c.confidence, source: c.source,
    });
    counts.set(p.nativeGradeSystem, (counts.get(p.nativeGradeSystem) ?? 0) + 1);
  }
  return {
    series: points.length ? { key: HARMONISED_BOULDER_KEY, kind: "boulder", converted: true, threshold: 0.5, points } : null,
    bySystem: [...counts].map(([system, sends]) => ({ system, sends })).sort((a, b) => b.sends - a.sends || a.system.localeCompare(b.system)),
    unconverted,
  };
}

/**
 * The best results of a trend's recent window (or the previous one when the
 * recent one is empty), hardest first, for the entries under a card.
 */
export function bestEntries(trend: PerfTrend, today: string, windowDays = 42, n = 3): PerfPoint[] {
  const recentFrom = shift(today, -(windowDays - 1)), previousFrom = shift(today, -(2 * windowDays - 1));
  const recent = trend.series.points.filter((p) => p.date >= recentFrom && p.date <= today);
  const pool = recent.length ? recent : trend.series.points.filter((p) => p.date >= previousFrom && p.date < recentFrom);
  return [...pool].sort((a, b) => b.score - a.score || b.date.localeCompare(a.date)).slice(0, n);
}

/** Lowest confidence among the points of a converted window: what the card admits to. */
export function weakestConfidence(points: readonly PerfPoint[]): number | null {
  const list = points.map((p) => p.confidence).filter((c): c is number => typeof c === "number");
  return list.length ? Math.min(...list) : null;
}

/** What the two-scale cards show beyond the trend: sources of the converted series and the best entries of each card. */
export function harmonisedSummary(trends: readonly PerfTrend[], boulders: HarmonisedBoulders, today: string): NonNullable<TrainingLoadReport["harmonised"]> {
  const boulderTrend = trends.find((tr) => tr.key === HARMONISED_BOULDER_KEY);
  const routeTrend = trends.find((tr) => tr.kind === "route");
  const boulderEntries = boulderTrend ? bestEntries(boulderTrend, today) : [];
  return {
    bySystem: boulders.bySystem, unconverted: boulders.unconverted, boulderEntries,
    routeEntries: routeTrend ? bestEntries(routeTrend, today) : [], weakestConfidence: weakestConfidence(boulderEntries),
  };
}

function shift(day: string, days: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
