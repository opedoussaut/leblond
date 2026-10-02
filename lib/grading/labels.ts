import type { GradeSystem } from "@/lib/climbing/types";
import type { Dictionary } from "@/lib/i18n";
import { getGradeDefinition } from "./ordering";
import { isColorSystem } from "./systems";

/** Human label for a native grade ("Rouge", "6C+", "Rose"). */
export function gradeLabel(t: Dictionary, system: GradeSystem, grade: string): string {
  if (isColorSystem(system) || system === "UNKNOWN") {
    return (t.grades.colors as Record<string, string>)[grade] ?? grade;
  }
  return grade;
}

/** Published qualitative meaning for network colours, if any. */
export function gradeMeaning(t: Dictionary, system: GradeSystem, grade: string): string | null {
  const key = getGradeDefinition(system, grade)?.meaningKey;
  return key ? ((t.grades.meanings as Record<string, string>)[key] ?? null) : null;
}
