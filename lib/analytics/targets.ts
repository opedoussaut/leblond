import type { GradeSystem, StyleTag } from "@/lib/climbing/types";
import { gradeToScore, isReliable, resolveNormalized } from "@/lib/grading";
import { attemptsInLastDays, attemptsInWindow, calculateAttemptsPerSend, computeProblemOutcomes } from "./outcomes";
import { calculateRecentTrend } from "./progress";
import { calculateStyleStats } from "./styles";
import { DAY_MS, type AttemptFact, type ProblemFact } from "./types";
import {
  calculateNativeWorkingLevel,
  calculateWorkingGrade,
  DEFAULT_WORKING_LEVEL_RULE,
  type WorkingLevelResult,
} from "./working-grade";

/**
 * ROAD TO TARGET — deterministic dimensions, deliberately NOT collapsed into a
 * single "% to target" score (no validated formula exists for that).
 * Every dimension returns its status AND the evidence that produced it.
 */

export type DimensionStatus =
  | "strong"
  | "improving"
  | "stable"
  | "developing"
  | "needs_work"
  | "declining"
  | "insufficient_data";

export type DimensionKey =
  | "grade_exposure"
  | "consistency"
  | "flash_ability"
  | "efficiency"
  | "style_coverage"
  | "recent_progression";

export interface Dimension {
  key: DimensionKey;
  status: DimensionStatus;
  evidence: Record<string, number | string | null>;
}

export interface RoadToTarget {
  targetGrade: string;
  /** "FONT" uses reliable normalised estimates; colour systems use native grades. */
  targetSystem: GradeSystem;
  workingLevel: WorkingLevelResult;
  dimensions: Dimension[];
}

const WINDOW_DAYS = DEFAULT_WORKING_LEVEL_RULE.windowDays;

function scaleScores(problems: ProblemFact[], system: GradeSystem): Map<string, number> {
  const scores = new Map<string, number>();
  for (const p of problems) {
    if (system === "FONT") {
      const est = resolveNormalized(p);
      if (isReliable(est)) scores.set(p.id, gradeToScore("FONT", est.grade)!);
    } else if (p.nativeGradeSystem === system) {
      const s = gradeToScore(system, p.nativeGrade);
      if (s !== null) scores.set(p.id, s);
    }
  }
  return scores;
}

export function calculateRoadToTarget(
  targetGrade: string,
  targetSystem: GradeSystem,
  problems: ProblemFact[],
  attempts: AttemptFact[],
  now: Date,
): RoadToTarget {
  const targetScore = gradeToScore(targetSystem, targetGrade);
  const scores = scaleScores(problems, targetSystem);
  const windowed = attemptsInLastDays(attempts, WINDOW_DAYS, now).filter((a) => scores.has(a.problemId));
  const outcomes = computeProblemOutcomes(windowed);
  const sample = outcomes.size;
  const enough = sample >= DEFAULT_WORKING_LEVEL_RULE.minProblems;

  const workingLevel =
    targetSystem === "FONT"
      ? calculateWorkingGrade(problems, attempts, now)
      : calculateNativeWorkingLevel(targetSystem, problems, attempts, now);
  const workingScore = workingLevel.level ? gradeToScore(targetSystem, workingLevel.level) : null;

  const dims: Dimension[] = [];

  // 1. Grade exposure: problems tried at the target grade or one step below.
  {
    let exposure = 0;
    if (targetScore !== null) {
      for (const o of outcomes.values()) if (scores.get(o.problemId)! >= targetScore - 1) exposure++;
    }
    dims.push({
      key: "grade_exposure",
      status:
        !enough || targetScore === null
          ? "insufficient_data"
          : exposure >= 5
            ? "strong"
            : exposure >= 1
              ? "developing"
              : "needs_work",
      evidence: { problemsNearTarget: exposure, windowDays: WINDOW_DAYS, sample },
    });
  }

  // 2. Consistency: distance between the working level and the target.
  {
    const gap = targetScore !== null && workingScore !== null ? targetScore - workingScore : null;
    dims.push({
      key: "consistency",
      status: gap === null ? "insufficient_data" : gap <= 0 ? "strong" : gap === 1 ? "developing" : "needs_work",
      evidence: { workingLevel: workingLevel.level, gradeStepsToTarget: gap },
    });
  }

  // 3. Flash ability: hardest flash in the window vs working level.
  {
    let bestFlash: number | null = null;
    for (const o of outcomes.values()) {
      if (o.flashed) bestFlash = Math.max(bestFlash ?? -1, scores.get(o.problemId)!);
    }
    const gap = bestFlash !== null && workingScore !== null ? workingScore - bestFlash : null;
    dims.push({
      key: "flash_ability",
      status:
        workingScore === null
          ? "insufficient_data"
          : bestFlash === null
            ? "needs_work"
            : gap! <= 1
              ? "strong"
              : gap === 2
                ? "developing"
                : "needs_work",
      evidence: { gradeStepsBelowWorkingLevel: gap },
    });
  }

  // 4. Efficiency: attempts per send, last 30 days vs the 30 before.
  {
    const mid = new Date(now.getTime() - 30 * DAY_MS);
    const start = new Date(now.getTime() - 60 * DAY_MS);
    const end = new Date(now.getTime() + 1);
    const recent = calculateAttemptsPerSend(
      computeProblemOutcomes(attemptsInWindow(attempts, mid, end).filter((a) => scores.has(a.problemId))).values(),
    );
    const previous = calculateAttemptsPerSend(
      computeProblemOutcomes(attemptsInWindow(attempts, start, mid).filter((a) => scores.has(a.problemId))).values(),
    );
    let status: DimensionStatus = "insufficient_data";
    if (recent.value !== null && previous.value !== null && recent.sends >= 3 && previous.sends >= 3) {
      const change = (recent.value - previous.value) / previous.value;
      status = change <= -0.1 ? "improving" : change >= 0.1 ? "declining" : "stable";
    }
    dims.push({
      key: "efficiency",
      status,
      evidence: { recentAttemptsPerSend: recent.value, previousAttemptsPerSend: previous.value },
    });
  }

  // 5. Style coverage: distinct styles with at least 3 tagged problems in the window.
  {
    const windowProblems = problems.filter((p) => outcomes.has(p.id));
    const stats = calculateStyleStats(windowProblems, outcomes);
    const covered = stats.filter((s) => s.problems >= 3).map((s) => s.key as StyleTag);
    const tagged = windowProblems.filter((p) => p.tags.length > 0).length;
    dims.push({
      key: "style_coverage",
      status: tagged === 0 ? "insufficient_data" : covered.length >= 6 ? "strong" : covered.length >= 3 ? "developing" : "needs_work",
      evidence: { stylesCovered: covered.length, taggedProblems: tagged },
    });
  }

  // 6. Recent progression: trend of hardest sends on the target scale.
  {
    const trend = calculateRecentTrend(targetSystem === "FONT" ? "FONT_NORMALIZED" : targetSystem, problems, attempts, now);
    dims.push({
      key: "recent_progression",
      status: trend.direction === "insufficient_data" ? "insufficient_data" : trend.direction,
      evidence: { recentScore: trend.recentScore, previousScore: trend.previousScore },
    });
  }

  return { targetGrade, targetSystem, workingLevel, dimensions: dims };
}
