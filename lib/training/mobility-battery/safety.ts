import type { AccessLevel, Card } from "./cards";

/**
 * Mandatory stop conditions and access levels of the mobility battery. Pure functions:
 * the pages show them, the server actions enforce them again, and the database refuses
 * the most important ones a third time.
 */

// ── Before anything: the safety screen ───────────────────────────────────
/** Answered before each bilan. The answers are never stored. */
export type SafetyAnswers = {
  /** A new or progressing neurological symptom (numbness, weakness, tingling that spreads). */
  newNeuro: boolean;
  /** New bladder or bowel problems. */
  bladderBowel: boolean;
  /** Loss of sensation in the saddle / perineal area. */
  saddleNumbness: boolean;
  /** A recent fall or knock with unusual spinal pain. */
  recentFallSpinalPain: boolean;
};

export type SafetyOutcome = "CLEAR" | "URGENT_MEDICAL" | "MEDICAL_BEFORE_ASSESSMENT";

export function safetyScreen(a: SafetyAnswers): SafetyOutcome {
  if (a.newNeuro || a.bladderBowel || a.saddleNumbness) return "URGENT_MEDICAL";
  if (a.recentFallSpinalPain) return "MEDICAL_BEFORE_ASSESSMENT";
  return "CLEAR";
}

// ── M01: symptoms at rest ────────────────────────────────────────────────
export const NEURO_STATES = ["SAME", "BETTER", "WORSE", "NEW"] as const;
export type NeuroState = (typeof NEURO_STATES)[number];
export const DISTAL_AREAS = ["NONE", "BUTTOCK", "THIGH", "KNEE", "CALF", "FOOT"] as const;
export type DistalArea = (typeof DISTAL_AREAS)[number];

/**
 * Rest pain at or below this lets the "when pain-free" cards open. A product choice: a
 * strict 0/10 would close every card for climbers with a steady, known background pain.
 */
export const PAINFREE_MAX_REST_PAIN = 3;

export type SymptomsAtRest = { backPain: number | null; legPain: number | null; neuro: NeuroState | null };

/** A neurological state that is worse than yesterday, or new, ends the bilan. */
export function symptomsEndSession(s: SymptomsAtRest): boolean {
  return s.neuro === "WORSE" || s.neuro === "NEW";
}

// ── During a movement ────────────────────────────────────────────────────
export const STOP_SIGNS = ["NEW_PAIN", "RADIATION_LOWER_STRONGER", "WEAKNESS", "INSTABILITY", "PINCHING", "HARD_BLOCK"] as const;
export type StopSign = (typeof STOP_SIGNS)[number];
export const RADIATION = ["NONE", "SAME", "LOWER_OR_STRONGER"] as const;
export type Radiation = (typeof RADIATION)[number];

/** A rise of this much pain (0–10) during a test counts as new pain. */
export const PAIN_RISE_STOP = 2;

export type MovementCheck = {
  signs: readonly StopSign[];
  radiation: Radiation | null;
  painBefore: number | null;
  painAfter: number | null;
};
export type MovementOutcome = {
  /** Stop this movement: the result is kept as "not done (stopped)", without its value. */
  stopMovement: boolean;
  /** Stop the whole bilan: radiation lower or stronger, or weakness. */
  endSession: boolean;
  signs: StopSign[];
};

export function evaluateMovement(m: MovementCheck): MovementOutcome {
  const signs = new Set<StopSign>(m.signs);
  if (m.radiation === "LOWER_OR_STRONGER") signs.add("RADIATION_LOWER_STRONGER");
  if (m.painBefore !== null && m.painAfter !== null && m.painAfter - m.painBefore >= PAIN_RISE_STOP) signs.add("NEW_PAIN");
  const list = STOP_SIGNS.filter((s) => signs.has(s));
  return {
    stopMovement: list.length > 0,
    endSession: signs.has("RADIATION_LOWER_STRONGER") || signs.has("WEAKNESS"),
    signs: list,
  };
}

// ── Access levels ────────────────────────────────────────────────────────
export type GateContext = {
  sessionOpen: boolean;
  kneePainToday: boolean;
  clinicalReviewOn: string | null;
  /** M01 of this bilan, null while it is not recorded. */
  rest: SymptomsAtRest | null;
};

export type LockReason = "SESSION_CLOSED" | "NEEDS_SYMPTOMS" | "REST_PAIN" | "KNEE_PAIN" | "NEEDS_CLINICAL_REVIEW";
export type CardAccess =
  | { state: "OPEN" }
  | { state: "LOCKED"; reasons: LockReason[] }
  /** Done by a clinician: the climber can only transcribe what they were told. */
  | { state: "CLINICIAN" };

function painFreeReasons(ctx: GateContext): LockReason[] {
  if (!ctx.rest) return ["NEEDS_SYMPTOMS"];
  const high = (v: number | null) => v !== null && v > PAINFREE_MAX_REST_PAIN;
  return high(ctx.rest.backPain) || high(ctx.rest.legPain) || symptomsEndSession(ctx.rest) ? ["REST_PAIN"] : [];
}

export function accessFor(level: AccessLevel, ctx: GateContext): CardAccess {
  if (level === "clinician_only") return { state: "CLINICIAN" };
  if (!ctx.sessionOpen) return { state: "LOCKED", reasons: ["SESSION_CLOSED"] };
  const reasons: LockReason[] = [];
  if (level !== "self_baseline") reasons.push(...painFreeReasons(ctx));
  if (level === "conditional_no_knee_pain" && ctx.kneePainToday) reasons.push("KNEE_PAIN");
  if (level === "after_clinical_review" && !ctx.clinicalReviewOn) reasons.push("NEEDS_CLINICAL_REVIEW");
  return reasons.length ? { state: "LOCKED", reasons } : { state: "OPEN" };
}

export function cardAccess(card: Card, ctx: GateContext): CardAccess { return accessFor(card.access, ctx); }
