import { STYLE_TAGS, WALL_ANGLES, type StyleTag, type WallAngle } from "@/lib/climbing/types";
import { ratio, type ProblemFact, type ProblemOutcome, type Ratio } from "./types";

export interface CategoryStats<K extends string> {
  key: K;
  problems: number;
  sent: number;
  flashed: number;
  sendRate: Ratio;
}

function accumulate<K extends string>(
  keysOf: (p: ProblemFact) => K[],
  allKeys: readonly K[],
  problems: ProblemFact[],
  outcomes: Map<string, ProblemOutcome>,
): CategoryStats<K>[] {
  const acc = new Map<K, { problems: number; sent: number; flashed: number }>();
  for (const p of problems) {
    const o = outcomes.get(p.id);
    if (!o) continue;
    for (const k of keysOf(p)) {
      const s = acc.get(k) ?? { problems: 0, sent: 0, flashed: 0 };
      s.problems++;
      if (o.sent) s.sent++;
      if (o.flashed) s.flashed++;
      acc.set(k, s);
    }
  }
  return allKeys
    .filter((k) => acc.has(k))
    .map((k) => {
      const s = acc.get(k)!;
      return { key: k, ...s, sendRate: ratio(s.sent, s.problems) };
    });
}

/**
 * Performance per style tag. Grades differ between styles, so these stats are
 * descriptive only — they are a starting point for interpretation, not a verdict.
 */
export function calculateStyleStats(
  problems: ProblemFact[],
  outcomes: Map<string, ProblemOutcome>,
): CategoryStats<StyleTag>[] {
  return accumulate((p) => p.tags, STYLE_TAGS, problems, outcomes);
}

/** Performance per wall angle (UNKNOWN included so nothing is silently dropped). */
export function calculateWallAngleStats(
  problems: ProblemFact[],
  outcomes: Map<string, ProblemOutcome>,
): CategoryStats<WallAngle>[] {
  return accumulate((p) => [p.wallAngle], WALL_ANGLES, problems, outcomes);
}

export const MIN_PROBLEMS_FOR_CATEGORY_VERDICT = 3;

/** Best and weakest categories by send rate among those with enough problems. */
export function rankCategories<K extends string>(
  stats: CategoryStats<K>[],
  minProblems = MIN_PROBLEMS_FOR_CATEGORY_VERDICT,
  exclude: K[] = [],
): { strongest: CategoryStats<K> | null; weakest: CategoryStats<K> | null } {
  const eligible = stats.filter((s) => s.problems >= minProblems && !exclude.includes(s.key));
  if (eligible.length === 0) return { strongest: null, weakest: null };
  const sorted = [...eligible].sort(
    (a, b) => (b.sendRate.value ?? 0) - (a.sendRate.value ?? 0) || b.problems - a.problems,
  );
  const strongest = sorted[0];
  const weakest = sorted.length > 1 ? sorted[sorted.length - 1] : null;
  return { strongest, weakest: weakest && weakest.key !== strongest.key ? weakest : null };
}
