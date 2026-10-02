import type { GradeSystem } from "@/lib/climbing/types";
import { isFontGrade } from "./ordering";
import type { FontGrade } from "./systems";

/**
 * Normalised (Font) grade estimates.
 *
 * LEBLOND never derives a Font grade from a gym colour automatically. A
 * normalised grade exists only when:
 *  - the problem is natively graded in Font (confidence 1, FONT_NATIVE), or
 *  - the climber assigned an estimate (USER_ESTIMATE, confidence they chose), or
 *  - a gym published an explicit grade for that specific problem (GYM_PUBLISHED).
 *
 * Every estimate carries its confidence and provenance, and analytics only use
 * estimates at or above RELIABLE_CONFIDENCE for the normalised view.
 */

export const NORMALIZATION_SOURCES = ["FONT_NATIVE", "USER_ESTIMATE", "GYM_PUBLISHED"] as const;
export type NormalizationSource = (typeof NORMALIZATION_SOURCES)[number];

/** Estimates below this confidence are shown as uncertain and excluded from normalised analytics. */
export const RELIABLE_CONFIDENCE = 0.5;

/** Confidence presets offered to climbers when they estimate a Font grade. */
export const ESTIMATE_CONFIDENCE_PRESETS = {
  rough: 0.3,
  fairly_sure: 0.6,
  confident: 0.85,
} as const;
export type EstimateConfidencePreset = keyof typeof ESTIMATE_CONFIDENCE_PRESETS;

export interface NormalizedEstimate {
  grade: FontGrade;
  system: "FONT";
  confidence: number;
  source: NormalizationSource;
}

export interface GradedProblemLike {
  nativeGrade: string;
  nativeGradeSystem: GradeSystem;
  normalizedGrade?: string | null;
  normalizedGradeSystem?: string | null;
  normalizationConfidence?: number | null;
  normalizationSource?: string | null;
}

/** Resolve the normalised Font estimate for a problem, or null if none exists. */
export function resolveNormalized(problem: GradedProblemLike): NormalizedEstimate | null {
  if (problem.nativeGradeSystem === "FONT") {
    return isFontGrade(problem.nativeGrade)
      ? { grade: problem.nativeGrade, system: "FONT", confidence: 1, source: "FONT_NATIVE" }
      : null;
  }
  const g = problem.normalizedGrade;
  if (!g || problem.normalizedGradeSystem !== "FONT" || !isFontGrade(g)) return null;
  const confidence = clampConfidence(problem.normalizationConfidence ?? 0);
  const source = (NORMALIZATION_SOURCES as readonly string[]).includes(problem.normalizationSource ?? "")
    ? (problem.normalizationSource as NormalizationSource)
    : "USER_ESTIMATE";
  return { grade: g, system: "FONT", confidence, source };
}

export function isReliable(estimate: NormalizedEstimate | null): estimate is NormalizedEstimate {
  return estimate !== null && estimate.confidence >= RELIABLE_CONFIDENCE;
}

export function clampConfidence(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}
