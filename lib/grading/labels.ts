import type { GradeSystem } from "@/lib/climbing/types";
import { fmt, type Dictionary } from "@/lib/i18n";
import { getGradeDefinition } from "./ordering";
import { isColorSystem } from "./systems";

/**
 * Human label for a native grade ("Rouge", "6C+", "Rose", "Niv. 7").
 * Climbing District levels always carry their "level" prefix, so a bare "7"
 * is never mistaken for a Font or French grade.
 */
export function gradeLabel(t: Dictionary, system: GradeSystem, grade: string): string {
  if (isColorSystem(system) || system === "UNKNOWN") {
    return (t.grades.colors as Record<string, string>)[grade] ?? grade;
  }
  if (system === "CLIMBING_DISTRICT_LEVEL") return fmt(t.grades.level, { n: grade });
  return grade;
}

/** Long, spoken form of a grade (accessible names): "Niveau 7", "Rouge", "6C+". */
export function gradeSpokenLabel(t: Dictionary, system: GradeSystem, grade: string): string {
  if (system === "CLIMBING_DISTRICT_LEVEL") return fmt(t.grades.levelLong, { n: grade });
  return gradeLabel(t, system, grade);
}

/** Published qualitative meaning for network colours, if any. */
export function gradeMeaning(t: Dictionary, system: GradeSystem, grade: string): string | null {
  const key = getGradeDefinition(system, grade)?.meaningKey;
  return key ? ((t.grades.meanings as Record<string, string>)[key] ?? null) : null;
}
