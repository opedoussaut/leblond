import type { GradeSystem } from "@/lib/climbing/types";
import { FONT_SCALE, type FontGrade } from "./systems";

/**
 * Indicative Fontainebleau ranges for gym colour circuits.
 *
 * SOURCES
 *  - Vertical'Art: OFFICIAL, from the gym's FAQ (https://www.vertical-art.fr/faq/):
 *    blanc 3a/3c, orange 4a/4c, vert 5a/5c, bleu 6a/6b, rouge 6c/7a, noir 7a/7b, violet 7b+ et au-delà.
 *  - Arkose, Climbing District, Block'Out: the LEBLOND reference table
 *    (docs/grade-reference.csv), which maps each Arkose sub-level to a Bleau
 *    anchor and to the equivalent level of other Paris gyms:
 *      Arkose = the Bleau anchors of the colour's five sub-levels;
 *      Climbing District = every row whose CD anchor names that colour;
 *      Block'Out = every row whose Block'Out anchor names that level.
 *  - Climb Up publishes no equivalence and its colour order differs from the
 *    table's anchors, so no range is shown for Climb Up.
 *
 * These are ESTIMATES shown next to the native grade, never stored in place of
 * it, and never used as a measured grade. Colours with no row in the table
 * (Climbing District white/orange, the mystery pink, independent gyms' custom
 * colours) have no estimate.
 */
export type FontRange = { from: FontGrade; to: FontGrade; openEnded?: boolean; official?: boolean };

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
  VERTICAL_ART_COLOR: {
    WHITE: { from: "3a", to: "3c", official: true },
    ORANGE: { from: "4a", to: "4c", official: true },
    GREEN: { from: "5a", to: "5c", official: true },
    BLUE: { from: "6A", to: "6B", official: true },
    RED: { from: "6C", to: "7A", official: true },
    BLACK: { from: "7A", to: "7B", official: true },
    PURPLE: { from: "7B+", to: "7B+", openEnded: true, official: true },
  },
  BLOCKOUT_LEVEL: {
    B1: { from: "4a", to: "4c" }, B2: { from: "5a", to: "5a" }, B3: { from: "5b", to: "5b" },
    B4: { from: "5c", to: "5c" }, B5: { from: "6A", to: "6A+" }, B6: { from: "6A+", to: "6B" },
    B7: { from: "6B+", to: "6B+" }, B8: { from: "6C", to: "6C" }, B9: { from: "6C+", to: "6C+" },
    B10: { from: "7A", to: "7A" }, B11: { from: "7A+", to: "7A+" }, B12: { from: "7B", to: "7B" },
    B13: { from: "7B+", to: "7B+" }, B14: { from: "7C", to: "7C+" },
  },
};

/** Indicative Font range for a native boulder grade, or null when the table has none. */
export function fontRangeFor(system: GradeSystem, grade: string): FontRange | null {
  return RANGES[system]?.[grade] ?? null;
}

export function formatFontRange(range: FontRange): string {
  if (range.openEnded) return `≥ ${range.from}`;
  return range.from === range.to ? `≈ ${range.from}` : `≈ ${range.from}–${range.to}`;
}

/** Midpoint of a range on the Font scale (used only to order estimates, never as a grade). */
export function fontRangeMidpoint(range: FontRange): number {
  return (FONT_SCALE.indexOf(range.from) + FONT_SCALE.indexOf(range.to)) / 2;
}

/** Colour-graded systems whose routes need a French-scale equivalent alongside the native colour. */
export function isColourSystem(system: GradeSystem): boolean {
  return system !== "FONT" && system !== "UNKNOWN" && system !== "BLOCKOUT_LEVEL";
}
