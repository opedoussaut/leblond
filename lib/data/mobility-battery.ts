import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import type { BatteryResult, BatterySession } from "@/lib/analytics/mobility-battery";
import { isCardId, MAX_BATTERY_SESSIONS, type CardId } from "@/lib/training/mobility-battery/cards";
import { conditionsSchema, detailsSchema, restFromRows, type Conditions, type ResultDetails } from "@/lib/training/mobility-battery/results";
import type { GateContext } from "@/lib/training/mobility-battery/safety";

/**
 * Reads for the mobility battery. RLS scopes every query to the viewer; nothing here
 * is ever passed to Patrick or shown to anyone else.
 */

export type BatterySessionRow = BatterySession & {
  stopReason: "NEURO_WORSE" | "SYMPTOM" | "CHOICE" | null;
  conditions: Conditions;
  kneePainToday: boolean;
  clinicalReviewOn: string | null;
  d1: D1Check | null;
  notes: string;
};
export type D1Check = { date: string; backPain: number; legPain: number; radiationLower: boolean; newSymptoms: boolean; note: string };
export type BatteryResultRow = BatteryResult & { id: string; details: ResultDetails; note: string };

const SESSION_COLUMNS = "id,started_on,status,stop_reason,conditions,knee_pain_today,clinical_review_on,d1_check,notes";
const RESULT_COLUMNS = "id,session_id,card_id,side,item,trial,status,value,category,unit,not_done_reason,pain_before,pain_after,radiation,details,note";

function parseD1(v: unknown): D1Check | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  const n = (x: unknown) => (typeof x === "number" ? x : 0);
  return {
    date: typeof o.date === "string" ? o.date : "", backPain: n(o.backPain), legPain: n(o.legPain),
    radiationLower: o.radiationLower === true, newSymptoms: o.newSymptoms === true, note: typeof o.note === "string" ? o.note : "",
  };
}

export function toSession(r: Pick<Tables<"mobility_battery_sessions">, "id" | "started_on" | "status" | "stop_reason" | "conditions" | "knee_pain_today" | "clinical_review_on" | "d1_check" | "notes">): BatterySessionRow {
  const conditions = conditionsSchema.safeParse(r.conditions ?? {});
  return {
    id: r.id, startedOn: r.started_on, status: r.status, stopReason: r.stop_reason,
    conditions: conditions.success ? conditions.data : conditionsSchema.parse({}),
    kneePainToday: r.knee_pain_today, clinicalReviewOn: r.clinical_review_on, d1: parseD1(r.d1_check), notes: r.notes,
  };
}

export function toResult(r: Pick<Tables<"mobility_battery_results">, "id" | "session_id" | "card_id" | "side" | "item" | "trial" | "status" | "value" | "category" | "unit" | "not_done_reason" | "pain_before" | "pain_after" | "radiation" | "details" | "note">): BatteryResultRow | null {
  if (!isCardId(r.card_id)) return null;
  const details = detailsSchema.safeParse(r.details ?? {});
  return {
    id: r.id, sessionId: r.session_id, cardId: r.card_id as CardId, side: r.side, item: r.item, trial: r.trial, status: r.status,
    value: r.value === null ? null : Number(r.value), category: r.category, unit: r.unit, notDoneReason: r.not_done_reason,
    painBefore: r.pain_before, painAfter: r.pain_after, radiation: r.radiation, details: details.success ? details.data : {}, note: r.note,
  };
}

const rows = (data: unknown) => ((data ?? []) as Parameters<typeof toResult>[0][]).map(toResult).filter((r): r is BatteryResultRow => r !== null);

/** Every bilan (newest first) and every result: a few hundred rows at most per climber. */
export async function loadBattery(supabase: ServerSupabase): Promise<{ sessions: BatterySessionRow[]; results: BatteryResultRow[] }> {
  const [{ data: s }, { data: r }] = await Promise.all([
    supabase.from("mobility_battery_sessions").select(SESSION_COLUMNS)
      .order("started_on", { ascending: false }).order("created_at", { ascending: false }).limit(MAX_BATTERY_SESSIONS),
    supabase.from("mobility_battery_results").select(RESULT_COLUMNS).limit(20000),
  ]);
  return { sessions: ((s ?? []) as Parameters<typeof toSession>[0][]).map(toSession), results: rows(r) };
}

/** One bilan and its results, or null when it is not the viewer's. */
export async function loadBatterySession(supabase: ServerSupabase, id: string): Promise<{ session: BatterySessionRow; results: BatteryResultRow[] } | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [{ data: s }, { data: r }] = await Promise.all([
    supabase.from("mobility_battery_sessions").select(SESSION_COLUMNS).eq("id", id).maybeSingle(),
    supabase.from("mobility_battery_results").select(RESULT_COLUMNS).eq("session_id", id),
  ]);
  if (!s) return null;
  return { session: toSession(s as Parameters<typeof toSession>[0]), results: rows(r) };
}

/** What the access levels need from a bilan. */
export function gateOf(session: BatterySessionRow, results: readonly BatteryResultRow[]): GateContext {
  return {
    sessionOpen: session.status === "IN_PROGRESS",
    kneePainToday: session.kneePainToday,
    clinicalReviewOn: session.clinicalReviewOn,
    rest: restFromRows(results.map((r) => ({ card_id: r.cardId, item: r.item, status: r.status, value: r.value, details: r.details }))),
  };
}
