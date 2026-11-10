import { z } from "zod";
import { METHODS_FOR_PLANS } from "./catalogue";

const methodIds = new Set(METHODS_FOR_PLANS.map((method) => method.id));

/** Where a planned session happens. HOME = off-wall training (hangboard, bar, weights, mobility). */
export const PLAN_PLACES = ["BOULDER_GYM", "ROUTE_GYM", "CRAG", "HOME"] as const;
export type PlanPlace = (typeof PLAN_PLACES)[number];

/**
 * How the plan was built: MANUAL (the climber alone), ASSISTED (the climber,
 * with the app's rule-based hints), PATRICK (Patrick proposed it, the climber
 * reviewed and saved it).
 */
export const PLAN_MODES = ["MANUAL", "ASSISTED", "PATRICK"] as const;
export type PlanMode = (typeof PLAN_MODES)[number];

/** A plan's duration is kept as entered ("6 months"); its length in weeks is derived. */
export const DURATION_UNITS = ["WEEKS", "MONTHS", "YEARS"] as const;
export type DurationUnit = (typeof DURATION_UNITS)[number];
export const DURATION_MAX: Record<DurationUnit, number> = { WEEKS: 260, MONTHS: 60, YEARS: 5 };
export const MAX_PLAN_WEEKS = 260;
export const MAX_PHASES = 12;

/** Weeks in a duration: a month is 52/12 weeks (rounded), a year 52 weeks. */
export function durationWeeks(value: number, unit: DurationUnit): number {
  const weeks = unit === "WEEKS" ? value : unit === "MONTHS" ? Math.round((value * 52) / 12) : value * 52;
  return Math.max(1, Math.min(MAX_PLAN_WEEKS, Math.round(weeks)));
}

export const durationSchema = z.object({
  value: z.number().int().min(1),
  unit: z.enum(DURATION_UNITS),
}).strict().refine((d) => d.value <= DURATION_MAX[d.unit], "Duration too long");
export type PlanDuration = z.infer<typeof durationSchema>;

/**
 * One session of a weekly template. `methodId` is an Atlas method,
 * or null for a session outside the Atlas (mobility), named by `title`.
 * `place` and `title` are optional so plans saved before them still parse.
 */
export const planSessionSchema = z.object({
  day: z.number().int().min(0).max(6),
  methodId: z.string().refine((id) => methodIds.has(id), "Unknown training method").nullable(),
  minutes: z.number().int().min(10).max(240),
  notes: z.string().max(500),
  place: z.enum(PLAN_PLACES).optional(),
  title: z.string().trim().min(1).max(80).optional(),
  /** Done only if there is time or the mood (a second outdoor day, open climbing). */
  optional: z.boolean().optional(),
}).strict().refine((s) => s.methodId !== null || !!s.title, "A session outside the Atlas needs a title");

/**
 * What a block of weeks is for, in the usual structure of a plan: base blocks
 * build the foundations, build blocks get specific to the goal, a deload week
 * is a lighter, free week between blocks, a taper cuts volume before the goal,
 * performance is the goal itself (a trip, a project period).
 */
export const PHASE_KINDS = ["BASE", "BUILD", "DELOAD", "TAPER", "PERFORMANCE"] as const;
export type PhaseKind = (typeof PHASE_KINDS)[number];
/** Lighter phases: no hard block expected. */
export const LIGHT_PHASES: ReadonlySet<PhaseKind> = new Set(["DELOAD", "TAPER", "PERFORMANCE"]);

/** A block of weeks repeating one weekly template. */
export const planPhaseSchema = z.object({
  name: z.string().trim().min(1).max(60),
  kind: z.enum(PHASE_KINDS).optional(),
  weeks: z.number().int().min(1).max(MAX_PLAN_WEEKS),
  /** What this block is for, checkable at its end ("3 × 10 s on 20 mm", "flash 6B"). */
  objective: z.string().trim().max(200).optional(),
  sessions: z.array(planSessionSchema).min(1).max(14),
}).strict();

/**
 * A plan as the editor and the save action see it. `sessions` and `weeks` are
 * the first phase's template and the total length: what every reader written
 * before phases uses. `phases` (2 or more) is only set for plans in phases.
 */
export const trainingPlanSchema = z.object({
  id: z.guid().optional(),
  name: z.string().trim().min(1).max(100),
  goal: z.string().trim().max(300),
  weeks: z.number().int().min(1).max(MAX_PLAN_WEEKS),
  sessions: z.array(planSessionSchema).min(1).max(14),
  mode: z.enum(PLAN_MODES).optional(),
  duration: durationSchema.optional(),
  phases: z.array(planPhaseSchema).max(MAX_PHASES).optional(),
}).strict();

export type TrainingPlanInput = z.infer<typeof trainingPlanSchema>;
export type PlanSession = z.infer<typeof planSessionSchema>;
export type PlanPhase = z.infer<typeof planPhaseSchema>;
export type SavedTrainingPlan = TrainingPlanInput & { id: string; updatedAt: string };

/** The phases of a plan; a plan saved without phases is one phase of its template. */
export function phasesOf(plan: Pick<TrainingPlanInput, "weeks" | "sessions" | "phases">, singleName = "Phase 1"): PlanPhase[] {
  return plan.phases && plan.phases.length > 0
    ? plan.phases
    : [{ name: singleName, weeks: plan.weeks, sessions: plan.sessions }];
}

export function planDuration(plan: Pick<TrainingPlanInput, "weeks" | "duration">): PlanDuration {
  return plan.duration ?? { value: plan.weeks, unit: "WEEKS" };
}

/** Total weeks covered by the phases. */
export function phaseWeeks(phases: readonly Pick<PlanPhase, "weeks">[]): number {
  return phases.reduce((sum, p) => sum + p.weeks, 0);
}

/** The phase that covers `week` (1-based); past the end, the last phase. */
export function phaseAt(phases: readonly PlanPhase[], week: number): { phase: PlanPhase; index: number } {
  let end = 0;
  for (const [index, phase] of phases.entries()) {
    end += phase.weeks;
    if (week <= end) return { phase, index };
  }
  return { phase: phases[phases.length - 1], index: phases.length - 1 };
}

/**
 * The plan normalised for storage: `sessions` = first phase, `weeks` = the
 * duration in weeks, `phases` stored only when there are two or more.
 */
export function planRow(plan: TrainingPlanInput) {
  const duration = planDuration(plan);
  const phases = phasesOf(plan);
  return {
    name: plan.name,
    goal: plan.goal,
    weeks: durationWeeks(duration.value, duration.unit),
    sessions: phases[0].sessions,
    mode: plan.mode ?? "MANUAL",
    duration_value: duration.value,
    duration_unit: duration.unit,
    phases: phases.length > 1 ? phases : [],
  };
}

export type TrainingPlanRow = {
  id: string; name: string; goal: string; weeks: number; sessions: unknown;
  mode?: string | null; duration_value?: number | null; duration_unit?: string | null; phases?: unknown;
};

/** Reads a stored plan (with or without the mode/duration/phase columns); null when it no longer parses. */
export function planFromRow(row: TrainingPlanRow): TrainingPlanInput | null {
  const phases = Array.isArray(row.phases) && row.phases.length > 1 ? row.phases : undefined;
  const parsed = trainingPlanSchema.safeParse({
    id: row.id, name: row.name, goal: row.goal, weeks: row.weeks, sessions: row.sessions,
    mode: (PLAN_MODES as readonly string[]).includes(row.mode ?? "") ? row.mode : undefined,
    duration: row.duration_value && (DURATION_UNITS as readonly string[]).includes(row.duration_unit ?? "")
      ? { value: row.duration_value, unit: row.duration_unit } : undefined,
    phases,
  });
  return parsed.success ? parsed.data : null;
}

export const PLAN_COLUMNS = "id, name, goal, weeks, sessions, mode, duration_value, duration_unit, phases";

/** The editable part of a saved plan: the strict save schema rejects row metadata such as updatedAt. */
export function editablePlan(plan: SavedTrainingPlan): TrainingPlanInput {
  return {
    id: plan.id, name: plan.name, goal: plan.goal, weeks: plan.weeks, sessions: plan.sessions.map((s) => ({ ...s })),
    ...(plan.mode ? { mode: plan.mode } : {}),
    ...(plan.duration ? { duration: { ...plan.duration } } : {}),
    ...(plan.phases ? { phases: plan.phases.map((p) => ({ ...p, sessions: p.sessions.map((s) => ({ ...s })) })) } : {}),
  };
}

export const DEFAULT_PLAN: TrainingPlanInput = {
  name: "My climbing week",
  goal: "",
  weeks: 4,
  sessions: [
    { day: 1, methodId: "technique", minutes: 60, notes: "" },
    { day: 3, methodId: "easy-volume", minutes: 60, notes: "" },
    { day: 5, methodId: "strength-conditioning", minutes: 45, notes: "" },
  ],
};
