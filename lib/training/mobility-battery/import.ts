import { z } from "zod";
import { CARD_BY_ID, CARD_IDS, type CardId } from "./cards";
import { buildCardRows, conditionsSchema, entrySchema, restFromRows, type ResultRow } from "./results";
import type { GateContext } from "./safety";

/**
 * A bilan done outside the app (for example a baseline recorded with the coach) and
 * imported with the climber's coach key. Every card goes through the same rules as a card
 * entered in the app (`buildCardRows`): sides, items, ranges, categories, "not done" never
 * a zero, access levels, stop signs. Pure: the route builds the rows, the database writes
 * them for the key's owner only. The values are self-reported and stay labelled as such.
 */

export const importCardSchema = z.object({
  cardId: z.enum(CARD_IDS),
  entries: z.array(entrySchema).min(1).max(24),
  note: z.string().trim().max(2000).default(""),
}).strict();

export const bilanImportSchema = z.object({
  /** The day the bilan was done: today or earlier, never in the future. */
  startedOn: z.iso.date(),
  /** COMPLETED, or STOPPED (stopped part-way, by choice or for a symptom). */
  status: z.enum(["COMPLETED", "STOPPED"]),
  stopReason: z.enum(["SYMPTOM", "CHOICE"]).nullable().default(null),
  kneePainToday: z.boolean().default(false),
  conditions: conditionsSchema.default(conditionsSchema.parse({})),
  notes: z.string().trim().max(1000).default(""),
  cards: z.array(importCardSchema).min(1).max(CARD_IDS.length),
}).strict().superRefine((b, ctx) => {
  if ((b.status === "STOPPED") !== (b.stopReason !== null)) ctx.addIssue({ code: "custom", path: ["stopReason"], message: "A stopped bilan needs its reason, a completed one none" });
  const ids = b.cards.map((c) => c.cardId);
  if (new Set(ids).size !== ids.length) ctx.addIssue({ code: "custom", path: ["cards"], message: "Each card once" });
});

export type BilanImportInput = z.input<typeof bilanImportSchema>;
export type BilanImport = z.output<typeof bilanImportSchema>;

export type ImportResult = { ok: true; rows: ResultRow[] } | { ok: false; error: string; cardId?: CardId };

/** The rows of an imported bilan, built card by card with the app's own rules (M01 first, as in the app). */
export function buildImportRows(b: BilanImport): ImportResult {
  const rows: ResultRow[] = [];
  const ordered = [...b.cards].sort((x, y) => CARD_IDS.indexOf(x.cardId) - CARD_IDS.indexOf(y.cardId));
  for (const c of ordered) {
    const card = CARD_BY_ID.get(c.cardId);
    if (!card) return { ok: false, error: "unknown_card", cardId: c.cardId };
    const gate: GateContext = { sessionOpen: true, kneePainToday: b.kneePainToday, clinicalReviewOn: null, rest: restFromRows(rows) };
    const built = buildCardRows(card, c.entries, c.note, gate);
    if (!built.ok) return { ok: false, error: built.error, cardId: c.cardId };
    if (built.rows.some((r) => r.status === "NOT_DONE" && r.not_done_reason === "LOCKED")) return { ok: false, error: "locked", cardId: c.cardId };
    if (built.endSession) return { ok: false, error: "ends_session", cardId: c.cardId };
    rows.push(...built.rows);
  }
  return { ok: true, rows };
}
