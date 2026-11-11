import type { Localized } from "@/lib/training/catalogue";
import { loadVerdict, restrictionsOf, type Health, type VerdictStatus } from "@/lib/training/health";
import { TEMPLATE_VERSION, type ExerciseSnapshot } from "@/lib/training/session-templates";
import { asymmetries, testLevel, type MobilityResult, type Side, type WarningFlag } from "./assessment";
import {
  EXERCISE_BY_ID, HIP_METHOD_ID, LEVEL_SESSIONS, SESSION_TITLE, contentLevel,
  type Level, type MobilityExercise, type SessionLength, type TestId,
} from "./content";

/**
 * How a hip-mobility session is prescribed. Pure: the same records always give
 * the same session.
 *
 *  - Steps BACK apply by default (discomfort ≥ 5, a warning sign, mostly
 *    uncontrolled reps, an exercise skipped twice): safety never waits.
 *  - Steps UP are only OFFERED, after two clean sessions in a row (every rep
 *    controlled, discomfort ≤ 2, both sides done, no warning sign). The climber
 *    accepts or declines; nothing increases on its own, and nothing depends on
 *    how many weeks have passed.
 *  - No offer at all while a clinician check is recommended.
 *
 * The thresholds are editorial coaching rules, not clinical criteria.
 */

export const VARIANTS = ["EASIER", "STANDARD", "HARDER"] as const;
export type Variant = (typeof VARIANTS)[number];
export const VARIANT_RANK: Record<Variant, number> = { EASIER: 0, STANDARD: 1, HARDER: 2 };

export type Dose = { variant: Variant; reps: number };

export const RULES = {
  /** Discomfort (0–10) at or above which the next session steps back. */
  regressDiscomfort: 5,
  /** Highest discomfort a "clean" set may report. */
  cleanDiscomfort: 2,
  /** Share of uncontrolled sets at or above which the next session steps back. */
  regressUncontrolledShare: 0.5,
  /** Clean sessions in a row before an increase is offered. */
  cleanSessionsForOffer: 2,
  /** Clinician: discomfort ≥ this in `persistentCount` of the last `persistentWindow` sessions. */
  persistentDiscomfort: 4,
  persistentCount: 3,
  persistentWindow: 5,
} as const;

export type MobilitySet = {
  side: Side | null; reps: number | null; variant: Variant | null; controlled: boolean | null;
  discomfort: number | null; flags: readonly WarningFlag[]; completed: boolean;
};
export type ExercisePerformance = {
  exerciseId: string; status: "PENDING" | "DONE" | "MODIFIED" | "SKIPPED"; prescribed: Dose | null; sets: readonly MobilitySet[];
};
/** One recorded hip-mobility session, as the rules read it. */
export type MobilitySessionRecord = {
  id: string; date: string; status: "COMPLETED" | "INTERRUPTED"; level: Level;
  pain: number | null; rpe: number | null; minutes: number | null; exercises: readonly ExercisePerformance[];
};

export type ReasonKey =
  | "start" | "startEasier" | "startOffer" | "healthAdapt"
  | "discomfort" | "flag" | "uncontrolled" | "skipped"
  | "steady" | "ready" | "top" | "clinician";

export type Decision = {
  exerciseId: string;
  /** What the session prescribes unless the climber accepts the offer. */
  dose: Dose;
  /** An increase the climber may accept (never applied on its own). */
  offer: Dose | null;
  reason: ReasonKey;
  /** The applied dose is lower than last time. */
  stepBack: boolean;
  /** The climber accepted the offered increase for this session. */
  accepted?: boolean;
};

function clampReps(ex: MobilityExercise, reps: number) {
  return Math.min(ex.reps.max, Math.max(ex.reps.min, Math.round(reps)));
}

/** The next step up: more reps first, then the harder version. Null at the top. */
export function nextDose(ex: MobilityExercise, d: Dose): Dose | null {
  if (d.reps < ex.reps.max) return { variant: d.variant, reps: Math.min(ex.reps.max, d.reps + (d.reps >= 8 ? 2 : 1)) };
  if (d.variant === "EASIER") return { variant: "STANDARD", reps: ex.reps.min };
  if (d.variant === "STANDARD") return { variant: "HARDER", reps: ex.reps.min };
  return null;
}

/** One step down: fewer reps, then the easier version. */
export function previousDose(ex: MobilityExercise, d: Dose): Dose {
  if (d.reps > ex.reps.min) return { variant: d.variant, reps: Math.max(ex.reps.min, d.reps - 2) };
  if (d.variant === "HARDER") return { variant: "STANDARD", reps: ex.reps.start };
  if (d.variant === "STANDARD") return { variant: "EASIER", reps: ex.reps.start };
  return d;
}

export function compareDose(a: Dose, b: Dose): number {
  return VARIANT_RANK[a.variant] - VARIANT_RANK[b.variant] || a.reps - b.reps;
}

export type PerformanceSummary = {
  done: boolean; dose: Dose | null; clean: boolean; maxDiscomfort: number; flags: WarningFlag[]; uncontrolledShare: number;
};

/** What was actually done on one exercise: the lowest version and the fewest reps of any completed set. */
export function summarizePerformance(ex: MobilityExercise, p: ExercisePerformance): PerformanceSummary {
  const sets = p.sets.filter((s) => s.completed && (s.reps ?? 0) > 0);
  const flags = [...new Set(p.sets.flatMap((s) => s.flags))];
  const maxDiscomfort = Math.max(0, ...p.sets.map((s) => s.discomfort ?? 0));
  if (sets.length === 0) return { done: false, dose: null, clean: false, maxDiscomfort, flags, uncontrolledShare: 0 };
  const variant = sets.map((s) => s.variant ?? p.prescribed?.variant ?? "STANDARD")
    .reduce((a, b) => VARIANT_RANK[a] <= VARIANT_RANK[b] ? a : b);
  const reps = Math.min(...sets.map((s) => s.reps ?? 0));
  const sidesOk = !ex.perSide || (sets.some((s) => s.side === "LEFT") && sets.some((s) => s.side === "RIGHT"));
  const uncontrolled = sets.filter((s) => s.controlled === false).length;
  const clean = sidesOk && flags.length === 0
    && sets.every((s) => s.controlled === true && s.discomfort !== null && s.discomfort <= RULES.cleanDiscomfort)
    && (!p.prescribed || compareDose({ variant, reps }, p.prescribed) >= 0);
  return { done: true, dose: { variant, reps }, clean, maxDiscomfort, flags, uncontrolledShare: uncontrolled / sets.length };
}

export type DecisionContext = {
  /** Latest assessment results, for the very first prescription. */
  assessment: readonly MobilityResult[] | null;
  /** The declared-injury verdict for this exercise (health.ts rules). */
  health: VerdictStatus;
  /** A clinician check is recommended: no increase is offered. */
  clinician: boolean;
};

/** The prescription of one exercise from its own history (most recent first). */
export function decideExercise(ex: MobilityExercise, history: readonly ExercisePerformance[], ctx: DecisionContext): Decision {
  const base = (dose: Dose, reason: ReasonKey, offer: Dose | null = null, stepBack = false): Decision =>
    ({ exerciseId: ex.id, dose, offer: ctx.clinician || ctx.health !== "ok" ? null : offer, reason, stepBack });
  const easiest: Dose = { variant: "EASIER", reps: ex.reps.min };

  if (ctx.health === "adapt") return base(easiest, "healthAdapt");

  if (history.length === 0) {
    const level = ex.test && ctx.assessment ? testLevel(ctx.assessment, ex.test as TestId) : null;
    const start: Dose = { variant: level !== null && level <= 1 ? "EASIER" : "STANDARD", reps: ex.reps.start };
    if (level !== null && level <= 1) return base(start, "startEasier");
    if (level !== null && level >= 3) return base(start, ctx.clinician ? "clinician" : "startOffer", nextVariant(ex, start));
    return base(start, "start");
  }

  const [last, previous] = history;
  const s = summarizePerformance(ex, last);
  const lastPrescribed = last.prescribed ?? { variant: "STANDARD", reps: ex.reps.start };

  if (!s.done) {
    const skippedBefore = previous ? !summarizePerformance(ex, previous).done : false;
    return skippedBefore ? base(previousDose(ex, lastPrescribed), "skipped", null, true) : base(lastPrescribed, "skipped");
  }
  const done = s.dose!;
  // What the next session builds on: never more than was prescribed last time.
  const from: Dose = compareDose(done, lastPrescribed) < 0 ? done : lastPrescribed;
  const fromClamped: Dose = { variant: from.variant, reps: clampReps(ex, from.reps) };

  if (s.flags.length > 0) return base(easiest, "flag", null, compareDose(easiest, fromClamped) < 0);
  if (s.maxDiscomfort >= RULES.regressDiscomfort) return base(easiest, "discomfort", null, compareDose(easiest, fromClamped) < 0);
  if (s.uncontrolledShare >= RULES.regressUncontrolledShare) {
    const down = previousDose(ex, fromClamped);
    return base(down, "uncontrolled", null, compareDose(down, fromClamped) < 0);
  }
  const recent = history.slice(0, RULES.cleanSessionsForOffer).map((p) => summarizePerformance(ex, p));
  const ready = recent.length === RULES.cleanSessionsForOffer
    && recent.every((r) => r.clean && r.dose && compareDose(r.dose, fromClamped) >= 0);
  if (!ready) return base(fromClamped, "steady");
  const up = nextDose(ex, fromClamped);
  if (!up) return base(fromClamped, "top");
  if (ctx.clinician) return base(fromClamped, "clinician");
  return base(fromClamped, "ready", up);
}

function nextVariant(ex: MobilityExercise, d: Dose): Dose | null {
  return d.variant === "HARDER" ? null : { variant: d.variant === "EASIER" ? "STANDARD" : "HARDER", reps: ex.reps.min };
}

/** History of one exercise across sessions, most recent first. */
export function historyOf(records: readonly MobilitySessionRecord[], exerciseId: string): ExercisePerformance[] {
  return [...records].sort((a, b) => b.date.localeCompare(a.date))
    .flatMap((r) => r.exercises.filter((e) => e.exerciseId === exerciseId));
}

export type ClinicianReason = "persistentDiscomfort" | "catching" | "block" | "sharpPain" | "asymmetry" | "assessmentPain";
export type ClinicianAdvice = { recommended: boolean; reasons: ClinicianReason[]; asymmetricTests: TestId[] };

/**
 * When LEBLOND recommends a qualified clinician or sports physiotherapist
 * before progressing: persistent discomfort, catching, a hard block, sharp pain,
 * a large left/right gap, or a test stopped by pain. Editorial thresholds; this
 * is a prompt to get checked, not a diagnosis. It clears on its own once the
 * recent records (last 5 sessions, latest assessment) no longer show it.
 */
export function clinicianAdvice(records: readonly MobilitySessionRecord[], latest: readonly MobilityResult[] | null): ClinicianAdvice {
  const recent = [...records].sort((a, b) => b.date.localeCompare(a.date)).slice(0, RULES.persistentWindow);
  const reasons = new Set<ClinicianReason>();
  const sessionFlags = new Set(recent.flatMap((r) => r.exercises.flatMap((e) => e.sets.flatMap((s) => s.flags))));
  const testFlags = new Set((latest ?? []).flatMap((r) => r.flags));
  const flagged = (f: WarningFlag) => sessionFlags.has(f) || testFlags.has(f);
  const sore = recent.filter((r) => (r.pain ?? 0) >= RULES.persistentDiscomfort
    || r.exercises.some((e) => e.sets.some((s) => (s.discomfort ?? 0) >= RULES.persistentDiscomfort))).length;
  if (sore >= RULES.persistentCount) reasons.add("persistentDiscomfort");
  if (flagged("CATCHING")) reasons.add("catching");
  if (flagged("BLOCK")) reasons.add("block");
  if (flagged("SHARP_PAIN")) reasons.add("sharpPain");
  const asym = latest ? asymmetries(latest).map((a) => a.test) : [];
  if (asym.length) reasons.add("asymmetry");
  if ((latest ?? []).some((r) => (!r.done && r.skipReason === "PAIN") || r.discomfort >= RULES.regressDiscomfort)) reasons.add("assessmentPain");
  return { recommended: reasons.size > 0, reasons: [...reasons], asymmetricTests: asym };
}

/** The declared-injury verdict of one exercise (same rules as every other method). */
export function exerciseHealth(ex: MobilityExercise, health: Health): VerdictStatus {
  return loadVerdict(ex.loads, restrictionsOf(health), false).status;
}

export type MobilitySnapshot = {
  programme: "HIP";
  level: Level;
  exerciseId: string;
  perSide: boolean;
  dose: Dose;
  offered: Dose | null;
  reason: ReasonKey;
  accepted: boolean;
  purpose: Localized;
  cue: Localized;
  easier: { name: Localized; how: Localized };
  harder: { name: Localized; how: Localized };
  mistakes: Localized[];
};

export type SessionPlan = {
  level: Level;
  length: SessionLength;
  minutes: number;
  decisions: Decision[];
  /** Exercises left out because a declared area must not be loaded. */
  excluded: string[];
  clinician: ClinicianAdvice;
};

export type PlanInput = {
  workingLevel: number;
  length: SessionLength;
  records: readonly MobilitySessionRecord[];
  assessment: readonly MobilityResult[] | null;
  health: Health;
  /** Exercise ids whose offered increase the climber accepted. */
  accept?: readonly string[];
};

/** The session the climber would do now, with its offers. */
export function planSession(input: PlanInput): SessionPlan {
  const level = contentLevel(input.workingLevel);
  const spec = LEVEL_SESSIONS[level]![input.length];
  const clinician = clinicianAdvice(input.records, input.assessment);
  const accept = new Set(input.accept ?? []);
  const decisions: Decision[] = [];
  const excluded: string[] = [];
  for (const id of spec.exercises) {
    const ex = EXERCISE_BY_ID.get(id)!;
    const health = exerciseHealth(ex, input.health);
    if (health === "avoid") { excluded.push(id); continue; }
    const d = decideExercise(ex, historyOf(input.records, id), { assessment: input.assessment, health, clinician: clinician.recommended });
    decisions.push(accept.has(id) && d.offer ? { ...d, dose: d.offer, offer: null, accepted: true } : d);
  }
  return { level, length: input.length, minutes: spec.minutes, decisions, excluded, clinician };
}

const join = (list: readonly Localized[]): Localized => ({ fr: list.map((l) => l.fr).join(" "), en: list.map((l) => l.en).join(" ") });

export const VARIANT_NAMES: Record<Variant, Localized> = {
  EASIER: { fr: "Version plus facile", en: "Easier version" },
  STANDARD: { fr: "Version prévue", en: "Planned version" },
  HARDER: { fr: "Version plus difficile", en: "Harder version" },
};

/** The training_session_exercises rows (without ids) of a planned session. */
export function mobilityExerciseRows(plan: SessionPlan, locale: "fr" | "en") {
  return plan.decisions.map((d, position) => {
    const ex = EXERCISE_BY_ID.get(d.exerciseId)!;
    const mobility: MobilitySnapshot = {
      programme: "HIP", level: plan.level, exerciseId: ex.id, perSide: ex.perSide,
      dose: d.dose, offered: d.offer, reason: d.reason, accepted: !!d.accepted, purpose: ex.purpose, cue: ex.cue,
      easier: ex.easier, harder: ex.harder, mistakes: [...ex.mistakes],
    };
    const variantName = d.dose.variant === "STANDARD" ? null
      : (d.dose.variant === "EASIER" ? ex.easier.name : ex.harder.name)[locale];
    const instructions: ExerciseSnapshot = {
      version: TEMPLATE_VERSION, key: "hip:" + ex.id,
      summary: ex.purpose, steps: [...ex.steps], intensity: ex.cue, safety: join(ex.safety),
      ...(ex.restAfterSeconds ? { restAfter: ex.restAfterSeconds } : {}),
      mobility,
    };
    return {
      position, block: "MAIN" as const, method_id: HIP_METHOD_ID, name: ex.name[locale],
      instructions, modality: "REPS" as const,
      target_sets: ex.perSide ? 2 : 1, target_reps: d.dose.reps, target_seconds: null,
      rest_seconds: ex.restSeconds,
      intensity: [variantName, ex.cue[locale]].filter(Boolean).join(" · ").slice(0, 160),
    };
  });
}

export function sessionTitle(plan: Pick<SessionPlan, "level" | "length">, locale: "fr" | "en"): string {
  const level = locale === "fr" ? "Niveau " + plan.level : "Level " + plan.level;
  const short = plan.length === "SHORT" ? (locale === "fr" ? " · courte" : " · short") : "";
  return SESSION_TITLE[locale] + " · " + level + short;
}
