import type { GradeSystem } from "@/lib/climbing/types";
import {
  FONT_SCALE,
  gradeToScore,
  isReliable,
  listGrades,
  maxGrade,
  resolveNormalized,
  type NormalizedEstimate,
} from "@/lib/grading";
import type { ProblemFact, ProblemOutcome } from "./types";

export interface HighestGrade {
  system: GradeSystem;
  grade: string;
  /** Font estimate for that specific problem, if one exists (with its provenance). */
  normalized: NormalizedEstimate | null;
}

function highestBy(
  problems: ProblemFact[],
  outcomes: Map<string, ProblemOutcome>,
  predicate: (o: ProblemOutcome) => boolean,
): HighestGrade[] {
  const bySystem = new Map<GradeSystem, ProblemFact[]>();
  for (const p of problems) {
    const o = outcomes.get(p.id);
    if (!o || !predicate(o)) continue;
    const list = bySystem.get(p.nativeGradeSystem) ?? [];
    list.push(p);
    bySystem.set(p.nativeGradeSystem, list);
  }
  const result: HighestGrade[] = [];
  for (const [system, list] of bySystem) {
    const top = maxGrade(
      system,
      list.map((p) => p.nativeGrade),
    );
    if (top === null) continue;
    // Among problems at that native grade, keep the best reliable estimate (if any).
    const estimates = list
      .filter((p) => p.nativeGrade === top)
      .map((p) => resolveNormalized(p))
      .filter(isReliable)
      .sort((a, b) => (gradeToScore("FONT", b.grade) ?? 0) - (gradeToScore("FONT", a.grade) ?? 0));
    result.push({ system, grade: top, normalized: estimates[0] ?? null });
  }
  return result;
}

/** Highest native grade sent, per grading system (mystery/unordered grades excluded). */
export function calculateHighestSentGrade(
  problems: ProblemFact[],
  outcomes: Map<string, ProblemOutcome>,
): HighestGrade[] {
  return highestBy(problems, outcomes, (o) => o.sent);
}

/** Highest native grade flashed, per grading system. */
export function calculateHighestFlashedGrade(
  problems: ProblemFact[],
  outcomes: Map<string, ProblemOutcome>,
): HighestGrade[] {
  return highestBy(problems, outcomes, (o) => o.flashed);
}

/** Highest reliably-estimated Font grade sent across all systems. */
export function calculateHighestSentNormalized(
  problems: ProblemFact[],
  outcomes: Map<string, ProblemOutcome>,
): NormalizedEstimate | null {
  let best: NormalizedEstimate | null = null;
  for (const p of problems) {
    if (!outcomes.get(p.id)?.sent) continue;
    const est = resolveNormalized(p);
    if (!isReliable(est)) continue;
    if (!best || (gradeToScore("FONT", est.grade) ?? -1) > (gradeToScore("FONT", best.grade) ?? -1)) best = est;
  }
  return best;
}

export interface GradeBucket {
  grade: string;
  attempted: number;
  sent: number;
  flashed: number;
}

export interface NativeDistribution {
  system: GradeSystem;
  buckets: GradeBucket[];
}

/** Attempted/sent counts per native grade, one block per grading system. */
export function calculateNativeDistribution(
  problems: ProblemFact[],
  outcomes: Map<string, ProblemOutcome>,
): NativeDistribution[] {
  const bySystem = new Map<GradeSystem, Map<string, GradeBucket>>();
  for (const p of problems) {
    const o = outcomes.get(p.id);
    if (!o) continue;
    let buckets = bySystem.get(p.nativeGradeSystem);
    if (!buckets) {
      buckets = new Map();
      bySystem.set(p.nativeGradeSystem, buckets);
    }
    const b = buckets.get(p.nativeGrade) ?? { grade: p.nativeGrade, attempted: 0, sent: 0, flashed: 0 };
    b.attempted++;
    if (o.sent) b.sent++;
    if (o.flashed) b.flashed++;
    buckets.set(p.nativeGrade, b);
  }
  const result: NativeDistribution[] = [];
  for (const [system, buckets] of bySystem) {
    const order = listGrades(system).map((g) => g.id);
    const sorted = [...buckets.values()].sort((a, b) => order.indexOf(a.grade) - order.indexOf(b.grade));
    result.push({ system, buckets: sorted });
  }
  return result;
}

export interface NormalizedDistribution {
  buckets: GradeBucket[];
  /** Problems with a reliable Font estimate vs all attempted problems — shown with the view. */
  coverage: { reliable: number; uncertain: number; none: number; total: number };
  /** Whether there is enough reliable data to show the normalised view at all. */
  sufficient: boolean;
}

export const MIN_RELIABLE_FOR_NORMALIZED_VIEW = 10;

/**
 * Attempted/sent counts per Font grade, using ONLY reliable estimates.
 * Coverage is always returned so the UI can state how much data was excluded.
 */
export function calculateNormalizedDistribution(
  problems: ProblemFact[],
  outcomes: Map<string, ProblemOutcome>,
  minReliable = MIN_RELIABLE_FOR_NORMALIZED_VIEW,
): NormalizedDistribution {
  const buckets = new Map<string, GradeBucket>();
  const coverage = { reliable: 0, uncertain: 0, none: 0, total: 0 };
  for (const p of problems) {
    const o = outcomes.get(p.id);
    if (!o) continue;
    coverage.total++;
    const est = resolveNormalized(p);
    if (!est) {
      coverage.none++;
      continue;
    }
    if (!isReliable(est)) {
      coverage.uncertain++;
      continue;
    }
    coverage.reliable++;
    const b = buckets.get(est.grade) ?? { grade: est.grade, attempted: 0, sent: 0, flashed: 0 };
    b.attempted++;
    if (o.sent) b.sent++;
    if (o.flashed) b.flashed++;
    buckets.set(est.grade, b);
  }
  const order: readonly string[] = FONT_SCALE;
  return {
    buckets: [...buckets.values()].sort((a, b) => order.indexOf(a.grade) - order.indexOf(b.grade)),
    coverage,
    sufficient: coverage.reliable >= minReliable,
  };
}
