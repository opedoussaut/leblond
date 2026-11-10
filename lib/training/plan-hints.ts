import type { BodyArea, Health } from "./health";
import { methodVerdict } from "./health";
import { durationWeeks, LIGHT_PHASES, phasesOf, phaseWeeks, planDuration, type PlanPhase, type TrainingPlanInput } from "./plans";
import { INTENSE_METHODS } from "./programme";

/**
 * Assisted mode: rule-based hints while a climber builds a plan. EDITORIAL
 * coaching rules of thumb (recovery, load, structure, goal setting), computed
 * by the app, never by Patrick. They inform; they never block a save.
 */

/** Methods that build strength or finger strength. */
export const STRENGTH_METHODS: ReadonlySet<string> = new Set([
  "limit-bouldering", "max-hangs", "repeaters", "campus", "strength-conditioning", "periodized",
]);

export type PlanHintCode =
  | "goalNotMeasurable"      // the main goal has no number in it (a grade, a time, a count)
  | "phasesShort"            // the phases cover fewer weeks than the duration
  | "phasesLong"             // the phases cover more weeks than the duration
  | "longSinglePhase"        // more than 12 weeks repeating one week
  | "noRecoveryWeek"         // a long plan with no lighter week (deload)
  | "longBlock"              // a hard block longer than 6 weeks
  | "noTaper"                // a plan of 8 weeks or more that ends on a hard block
  | "noObjective"            // a phase without a checkable objective
  | "noRestDay"              // a phase uses every day of the week
  | "intenseInARow"          // two intense sessions on consecutive days
  | "tooManyIntense"         // more than 3 intense sessions a week
  | "heavyWeek"              // more than 10 hours a week
  | "noStrength"             // a phase with no strength or finger work
  | "avoidMethod"            // a method the declared health rules out
  | "adaptMethod";           // a method to do at reduced load

export type PlanHint = {
  level: "warn" | "info";
  code: PlanHintCode;
  /** 0-based phase the hint is about, when it is about one. */
  phase?: number;
  methodId?: string;
  areas?: BodyArea[];
  /** Weekday indexes (0 = Monday) the hint is about. */
  days?: number[];
  planned?: number;
  total?: number;
};

const MAX_INTENSE_PER_WEEK = 3;

/** A deload, taper or performance phase, or any phase of a single week. */
function isLight(phase: PlanPhase): boolean {
  return phase.kind ? LIGHT_PHASES.has(phase.kind) : phase.weeks <= 1;
}
const MAX_WEEKLY_MINUTES = 600;

export function planHints(plan: TrainingPlanInput, health: Health): PlanHint[] {
  const hints: PlanHint[] = [];
  const phases = phasesOf(plan);
  const duration = planDuration(plan);
  const total = durationWeeks(duration.value, duration.unit);

  if (plan.goal.trim() && !/\d/.test(plan.goal)) hints.push({ level: "info", code: "goalNotMeasurable" });

  const planned = phaseWeeks(phases);
  if (phases.length > 1 && planned < total) hints.push({ level: "warn", code: "phasesShort", planned, total });
  if (phases.length > 1 && planned > total) hints.push({ level: "warn", code: "phasesLong", planned, total });
  if (phases.length === 1 && total > 12) hints.push({ level: "info", code: "longSinglePhase", total });
  if (phases.length > 1 && total > 12 && !phases.some(isLight)) hints.push({ level: "info", code: "noRecoveryWeek" });
  if (phases.length > 1 && total >= 8 && !isLight(phases[phases.length - 1])) hints.push({ level: "info", code: "noTaper" });

  phases.forEach((phase, index) => {
    const at = phases.length > 1 ? { phase: index } : {};
    if (phases.length > 1 && !phase.objective?.trim()) hints.push({ level: "info", code: "noObjective", ...at });

    if (phases.length > 1 && !isLight(phase) && phase.weeks > 6) hints.push({ level: "info", code: "longBlock", planned: phase.weeks, ...at });

    const days = new Set(phase.sessions.map((s) => s.day));
    if (days.size === 7) hints.push({ level: "warn", code: "noRestDay", ...at });

    const intenseDays = [...new Set(phase.sessions.filter((s) => s.methodId && INTENSE_METHODS.has(s.methodId)).map((s) => s.day))].sort();
    for (const d of intenseDays) {
      const next = (d + 1) % 7;
      if (intenseDays.includes(next)) hints.push({ level: "warn", code: "intenseInARow", days: [d, next], ...at });
    }
    const intenseCount = phase.sessions.filter((s) => s.methodId && INTENSE_METHODS.has(s.methodId)).length;
    if (intenseCount > MAX_INTENSE_PER_WEEK) hints.push({ level: "warn", code: "tooManyIntense", planned: intenseCount, total: MAX_INTENSE_PER_WEEK, ...at });

    const minutes = phase.sessions.reduce((sum, s) => sum + s.minutes, 0);
    if (minutes > MAX_WEEKLY_MINUTES) hints.push({ level: "warn", code: "heavyWeek", planned: minutes, ...at });

    // A lighter phase is meant to have no hard work.
    if (!isLight(phase) && !phase.sessions.some((s) => s.methodId && STRENGTH_METHODS.has(s.methodId))) {
      hints.push({ level: "info", code: "noStrength", ...at });
    }

    const seen = new Set<string>();
    for (const s of phase.sessions) {
      if (!s.methodId || seen.has(s.methodId)) continue;
      seen.add(s.methodId);
      const verdict = methodVerdict(s.methodId, health);
      if (verdict.status === "ok") continue;
      hints.push({
        level: verdict.status === "avoid" ? "warn" : "info",
        code: verdict.status === "avoid" ? "avoidMethod" : "adaptMethod",
        methodId: s.methodId,
        areas: [...new Set(verdict.because.map((b) => b.area))],
        ...at,
      });
    }
  });

  return hints;
}
