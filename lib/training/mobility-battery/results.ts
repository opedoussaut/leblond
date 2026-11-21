import { z } from "zod";
import { CARD_IDS, GONIOMETRY_MOVES, cardSides, type Card, type CardId, type Side, type Unit } from "./cards";
import {
  DISTAL_AREAS, NEURO_STATES, RADIATION, STOP_SIGNS, cardAccess, evaluateMovement, symptomsEndSession,
  type GateContext, type Radiation, type StopSign,
} from "./safety";

/**
 * What a card form sends, and how it becomes stored rows. Pure: the server action calls
 * `buildCardRows` with the bilan's state, so access levels and stop conditions are
 * enforced on the server whatever the browser sent.
 */

export const NOT_DONE_REASONS = ["PAIN", "STOPPED_SYMPTOM", "LOCKED", "NO_EQUIPMENT", "NO_TIME", "NOT_SAFE", "OTHER"] as const;
export type NotDoneReason = (typeof NOT_DONE_REASONS)[number];
/** The reasons a climber picks; LOCKED and STOPPED_SYMPTOM are set by the app. */
export const CHOSEN_NOT_DONE_REASONS = ["PAIN", "NOT_SAFE", "NO_EQUIPMENT", "NO_TIME", "OTHER"] as const satisfies readonly NotDoneReason[];

const pain = z.number().int().min(0).max(10).nullable();

const angleSchema = z.object({
  move: z.enum(GONIOMETRY_MOVES),
  side: z.enum(["LEFT", "RIGHT"]),
  mode: z.enum(["ACTIVE", "PASSIVE"]),
  degrees: z.number().min(-30).max(200),
}).strict();

export const detailsSchema = z.object({
  handsUsed: z.boolean().optional(),
  unilateral: z.boolean().optional(),
  compensation: z.boolean().optional(),
  limitedByOtherLeg: z.boolean().optional(),
  photo: z.boolean().optional(),
  // M01
  neuro: z.enum(NEURO_STATES).optional(),
  legSide: z.enum(["NONE", "LEFT", "RIGHT", "BOTH"]).optional(),
  distal: z.enum(DISTAL_AREAS).optional(),
  // M19, transcribed from the clinician
  angles: z.array(angleSchema).max(20).optional(),
  // Set by the app when a movement is stopped
  stopSigns: z.array(z.enum(STOP_SIGNS)).max(STOP_SIGNS.length).optional(),
}).strict();
export type ResultDetails = z.infer<typeof detailsSchema>;

export const entrySchema = z.object({
  side: z.enum(["LEFT", "RIGHT", "BOTH"]),
  item: z.number().int().min(1).max(6).default(1),
  trial: z.number().int().min(1).max(2).default(1),
  status: z.enum(["DONE", "NOT_DONE"]),
  value: z.number().finite().nullable().default(null),
  category: z.string().regex(/^[A-Z_]{1,32}$/).nullable().default(null),
  notDoneReason: z.enum(NOT_DONE_REASONS).nullable().default(null),
  painBefore: pain.default(null),
  painAfter: pain.default(null),
  radiation: z.enum(RADIATION).nullable().default(null),
  signs: z.array(z.enum(STOP_SIGNS)).max(STOP_SIGNS.length).default([]),
  details: detailsSchema.default({}),
}).strict();
export type EntryInput = z.input<typeof entrySchema>;
export type Entry = z.output<typeof entrySchema>;

export const cardInputSchema = z.object({
  sessionId: z.string().uuid(),
  cardId: z.enum(CARD_IDS),
  entries: z.array(entrySchema).min(1).max(24),
  note: z.string().trim().max(2000).default(""),
  /** M20 only: the date of the clinical review (unlocks "after clinical review" cards). */
  clinicalReviewOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
}).strict();
export type CardInput = z.output<typeof cardInputSchema>;

export type ResultRow = {
  card_id: CardId;
  card_version: number;
  side: Side;
  item: number;
  trial: number;
  status: "DONE" | "NOT_DONE";
  value: number | null;
  category: string | null;
  unit: Unit;
  not_done_reason: NotDoneReason | null;
  pain_before: number | null;
  pain_after: number | null;
  radiation: Radiation | null;
  details: ResultDetails;
  note: string;
};

export type BuildError = "bad_side" | "bad_item" | "bad_trial" | "duplicate" | "bad_value" | "bad_category" | "needs_reason" | "not_report";
export type BuildResult =
  | { ok: true; rows: ResultRow[]; endSession: null | "NEURO_WORSE" | "SYMPTOM"; stopped: StopSign[] }
  | { ok: false; error: BuildError };

function unitOf(card: Card): Unit {
  if (card.access === "clinician_only") return "REPORT";
  return card.measure?.unit ?? "CATEGORY";
}

/**
 * Turns a card form into rows, enforcing on the way:
 *  - the card's sides, items and number of scored trials;
 *  - "not done" is never a zero (no value, always a reason);
 *  - a locked card can only be recorded as not done (LOCKED);
 *  - a clinician card is only ever a transcribed report;
 *  - a movement with a stop sign is kept as "not done (stopped)", without its value;
 *  - radiation lower or stronger, weakness, or worse neurological symptoms end the bilan.
 */
export function buildCardRows(card: Card, entries: readonly Entry[], note: string, gate: GateContext): BuildResult {
  const access = cardAccess(card, gate);
  const sides = cardSides(card);
  const keys = new Set<string>();
  const rows: ResultRow[] = [];
  const stopped = new Set<StopSign>();
  let endSession: null | "NEURO_WORSE" | "SYMPTOM" = null;

  if (access.state === "CLINICIAN") {
    const e = entries[0];
    if (entries.length !== 1 || e.side !== "BOTH" || e.status !== "DONE" || e.value !== null || e.category !== null) return { ok: false, error: "not_report" };
    return {
      ok: true, endSession: null, stopped: [],
      rows: [{
        card_id: card.id, card_version: card.version, side: "BOTH", item: 1, trial: 1, status: "DONE", value: null, category: null,
        unit: "REPORT", not_done_reason: null, pain_before: null, pain_after: null, radiation: null,
        details: card.id === "M19" && e.details.angles ? { angles: e.details.angles } : {}, note,
      }],
    };
  }

  for (const e of entries) {
    if (!sides.includes(e.side)) return { ok: false, error: "bad_side" };
    if (!card.items.some((i) => i.item === e.item)) return { ok: false, error: "bad_item" };
    if (e.trial > card.trials) return { ok: false, error: "bad_trial" };
    const key = `${e.side}:${e.item}:${e.trial}`;
    if (keys.has(key)) return { ok: false, error: "duplicate" };
    keys.add(key);

    const base = {
      card_id: card.id, card_version: card.version, side: e.side, item: e.item, trial: e.trial,
      pain_before: card.painCheck ? e.painBefore : null,
      pain_after: card.painCheck ? e.painAfter : null,
      radiation: card.painCheck || card.id === "M01" ? e.radiation : null,
    };
    // Stop signs are set by the app from what was ticked, never taken from the browser's details.
    const details: ResultDetails = { ...e.details };
    delete details.stopSigns;
    const notDone = (reason: NotDoneReason, extra: ResultDetails = {}): ResultRow => ({
      ...base, status: "NOT_DONE", value: null, category: null, unit: unitOf(card), not_done_reason: reason, details: { ...details, ...extra }, note: "",
    });

    if (access.state === "LOCKED") { rows.push(notDone("LOCKED")); continue; }

    if (card.painCheck) {
      const m = evaluateMovement({ signs: e.signs, radiation: e.radiation, painBefore: e.painBefore, painAfter: e.painAfter });
      if (m.stopMovement) {
        m.signs.forEach((s) => stopped.add(s));
        if (m.endSession) endSession = "SYMPTOM";
        rows.push(notDone("STOPPED_SYMPTOM", { stopSigns: m.signs }));
        continue;
      }
    }

    if (e.status === "NOT_DONE") {
      if (!e.notDoneReason || e.notDoneReason === "LOCKED") return { ok: false, error: "needs_reason" };
      rows.push(notDone(e.notDoneReason));
      continue;
    }

    const measure = card.measure;
    if (!measure) return { ok: false, error: "bad_value" };
    if (e.category !== null) {
      if (e.value !== null || !measure.categories?.some((c) => c.id === e.category)) return { ok: false, error: "bad_category" };
      rows.push({ ...base, status: "DONE", value: null, category: e.category, unit: "CATEGORY", not_done_reason: null, details, note: "" });
      continue;
    }
    if (e.value === null || measure.unit === null || e.value < measure.min || e.value > measure.max) return { ok: false, error: "bad_value" };
    rows.push({ ...base, status: "DONE", value: Math.round(e.value * 10) / 10, category: null, unit: measure.unit, not_done_reason: null, details, note: "" });
  }

  if (card.id === "M01") {
    const neuro = entries.find((e) => e.details.neuro)?.details.neuro ?? null;
    if (symptomsEndSession({ backPain: null, legPain: null, neuro })) endSession = "NEURO_WORSE";
  }
  if (rows.length) rows[0] = { ...rows[0], note };
  return { ok: true, rows, endSession, stopped: STOP_SIGNS.filter((s) => stopped.has(s)) };
}

/** Rebuilds the M01 symptoms of a bilan from its stored rows (item 1 = back, item 2 = leg). */
export function restFromRows(rows: readonly Pick<ResultRow, "card_id" | "item" | "status" | "value" | "details">[]): GateContext["rest"] {
  const m01 = rows.filter((r) => r.card_id === "M01");
  if (!m01.length) return null;
  const val = (item: number) => m01.find((r) => r.item === item && r.status === "DONE")?.value ?? null;
  const neuro = m01.find((r) => r.details?.neuro)?.details.neuro ?? null;
  return { backPain: val(1), legPain: val(2), neuro };
}

// ── Start and D+1 ────────────────────────────────────────────────────────
export const conditionsSchema = z.object({
  chairHeightCm: z.number().min(20).max(100).nullable().default(null),
  shoes: z.enum(["BAREFOOT", "SOCKS", "SHOES"]).nullable().default(null),
  warmUp: z.enum(["WALK", "GENTLE", "NONE"]).nullable().default(null),
  timeOfDay: z.enum(["MORNING", "MIDDAY", "EVENING"]).nullable().default(null),
  framing: z.string().trim().max(200).default(""),
}).strict();
export type Conditions = z.output<typeof conditionsSchema>;

export const startSchema = z.object({
  safety: z.object({
    newNeuro: z.boolean(), bladderBowel: z.boolean(), saddleNumbness: z.boolean(), recentFallSpinalPain: z.boolean(),
  }).strict(),
  kneePainToday: z.boolean(),
  clinicalReviewOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  conditions: conditionsSchema,
}).strict();
export type StartInput = z.input<typeof startSchema>;

export const d1Schema = z.object({
  sessionId: z.string().uuid(),
  backPain: z.number().int().min(0).max(10),
  legPain: z.number().int().min(0).max(10),
  radiationLower: z.boolean(),
  newSymptoms: z.boolean(),
  note: z.string().trim().max(500).default(""),
}).strict();
export type D1Input = z.input<typeof d1Schema>;
