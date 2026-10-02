import type { GradeSystem } from "@/lib/climbing/types";
import { FONT_SCALE, GRADES_BY_SYSTEM, type FontGrade, type GradeDefinition } from "./systems";

/**
 * Grade ordering utilities. All cross-grade comparisons in LEBLOND go through
 * these functions. A grade that cannot be placed on an ordinal scale (Climbing
 * District PINK, custom colours, UNKNOWN) yields `null` — callers must handle
 * "not comparable" explicitly instead of guessing.
 */

export function listGrades(system: GradeSystem): GradeDefinition[] {
  return GRADES_BY_SYSTEM[system];
}

export function getGradeDefinition(system: GradeSystem, grade: string): GradeDefinition | undefined {
  return GRADES_BY_SYSTEM[system].find((g) => g.id === grade);
}

export function isValidGrade(system: GradeSystem, grade: string): boolean {
  return getGradeDefinition(system, grade) !== undefined;
}

export function isMysteryGrade(system: GradeSystem, grade: string): boolean {
  return getGradeDefinition(system, grade)?.kind === "MYSTERY";
}

/** Ordinal score of a grade within its own system, or null if not ordered. */
export function gradeToScore(system: GradeSystem, grade: string): number | null {
  return getGradeDefinition(system, grade)?.ordinal ?? null;
}

/** Inverse of gradeToScore for ordered grades. */
export function scoreToGrade(system: GradeSystem, score: number): string | null {
  if (!Number.isInteger(score)) return null;
  return GRADES_BY_SYSTEM[system].find((g) => g.ordinal === score)?.id ?? null;
}

/**
 * Compare two grades of the SAME system.
 * Returns negative/zero/positive like a sort comparator, or null when either
 * grade is not on the ordinal scale. Grades from different systems are never
 * comparable here — cross-system comparison goes through normalisation.
 */
export function compareGrades(system: GradeSystem, a: string, b: string): number | null {
  const sa = gradeToScore(system, a);
  const sb = gradeToScore(system, b);
  if (sa === null || sb === null) return null;
  return sa - sb;
}

export function nextGrade(system: GradeSystem, grade: string): string | null {
  const s = gradeToScore(system, grade);
  return s === null ? null : scoreToGrade(system, s + 1);
}

export function previousGrade(system: GradeSystem, grade: string): string | null {
  const s = gradeToScore(system, grade);
  return s === null ? null : scoreToGrade(system, s - 1);
}

export function isFontGrade(value: string): value is FontGrade {
  return (FONT_SCALE as readonly string[]).includes(value);
}

/** Highest of a list of grades within one ordered system (ignores non-ordered grades). */
export function maxGrade(system: GradeSystem, grades: Iterable<string>): string | null {
  let best: string | null = null;
  let bestScore = -Infinity;
  for (const g of grades) {
    const s = gradeToScore(system, g);
    if (s !== null && s > bestScore) {
      best = g;
      bestScore = s;
    }
  }
  return best;
}
