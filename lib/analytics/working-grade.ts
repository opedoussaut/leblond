import type { GradeSystem } from "@/lib/climbing/types";
import {
  FONT_SCALE,
  gradeToScore,
  isOrderedSystem,
  isReliable,
  listGrades,
  resolveNormalized,
} from "@/lib/grading";
import { attemptsInLastDays, computeProblemOutcomes } from "./outcomes";
import type { AttemptFact, ProblemFact } from "./types";

/**
 * Working grade / working level.
 *
 * NOT the hardest-ever send. A level qualifies when, within the window:
 *   - at least `minProblems` distinct problems were attempted at that level,
 *   - at least `minSends` of them were sent,
 *   - send rate (sent ÷ attempted problems) ≥ `minSendRate`.
 * The working level is the HIGHEST qualifying level.
 *
 * Colour systems are evaluated natively, independently from each other.
 * The Font working grade uses only reliable normalised estimates (see
 * lib/grading/normalization.ts) and is null when data is insufficient.
 */
export interface WorkingLevelRule {
  windowDays: number;
  minProblems: number;
  minSends: number;
  minSendRate: number;
}

export const DEFAULT_WORKING_LEVEL_RULE: WorkingLevelRule = {
  windowDays: 60,
  minProblems: 5,
  minSends: 3,
  minSendRate: 0.4,
};

export interface LevelStats {
  grade: string;
  problems: number;
  sends: number;
  sendRate: number | null;
  qualifies: boolean;
}

export interface WorkingLevelResult {
  system: GradeSystem | "FONT_NORMALIZED";
  level: string | null;
  levels: LevelStats[];
  rule: WorkingLevelRule;
  /** Problems considered in the window for this system. */
  sampleSize: number;
}

function evaluate(
  gradeOf: Map<string, string>,
  order: readonly string[],
  attempts: AttemptFact[],
  rule: WorkingLevelRule,
): { level: string | null; levels: LevelStats[]; sampleSize: number } {
  const outcomes = computeProblemOutcomes(attempts.filter((a) => gradeOf.has(a.problemId)));
  const byGrade = new Map<string, { problems: number; sends: number }>();
  for (const o of outcomes.values()) {
    const g = gradeOf.get(o.problemId)!;
    const s = byGrade.get(g) ?? { problems: 0, sends: 0 };
    s.problems++;
    if (o.sent) s.sends++;
    byGrade.set(g, s);
  }
  const levels: LevelStats[] = order
    .filter((g) => byGrade.has(g))
    .map((grade) => {
      const s = byGrade.get(grade)!;
      const sendRate = s.problems > 0 ? s.sends / s.problems : null;
      return {
        grade,
        problems: s.problems,
        sends: s.sends,
        sendRate,
        qualifies:
          s.problems >= rule.minProblems && s.sends >= rule.minSends && (sendRate ?? 0) >= rule.minSendRate,
      };
    });
  const qualifying = levels.filter((l) => l.qualifies);
  return {
    level: qualifying.length ? qualifying[qualifying.length - 1].grade : null,
    levels,
    sampleSize: outcomes.size,
  };
}

/** Native working level for one ordered colour (or Font) system. */
export function calculateNativeWorkingLevel(
  system: GradeSystem,
  problems: ProblemFact[],
  attempts: AttemptFact[],
  now: Date,
  rule: WorkingLevelRule = DEFAULT_WORKING_LEVEL_RULE,
): WorkingLevelResult {
  const gradeOf = new Map<string, string>();
  if (isOrderedSystem(system)) {
    for (const p of problems) {
      // Mystery (PINK) and unordered grades cannot be ranked → excluded.
      if (p.nativeGradeSystem === system && gradeToScore(system, p.nativeGrade) !== null) {
        gradeOf.set(p.id, p.nativeGrade);
      }
    }
  }
  const order = listGrades(system)
    .filter((g) => g.ordinal !== null)
    .map((g) => g.id);
  const windowed = attemptsInLastDays(attempts, rule.windowDays, now);
  return { system, rule, ...evaluate(gradeOf, order, windowed, rule) };
}

/** Font working grade from reliable normalised estimates across all gyms. */
export function calculateWorkingGrade(
  problems: ProblemFact[],
  attempts: AttemptFact[],
  now: Date,
  rule: WorkingLevelRule = DEFAULT_WORKING_LEVEL_RULE,
): WorkingLevelResult {
  const gradeOf = new Map<string, string>();
  for (const p of problems) {
    const est = resolveNormalized(p);
    if (isReliable(est)) gradeOf.set(p.id, est.grade);
  }
  const windowed = attemptsInLastDays(attempts, rule.windowDays, now);
  return { system: "FONT_NORMALIZED", rule, ...evaluate(gradeOf, FONT_SCALE, windowed, rule) };
}

/** Native working levels for every ordered system the climber has used. */
export function calculateAllNativeWorkingLevels(
  problems: ProblemFact[],
  attempts: AttemptFact[],
  now: Date,
  rule: WorkingLevelRule = DEFAULT_WORKING_LEVEL_RULE,
): WorkingLevelResult[] {
  const systems = new Set<GradeSystem>();
  for (const p of problems) if (isOrderedSystem(p.nativeGradeSystem)) systems.add(p.nativeGradeSystem);
  return [...systems].map((s) => calculateNativeWorkingLevel(s, problems, attempts, now, rule));
}
