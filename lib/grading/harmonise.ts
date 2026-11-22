import type { GradeSystem } from "@/lib/climbing/types";
import { RANGES as GYM_RANGES } from "./conversions";
import { boulderGrade } from "./display";
import { gradeToScore, isFontGrade } from "./ordering";
import { FONT_SCALE, GRADES_BY_SYSTEM, type FontGrade } from "./systems";
import { RELIABLE_CONFIDENCE } from "./normalization";

/**
 * Harmonised grades: every boulder read on the Font scale, through a
 * correspondence table, so results from different gyms can sit on one curve.
 *
 * What this is and is not:
 *  - The native grade stays the stored grade. A conversion is computed when a
 *    view needs it and is never written over `native_grade`.
 *  - Every converted value is an ESTIMATE that carries its confidence and its
 *    source, like the per-problem estimates in normalization.ts.
 *  - The climber can replace any line of the table in Réglages; their line wins
 *    over the default (source USER_SETTING).
 *  - A per-problem Font estimate the climber gave (normalised grade at or above
 *    RELIABLE_CONFIDENCE) wins over the table for that problem.
 *  - Routes are not converted: they are already logged on the French scale
 *    (at colour-graded gyms the climber gives the French grade next to the
 *    colour, see route_ascents.native_grade).
 *
 * SOURCES of the default table:
 *  - GYM_PUBLISHED: the gym publishes the correspondence (Vertical'Art FAQ).
 *  - OBSERVED: a coach's observed table, "observé, pas une norme officielle":
 *    Kaskad (kaskadcoaching.com) for Arkose colours and Block'Out B0–B15, sent by
 *    Olivier on 2026-11-22.
 *  - SHARED_ESTIMATE: an estimate passed on without a primary source (Climbing
 *    District levels 1–12, and the same table bridging its former colours: a
 *    summary citing Climbing District, sent by Olivier on 2026-11-22).
 *  - REFERENCE_TABLE: LEBLOND's reference table (docs/grade-reference.csv),
 *    anchored on Arkose's sub-levels (no longer used by default since the tables
 *    above; kept as a source kind).
 *  - LEBLOND_ESTIMATE: no correspondence is published; a first estimate from the
 *    scale's order, its number of levels and the gym's stated span. Low confidence,
 *    meant to be refined by the climber.
 */

export const CONVERSION_SOURCES = [
  "FONT_NATIVE", "PROBLEM_ESTIMATE", "GYM_PUBLISHED", "OBSERVED", "REFERENCE_TABLE", "SHARED_ESTIMATE", "LEBLOND_ESTIMATE", "USER_SETTING",
] as const;
export type ConversionSource = (typeof CONVERSION_SOURCES)[number];

/** Confidence given to each kind of table line (a per-problem estimate keeps its own). */
export const SOURCE_CONFIDENCE: Record<Exclude<ConversionSource, "PROBLEM_ESTIMATE">, number> = {
  FONT_NATIVE: 1,
  GYM_PUBLISHED: 0.8,
  USER_SETTING: 0.7,
  OBSERVED: 0.6,
  REFERENCE_TABLE: 0.6,
  SHARED_ESTIMATE: 0.45,
  LEBLOND_ESTIMATE: 0.35,
};

export type FontSpan = { from: FontGrade; to: FontGrade };
export type TableLine = FontSpan & { source: Exclude<ConversionSource, "FONT_NATIVE" | "PROBLEM_ESTIMATE" | "USER_SETTING"> };

/** Per-system note on where the default lines come from (shown in Réglages). */
export type TableSource = { source: TableLine["source"]; url?: string };

const span = (from: FontGrade, to: FontGrade, source: TableLine["source"]): TableLine => ({ from, to, source });
const lines = (source: TableLine["source"], list: Record<string, [FontGrade, FontGrade]>): Record<string, TableLine> =>
  Object.fromEntries(Object.entries(list).map(([g, [from, to]]) => [g, span(from, to, source)]));
const estimate = (list: Record<string, [FontGrade, FontGrade]>) => lines("LEBLOND_ESTIMATE", list);

/**
 * The default correspondence, per boulder scale and grade. Ranges already
 * shown next to colours (conversions.ts) are reused as they are; the rest are
 * first estimates (see the module comment).
 */
export const DEFAULT_BOULDER_TABLE: Partial<Record<GradeSystem, Record<string, TableLine>>> = {
  // Kaskad, observed: Jaune 4 à 4+, Vert 5A à 5B, Bleu 6A, Rouge 6B à 6B+, Noir 6C+ à 7A, Violet 7B à 7C.
  // Its white (3) and the in-between colours (vert/bleu 5C, bleu/rouge 6A+, rouge/noir 6C, noir/violet 7A+)
  // are not grades of the Arkose scale in LEBLOND, so they have no line.
  ARKOSE_COLOR: lines("OBSERVED", {
    YELLOW: ["4a", "4c"], GREEN: ["5a", "5b"], BLUE: ["6A", "6A"], RED: ["6B", "6B+"], BLACK: ["6C+", "7A"], PURPLE: ["7B", "7C"],
  }),
  VERTICAL_ART_COLOR: fromRanges("VERTICAL_ART_COLOR", "GYM_PUBLISHED"),
  // Kaskad, observed: B0 4, B1 4+, B2 5A, B3 5B à 5C, then one Font step per level up to B15 7C+.
  BLOCKOUT_LEVEL: lines("OBSERVED", {
    B0: ["4a", "4b"], B1: ["4c", "4c"], B2: ["5a", "5a"], B3: ["5b", "5c"], B4: ["6A", "6A"], B5: ["6A+", "6A+"], B6: ["6B", "6B"],
    B7: ["6B+", "6B+"], B8: ["6C", "6C"], B9: ["6C+", "6C+"], B10: ["7A", "7A"], B11: ["7A+", "7A+"], B12: ["7B", "7B"], B13: ["7B+", "7B+"],
    B14: ["7C", "7C"], B15: ["7C+", "7C+"],
  }),
  // The shared summary: 1–2 4a–4c (was white/yellow), 3–4 5a–5b (orange), 5–6 5c–6a+ (green), 7–8 6b–6b+ (blue),
  // 9–10 6c–7a (red), 11 7a+–7b+ (black), 12 7c–8a+ (violet). Each pair split in two, keeping the pair's range.
  CLIMBING_DISTRICT_LEVEL: lines("SHARED_ESTIMATE", {
    "1": ["4a", "4b"], "2": ["4b", "4c"], "3": ["5a", "5a"], "4": ["5b", "5b"], "5": ["5c", "6A"], "6": ["6A", "6A+"],
    "7": ["6B", "6B"], "8": ["6B+", "6B+"], "9": ["6C", "6C+"], "10": ["6C+", "7A"], "11": ["7A+", "7B+"], "12": ["7C", "8A+"],
  }),
  // The same summary bridges the former colours, so old entries read like the levels that replaced them.
  CLIMBING_DISTRICT_COLOR: lines("SHARED_ESTIMATE", {
    WHITE: ["4a", "4c"], YELLOW: ["4a", "4c"], ORANGE: ["5a", "5b"], GREEN: ["5c", "6A+"], BLUE: ["6B", "6B+"], RED: ["6C", "7A"],
    BLACK: ["7A+", "7B+"], PURPLE: ["7C", "8A+"],
  }),
  // Climb World: seven levels, 1 Facile → 7 Équipe de France (wall sign; "Débutants" below level 1). No Font on the sign.
  CLIMB_WORLD_LEVEL: estimate({
    "1": ["4a", "4c"], "2": ["5a", "5b"], "3": ["5c", "6A+"], "4": ["6B", "6B+"], "5": ["6C", "7A"], "6": ["7A+", "7B"], "7": ["7B+", "8A"],
  }),
  // Climb Up: seven colours in the network's own order (white above red).
  CLIMB_UP_COLOR: estimate({
    YELLOW: ["3a", "4c"], GREEN: ["5a", "5b"], BLUE: ["5c", "6A"], PURPLE: ["6A+", "6B"], RED: ["6B+", "6C"], WHITE: ["6C+", "7A"], BLACK: ["7A+", "7C"],
  }),
  // MROC Laennec: six colours, an Arkose-group circuit with purple between blue and red.
  MROC_COLOR: estimate({
    YELLOW: ["3a", "4c"], GREEN: ["5a", "5c"], BLUE: ["5c", "6A+"], PURPLE: ["6A+", "6B+"], RED: ["6B+", "7A"], BLACK: ["7A+", "7C"],
  }),
  // Le Labo: eight colours, light green → black.
  LELABO_COLOR: estimate({
    LIGHT_GREEN: ["3a", "4b"], DARK_GREEN: ["4b", "5a"], YELLOW: ["5a", "5b"], ORANGE: ["5b", "6A"],
    RED: ["6A", "6B"], PURPLE: ["6B", "6C"], BLUE: ["6C+", "7A+"], BLACK: ["7B", "7C+"],
  }),
};

export const TABLE_SOURCES: Partial<Record<GradeSystem, TableSource>> = {
  ARKOSE_COLOR: { source: "OBSERVED", url: "https://kaskadcoaching.com" },
  VERTICAL_ART_COLOR: { source: "GYM_PUBLISHED", url: "https://www.vertical-art.fr/faq/" },
  BLOCKOUT_LEVEL: { source: "OBSERVED", url: "https://kaskadcoaching.com" },
  CLIMBING_DISTRICT_COLOR: { source: "SHARED_ESTIMATE" },
  CLIMBING_DISTRICT_LEVEL: { source: "SHARED_ESTIMATE" },
  CLIMB_WORLD_LEVEL: { source: "LEBLOND_ESTIMATE" },
  CLIMB_UP_COLOR: { source: "LEBLOND_ESTIMATE" },
  MROC_COLOR: { source: "LEBLOND_ESTIMATE" },
  LELABO_COLOR: { source: "LEBLOND_ESTIMATE" },
};

function fromRanges(system: GradeSystem, source: TableLine["source"]): Record<string, TableLine> {
  return Object.fromEntries(Object.entries(GYM_RANGES[system] ?? {}).map(([g, r]) => [g, span(r.from, r.to, source)]));
}

/** Scales the climber can tune, in the order Réglages lists them. */
export function convertibleSystems(): GradeSystem[] {
  return Object.keys(DEFAULT_BOULDER_TABLE) as GradeSystem[];
}

/** The climber's own line for one grade (a row of grade_correspondences). */
export type CorrespondenceOverride = { system: GradeSystem; grade: string; from: FontGrade; to: FontGrade };

/** Database rows → overrides, dropping anything malformed (unknown grade, from above to). */
export function toOverrides(rows: ReadonlyArray<{ grade_system: string; native_grade: string; font_from: string; font_to: string }>): CorrespondenceOverride[] {
  const out: CorrespondenceOverride[] = [];
  for (const r of rows) {
    const system = r.grade_system as GradeSystem;
    if (!DEFAULT_BOULDER_TABLE[system] || !GRADES_BY_SYSTEM[system]?.some((g) => g.id === r.native_grade)) continue;
    if (!isFontGrade(r.font_from) || !isFontGrade(r.font_to)) continue;
    if (fontIndex(r.font_from) > fontIndex(r.font_to)) continue;
    out.push({ system, grade: r.native_grade, from: r.font_from, to: r.font_to });
  }
  return out;
}

export type ConversionTable = Map<string, FontSpan & { source: TableLine["source"] | "USER_SETTING" }>;
const key = (system: GradeSystem, grade: string) => `${system}:${grade}`;

/** The table in force: the defaults, with the climber's lines on top. */
export function conversionTable(overrides: readonly CorrespondenceOverride[] = []): ConversionTable {
  const table: ConversionTable = new Map();
  for (const [system, lines] of Object.entries(DEFAULT_BOULDER_TABLE) as Array<[GradeSystem, Record<string, TableLine>]>) {
    for (const [grade, line] of Object.entries(lines)) table.set(key(system, grade), line);
  }
  for (const o of overrides) table.set(key(o.system, o.grade), { from: o.from, to: o.to, source: "USER_SETTING" });
  return table;
}

/** One boulder on the Font scale. `score` is the middle of the span on FONT_SCALE (may end in .5). */
export type FontConversion = FontSpan & { score: number; confidence: number; source: ConversionSource };

export function fontIndex(grade: FontGrade): number {
  return FONT_SCALE.indexOf(grade);
}

/**
 * A boulder's grade on the Font scale, or null when nothing converts it
 * (custom colours, the mystery pink, unknown grades, a scale with no line).
 */
export function convertBoulder(
  problem: { nativeGrade: string; nativeGradeSystem: GradeSystem; normalizedGrade?: string | null; normalizedGradeSystem?: string | null; normalizationConfidence?: number | null },
  table: ConversionTable,
): FontConversion | null {
  const { nativeGrade: grade, nativeGradeSystem: system } = problem;
  if (system === "FONT") {
    return isFontGrade(grade) ? { from: grade, to: grade, score: fontIndex(grade), confidence: 1, source: "FONT_NATIVE" } : null;
  }
  const own = problem.normalizedGrade;
  const ownConfidence = problem.normalizationConfidence ?? 0;
  if (own && problem.normalizedGradeSystem === "FONT" && isFontGrade(own) && ownConfidence >= RELIABLE_CONFIDENCE) {
    return { from: own, to: own, score: fontIndex(own), confidence: Math.min(1, ownConfidence), source: "PROBLEM_ESTIMATE" };
  }
  if (gradeToScore(system, grade) === null) return null;
  const line = table.get(key(system, grade));
  if (!line) return null;
  return {
    from: line.from, to: line.to, score: (fontIndex(line.from) + fontIndex(line.to)) / 2,
    confidence: SOURCE_CONFIDENCE[line.source], source: line.source,
  };
}

/** "6A", or "6A–6B" for a span: boulder grades in capitals. */
export function formatSpan(s: FontSpan): string {
  const from = boulderGrade(s.from), to = boulderGrade(s.to);
  return from === to ? from : `${from}–${to}`;
}

/** A Font score (possibly .5) back to a label: a whole step is its grade, a half step the two around it. */
export function scoreLabel(score: number): string {
  const lo = FONT_SCALE[Math.max(0, Math.floor(score))];
  const hi = FONT_SCALE[Math.min(FONT_SCALE.length - 1, Math.ceil(score))];
  return formatSpan({ from: lo, to: hi });
}

export type ConfidenceBand = "high" | "medium" | "low";
export function confidenceBand(confidence: number): ConfidenceBand {
  return confidence >= 0.75 ? "high" : confidence >= 0.5 ? "medium" : "low";
}
