import type { GradeSystem } from "@/lib/climbing/types";
import type { ClimbingDataset } from "@/lib/analytics";
import { calculateNativeWorkingLevel, calculateWorkingGrade } from "@/lib/analytics";
import { gradeToScore, isOrderedSystem } from "@/lib/grading";
import { elapsedWeeks } from "./assessment";

export interface ObservedWorkingGrade {
  week: number;
  grade: string;
  /** Index on one native system. Only meaningful for the same grade scale. */
  ordinal: number;
  sampleSize: number;
}

/**
 * Deterministic history of EXISTING logged climbs, re-evaluated at each
 * elapsed assessment week using the established 60-day working-level rule.
 * Never interpolates unavailable grades or predicts future climbing levels.
 */
export function workingGradeHistory(
  data: Pick<ClimbingDataset, "problems" | "attempts">,
  system: GradeSystem,
  startedAt: string,
  horizonWeeks: number,
  now: Date,
): ObservedWorkingGrade[] {
  if (!isOrderedSystem(system)) return [];
  const startMs = new Date(startedAt).getTime();
  if (!Number.isFinite(startMs)) return [];
  const weeks = Math.min(24, horizonWeeks, elapsedWeeks(startedAt, now));
  const result: ObservedWorkingGrade[] = [];
  for (let week = 0; week <= weeks; week++) {
    const at = new Date(startMs + week * 7 * 86_400_000);
    const working = system === "FONT"
      ? calculateWorkingGrade(data.problems, data.attempts, at)
      : calculateNativeWorkingLevel(system, data.problems, data.attempts, at);
    if (!working.level) continue;
    const score = gradeToScore(system, working.level);
    if (score === null) continue;
    result.push({ week, grade: working.level, ordinal: score, sampleSize: working.sampleSize });
  }
  return result;
}
