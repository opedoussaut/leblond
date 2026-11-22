import type { AttemptResult, GradeSystem, GymBrand, StyleTag, WallAngle } from "@/lib/climbing/types";
import type { ConversionSource, FontSpan } from "@/lib/grading/harmonise";
import type { FontGrade } from "@/lib/grading/systems";

/**
 * Input facts for the analytics engine. These are plain data, decoupled from
 * Supabase rows, so every analytics function is a pure, testable function.
 */

export interface GymFact {
  id: string;
  name: string;
  brand: GymBrand;
  gradingSystem: GradeSystem;
}

export interface ProblemFact {
  id: string;
  gymId: string;
  nativeGrade: string;
  nativeGradeSystem: GradeSystem;
  normalizedGrade?: string | null;
  normalizedGradeSystem?: string | null;
  normalizationConfidence?: number | null;
  normalizationSource?: string | null;
  wallAngle: WallAngle;
  tags: StyleTag[];
  /** Set on the Font view (font-view.ts): the grade as logged and how it became Font; null when nothing converts it. */
  conversion?: ProblemConversion | null;
}

/** How one boulder reads on Font (lib/analytics/font-view.ts). An estimate unless the source is FONT_NATIVE. */
export type ProblemConversion = {
  native: { system: GradeSystem; grade: string };
  /** The one Font grade the boulder counts at. */
  grade: FontGrade;
  /** The span it came from (a single grade for Font and per-problem estimates). */
  span: FontSpan;
  source: ConversionSource;
  confidence: number;
};

export interface AttemptFact {
  id: string;
  problemId: string;
  sessionId: string;
  result: AttemptResult;
  /** Attempt number for this climber on this problem, across all sessions (1-based). */
  attemptNumber: number;
  createdAt: Date;
}

export interface WearableFact {
  provider: string;
  durationSeconds: number | null;
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  calories: number | null;
  trainingLoad: number | null;
  deviceName: string | null;
}

export interface SessionFact {
  id: string;
  gymId: string;
  startedAt: Date;
  endedAt: Date | null;
  durationMinutes: number | null;
  wearable?: WearableFact | null;
}

export interface ClimbingDataset {
  gyms: GymFact[];
  problems: ProblemFact[];
  attempts: AttemptFact[];
  sessions: SessionFact[];
}

/** Outcome of one problem over a set of attempts. */
export interface ProblemOutcome {
  problemId: string;
  attempts: number;
  sent: boolean;
  flashed: boolean;
  /** Attempt number (global, 1-based) of the first send, or null. */
  attemptsToSend: number | null;
  firstAttemptAt: Date;
  lastAttemptAt: Date;
}

/** A ratio together with the counts that produced it (never a bare percentage). */
export interface Ratio {
  numerator: number;
  denominator: number;
  value: number | null;
}

export function ratio(numerator: number, denominator: number): Ratio {
  return { numerator, denominator, value: denominator > 0 ? numerator / denominator : null };
}

export const DAY_MS = 86_400_000;
