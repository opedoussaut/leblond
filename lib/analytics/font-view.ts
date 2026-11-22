import type { GradeSystem } from "@/lib/climbing/types";
import { convertBoulder, type ConversionSource, type ConversionTable, type FontSpan } from "@/lib/grading/harmonise";
import { gradeToScore } from "@/lib/grading/ordering";
import { FONT_SCALE, type FontGrade } from "@/lib/grading/systems";
import type { AttemptFact, ClimbingDataset, ProblemConversion, ProblemFact } from "./types";

/**
 * Progrès on ONE boulder scale: every boulder read as one Font grade, so the
 * sections (top-grade send rate, records, pyramids, curves, gyms, the Aperçu
 * tiles) show Font only, never one card per gym scale.
 *
 * How a boulder gets its Font grade (convertBoulder in lib/grading/harmonise):
 *   1. a native Font problem is its own grade;
 *   2. a per-problem Font estimate the climber gave (confidence ≥ 0.5) wins;
 *   3. the climber's own correspondence line from Réglages (/settings/grades);
 *   4. the default table (DEFAULT_BOULDER_TABLE).
 * A table line is a SPAN (Arkose red = 6B–6B+). The single grade is the middle
 * of the span on the Font scale, rounded DOWN to a whole grade when the middle
 * falls between two (6B–6B+ → 6B; 6C+–7A → 6C+; 5c–6A+ → 6A). Rounding down
 * never credits a send with more than its line says. Documented in
 * docs/grading.md ("One Font grade per boulder").
 *
 * Grades with no line (the mystery pink, custom colours, unknown grades) are
 * NOT guessed: their problems stay in the dataset on the unordered UNKNOWN
 * scale, so they leave every graded figure but still count in sessions, sends,
 * attempts and styles; conversionSummary names them apart.
 *
 * Pure: the stored native grade is never changed; the converted dataset is a
 * copy computed when the page is built. Every converted grade is an estimate
 * that keeps its native grade, source and confidence (`conversion`).
 */

export type { ProblemConversion };

/** A boulder of the Font view: on Font with its conversion, or on UNKNOWN with `conversion: null`. */
export type ConvertedProblem = ProblemFact & { conversion: ProblemConversion | null };

export type FontView = {
  /** The same dataset, boulders on Font (system "FONT"); unconverted boulders on UNKNOWN. */
  dataset: ClimbingDataset & { problems: ConvertedProblem[] };
  /** Boulders with no Font line, by id, with their native grade. */
  unconverted: ReadonlyMap<string, { system: GradeSystem; grade: string }>;
};

/** The single Font grade of a span: its middle, rounded down to a whole grade. */
export function singleFontGrade(span: FontSpan): FontGrade {
  const from = FONT_SCALE.indexOf(span.from), to = FONT_SCALE.indexOf(span.to);
  return FONT_SCALE[Math.floor((from + to) / 2)];
}

/** One boulder on Font, or null when nothing converts it. */
export function convertProblem(p: ProblemFact, table: ConversionTable): ProblemConversion | null {
  const c = convertBoulder(p, table);
  if (!c) return null;
  return {
    native: { system: p.nativeGradeSystem, grade: p.nativeGrade },
    grade: singleFontGrade(c), span: { from: c.from, to: c.to }, source: c.source, confidence: c.confidence,
  };
}

/** The dataset with every boulder on Font (see the module comment for the order and the rule). */
export function fontView(data: ClimbingDataset, table: ConversionTable): FontView {
  const problems: ConvertedProblem[] = [];
  const unconverted = new Map<string, { system: GradeSystem; grade: string }>();
  for (const p of data.problems) {
    const conversion = convertProblem(p, table);
    const cleared = { normalizedGrade: null, normalizedGradeSystem: null, normalizationConfidence: null, normalizationSource: null };
    if (!conversion) {
      unconverted.set(p.id, { system: p.nativeGradeSystem, grade: p.nativeGrade });
      problems.push({ ...p, ...cleared, nativeGradeSystem: "UNKNOWN", nativeGrade: "UNKNOWN", conversion: null });
      continue;
    }
    problems.push({ ...p, ...cleared, nativeGradeSystem: "FONT", nativeGrade: conversion.grade, conversion });
  }
  return { dataset: { ...data, problems }, unconverted };
}

export type ConversionSummary = {
  /** Boulders tried that were already Font (native or the climber's own estimate). */
  font: number;
  /** Boulders tried that were converted from a gym scale, per scale and source, most first. */
  converted: Array<{ system: GradeSystem; source: ConversionSource; problems: number }>;
  /** Sum of `converted`. */
  convertedTotal: number;
  /** Boulders tried with no Font line, per native grade, named (never guessed), most first. */
  unconverted: Array<{ system: GradeSystem; grade: string; problems: number }>;
  /** Lowest confidence among the converted boulders, null when nothing was converted. */
  weakestConfidence: number | null;
};

/**
 * What a Font figure is made of, over the boulders tried in `attempts`: how
 * many were Font already, converted (by scale and source) or left apart.
 */
export function conversionSummary(view: FontView, attempts: readonly AttemptFact[]): ConversionSummary {
  const tried = new Set(attempts.map((a) => a.problemId));
  let font = 0;
  let weakest: number | null = null;
  const converted = new Map<string, { system: GradeSystem; source: ConversionSource; problems: number }>();
  for (const p of view.dataset.problems) {
    if (!tried.has(p.id)) continue;
    const c = p.conversion;
    if (!c) continue;
    if (c.source === "FONT_NATIVE" || c.source === "PROBLEM_ESTIMATE") { font++; continue; }
    const k = `${c.native.system}:${c.source}`;
    const cur = converted.get(k) ?? { system: c.native.system, source: c.source, problems: 0 };
    cur.problems++;
    converted.set(k, cur);
    weakest = weakest === null ? c.confidence : Math.min(weakest, c.confidence);
  }
  const unconverted = new Map<string, { system: GradeSystem; grade: string; problems: number }>();
  for (const [id, n] of view.unconverted) {
    if (!tried.has(id)) continue;
    const k = `${n.system}:${n.grade}`;
    const cur = unconverted.get(k) ?? { ...n, problems: 0 };
    cur.problems++;
    unconverted.set(k, cur);
  }
  const byCount = <T extends { problems: number; system: string }>(a: T, b: T) => b.problems - a.problems || a.system.localeCompare(b.system);
  return {
    font, converted: [...converted.values()].sort(byCount), convertedTotal: [...converted.values()].reduce((n, c) => n + c.problems, 0), unconverted: [...unconverted.values()].sort(byCount),
    weakestConfidence: weakest,
  };
}

/**
 * The climber's target on Font: a Font target as it is, a gym grade through the
 * same table (single grade by the same rule), null when nothing converts it.
 */
export function fontTarget(target: { grade: string; system: GradeSystem }, table: ConversionTable): { grade: string; system: GradeSystem } {
  if (target.system === "FONT") return target;
  if (gradeToScore(target.system, target.grade) === null) return target;
  const c = convertBoulder({ nativeGrade: target.grade, nativeGradeSystem: target.system }, table);
  return c ? { grade: singleFontGrade(c), system: "FONT" } : target;
}

/** Distributions of a Font view without the unconverted boulders' UNKNOWN block. */
export function gradedOnly<T extends { system: GradeSystem }>(list: readonly T[]): T[] {
  return list.filter((d) => d.system !== "UNKNOWN");
}
