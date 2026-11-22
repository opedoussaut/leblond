"use client";

import { createContext, useCallback, useContext } from "react";
import type { GradeSystem } from "@/lib/climbing/types";
import { fontRangeFor, formatFontRange, type FontRange } from "@/lib/grading/conversions";
import type { CorrespondenceOverride } from "@/lib/grading/harmonise";

/**
 * Carries the climber's own correspondence lines (Réglages › Correspondance des
 * cotations) to every "≈ range" shown next to a grade. Outside the provider the
 * defaults apply.
 */
const GradeRangesContext = createContext<readonly CorrespondenceOverride[]>([]);

export function GradeRangesProvider({ overrides, children }: { overrides: readonly CorrespondenceOverride[]; children: React.ReactNode }) {
  return <GradeRangesContext.Provider value={overrides}>{children}</GradeRangesContext.Provider>;
}

/** The range lookup in force for this climber: their lines on top of the default table. */
export function useFontRange(): (system: GradeSystem, grade: string) => FontRange | null {
  const overrides = useContext(GradeRangesContext);
  return useCallback((system, grade) => fontRangeFor(system, grade, overrides), [overrides]);
}

/** The "≈ range" part of a grade chip, with its source as the tooltip. */
export function ChipFontRange({ system, grade, titles }: {
  system: GradeSystem;
  grade: string;
  titles: Record<FontRange["source"], string>;
}) {
  const range = useFontRange()(system, grade);
  if (!range) return null;
  return <span className="font-medium normal-case text-ink-3" title={titles[range.source]}>{formatFontRange(range)}</span>;
}
