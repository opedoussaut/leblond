import type { GradeSystem } from "@/lib/climbing/types";
import { FONT_SCALE, type FontGrade } from "./systems";

/**
 * Indicative Fontainebleau ranges for gym colour circuits.
 *
 * SOURCE: the LEBLOND reference table (docs/grade-reference.csv), which maps
 * each Arkose sub-level to a Bleau anchor and to the equivalent colour used by
 * other Paris gyms. Ranges below are read straight from that table:
 *  - Arkose: the Bleau anchors of the colour's five sub-levels.
 *  - Climbing District: every Arkose sub-level whose CD anchor names that colour.
 *
 * These are ESTIMATES shown next to the native grade, never stored in place of
 * it, and never used as a measured grade. Colours with no row in the table
 * (Climbing District white/orange, the mystery pink, independent gyms' custom
 * colours) have no estimate.
 */
export type FontRange = { from: FontGrade; to: FontGrade };

const RANGES: Partial<Record<GradeSystem, Record<string, FontRange>>> = {
  ARKOSE_COLOR: {
    YELLOW: { from: "3a", to: "4c" },
    GREEN: { from: "5a", to: "5c" },
    BLUE: { from: "5c", to: "6A" },
    RED: { from: "6A+", to: "6C+" },
    BLACK: { from: "7A", to: "7A+" },
    PURPLE: { from: "7B", to: "7C+" },
  },
  CLIMBING_DISTRICT_COLOR: {
    YELLOW: { from: "3a", to: "4c" },
    GREEN: { from: "5a", to: "5b" },
    BLUE: { from: "5b", to: "6A" },
    RED: { from: "6A", to: "6C" },
    BLACK: { from: "6C", to: "7A+" },
    PURPLE: { from: "7A+", to: "7C+" },
  },
};

/** Indicative Font range for a native boulder grade, or null when the table has none. */
export function fontRangeFor(system: GradeSystem, grade: string): FontRange | null {
  return RANGES[system]?.[grade] ?? null;
}

export function formatFontRange(range: FontRange): string {
  return range.from === range.to ? `≈ ${range.from}` : `≈ ${range.from}–${range.to}`;
}

/** Midpoint of a range on the Font scale (used only to order estimates, never as a grade). */
export function fontRangeMidpoint(range: FontRange): number {
  return (FONT_SCALE.indexOf(range.from) + FONT_SCALE.indexOf(range.to)) / 2;
}

/** Colour-graded systems whose routes need a French-scale equivalent alongside the native colour. */
export function isColourSystem(system: GradeSystem): boolean {
  return system !== "FONT" && system !== "UNKNOWN";
}
