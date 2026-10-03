import type { GradeSystem } from "@/lib/climbing/types";

/**
 * Native grade definitions.
 *
 * Every grade has a stable `id` (stored in `problems.native_grade`), an ordinal
 * position for ordered systems, and display hints. Colour swatches are generic
 * colours, not brand assets, and the UI ALWAYS renders the grade name next to
 * the swatch (grade is never conveyed by colour alone).
 *
 * Sources (see docs/grading.md):
 * - Arkose: https://arkose.com/groupe/actus/niveau-escalade-bloc-couleur-tout-comprendre
 * - Climbing District: https://climbingdistrict.com/infos/faq/
 */

export type GradeKind = "ORDERED" | "MYSTERY" | "UNORDERED";

export interface GradeDefinition {
  id: string;
  system: GradeSystem;
  kind: GradeKind;
  /** Ordinal within the system (0 = easiest). `null` for mystery/unordered grades. */
  ordinal: number | null;
  /** i18n key suffix for the qualitative meaning published by the network. */
  meaningKey?: string;
  swatch?: string;
  swatchText?: string;
}

function ordered(
  system: GradeSystem,
  items: Array<[id: string, meaningKey: string | undefined, swatch?: string, swatchText?: string]>,
): GradeDefinition[] {
  return items.map(([id, meaningKey, swatch, swatchText], ordinal) => ({
    id,
    system,
    kind: "ORDERED",
    ordinal,
    meaningKey,
    swatch,
    swatchText,
  }));
}

/** Arkose: Yellow → Green → Blue → Red → Black → Purple. */
export const ARKOSE_GRADES: GradeDefinition[] = ordered("ARKOSE_COLOR", [
  ["YELLOW", "initiation", "#F2C318", "#1a1400"],
  ["GREEN", "beginner", "#2E9E4F", "#ffffff"],
  ["BLUE", "intermediate", "#1F63C6", "#ffffff"],
  ["RED", "advanced", "#C8282B", "#ffffff"],
  ["BLACK", "veryGood", "#151515", "#ffffff"],
  ["PURPLE", "expert", "#6B2FA3", "#ffffff"],
]);

/**
 * Climbing District: White → … → Purple, plus Pink as a deliberately hidden
 * ("mystery") grade that is NOT placed on the ordinal scale. Climbing District
 * states that colours overlap, so ordinals express the published progression
 * only — never an exact difficulty.
 */
export const CLIMBING_DISTRICT_GRADES: GradeDefinition[] = [
  ...ordered("CLIMBING_DISTRICT_COLOR", [
    ["WHITE", "junior", "#F4F4F4", "#111111"],
    ["YELLOW", "easy", "#F2C318", "#1a1400"],
    ["ORANGE", "medium", "#EE7D1C", "#1a0d00"],
    ["GREEN", "mediumPlus", "#2E9E4F", "#ffffff"],
    ["BLUE", "strong", "#1F63C6", "#ffffff"],
    ["RED", "veryStrong", "#C8282B", "#ffffff"],
    ["BLACK", "difficult", "#151515", "#ffffff"],
    ["PURPLE", "extremelyDifficult", "#6B2FA3", "#ffffff"],
  ]),
  {
    id: "PINK",
    system: "CLIMBING_DISTRICT_COLOR",
    kind: "MYSTERY",
    ordinal: null,
    meaningKey: "mystery",
    swatch: "#E85AA6",
    swatchText: "#1a0010",
  },
];

/**
 * Fontainebleau bouldering scale, 1a → 9A.
 *
 * Below 6A the Font scale uses a lower-case letter per sub-level (1a, 1b, 1c …
 * 5c), as Boolder publishes it for the Fontainebleau circuits; from 6A it is
 * upper-case with an optional "+". Each entry is one grade step.
 * Indoor tickets that only say "4" or "5+" can be logged with the nearest
 * letter (see docs/grading.md).
 */
export const FONT_SCALE = [
  "1a", "1b", "1c",
  "2a", "2b", "2c",
  "3a", "3b", "3c",
  "4a", "4b", "4c",
  "5a", "5b", "5c",
  "6A", "6A+", "6B", "6B+", "6C", "6C+",
  "7A", "7A+", "7B", "7B+", "7C", "7C+",
  "8A", "8A+", "8B", "8B+", "8C", "8C+",
  "9A",
] as const;
export type FontGrade = (typeof FONT_SCALE)[number];

export const FONT_GRADES: GradeDefinition[] = FONT_SCALE.map((id, ordinal) => ({
  id,
  system: "FONT",
  kind: "ORDERED",
  ordinal,
}));

/**
 * Custom colours for independent gyms that use their own colour circuits.
 * These are deliberately UNORDERED: LEBLOND does not know how a given
 * independent gym ranks its colours.
 */
export const CUSTOM_COLOR_GRADES: GradeDefinition[] = (
  [
    ["WHITE", "#F4F4F4", "#111111"],
    ["YELLOW", "#F2C318", "#1a1400"],
    ["ORANGE", "#EE7D1C", "#1a0d00"],
    ["GREEN", "#2E9E4F", "#ffffff"],
    ["BLUE", "#1F63C6", "#ffffff"],
    ["RED", "#C8282B", "#ffffff"],
    ["PINK", "#E85AA6", "#1a0010"],
    ["PURPLE", "#6B2FA3", "#ffffff"],
    ["BLACK", "#151515", "#ffffff"],
    ["GREY", "#8A8A8A", "#111111"],
    ["BROWN", "#7A4A24", "#ffffff"],
  ] as const
).map(([id, swatch, swatchText]) => ({
  id,
  system: "CUSTOM_COLOR" as const,
  kind: "UNORDERED" as const,
  ordinal: null,
  swatch,
  swatchText,
}));

export const UNKNOWN_GRADES: GradeDefinition[] = [
  { id: "UNKNOWN", system: "UNKNOWN", kind: "UNORDERED", ordinal: null },
];

export const GRADES_BY_SYSTEM: Record<GradeSystem, GradeDefinition[]> = {
  ARKOSE_COLOR: ARKOSE_GRADES,
  CLIMBING_DISTRICT_COLOR: CLIMBING_DISTRICT_GRADES,
  FONT: FONT_GRADES,
  CUSTOM_COLOR: CUSTOM_COLOR_GRADES,
  UNKNOWN: UNKNOWN_GRADES,
};

/** Whether grades in this system can be placed on an ordinal scale. */
export function isOrderedSystem(system: GradeSystem): boolean {
  return GRADES_BY_SYSTEM[system].some((g) => g.kind === "ORDERED");
}

export function isColorSystem(system: GradeSystem): boolean {
  return system === "ARKOSE_COLOR" || system === "CLIMBING_DISTRICT_COLOR" || system === "CUSTOM_COLOR";
}
