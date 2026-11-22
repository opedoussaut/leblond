import type { GradeSystem } from "@/lib/climbing/types";
import { FONT_SCALE, gradeSystemKind, type FontGrade } from "./systems";
import { boulderGrade } from "./display";
import { DEFAULT_BOULDER_TABLE, type TableLine } from "./harmonise";

/**
 * The "≈ range" shown next to a native grade while logging (grade chips, the
 * live-session and quick-entry pickers).
 *
 * It reads the same default correspondence as Progrès (harmonise.ts
 * DEFAULT_BOULDER_TABLE), so a colour shows the same Font span in both places.
 * Sources and confidences live there: Vertical'Art published by the gym, Kaskad
 * observed for Arkose and Block'Out, a shared summary for Climbing District,
 * first LEBLOND estimates for Climb World, Climb Up, MROC and Le Labo.
 *
 * These are ESTIMATES shown next to the native grade, never stored in place of
 * it. Grades with no line (the mystery pink, independent gyms' custom colours,
 * Font itself) show nothing.
 */
export type FontRange = { from: FontGrade; to: FontGrade; source: TableLine["source"]; openEnded?: boolean; official?: boolean };

/** Indicative Font range for a native boulder grade, or null when the table has none. */
export function fontRangeFor(system: GradeSystem, grade: string): FontRange | null {
  const line = DEFAULT_BOULDER_TABLE[system]?.[grade];
  if (!line) return null;
  return {
    from: line.from, to: line.to, source: line.source,
    ...(line.openEnded ? { openEnded: true } : {}),
    ...(line.source === "GYM_PUBLISHED" ? { official: true } : {}),
  };
}

export function formatFontRange(range: FontRange): string {
  const from = boulderGrade(range.from), to = boulderGrade(range.to);
  if (range.openEnded) return `≥ ${from}`;
  return from === to ? `≈ ${from}` : `≈ ${from}–${to}`;
}

/** Midpoint of a range on the Font scale (used only to order estimates, never as a grade). */
export function fontRangeMidpoint(range: FontRange): number {
  return (FONT_SCALE.indexOf(range.from) + FONT_SCALE.indexOf(range.to)) / 2;
}

/** Colour-graded systems whose routes need a French-scale equivalent alongside the native colour. */
export function isColourSystem(system: GradeSystem): boolean {
  return gradeSystemKind(system) === "COLOUR";
}
