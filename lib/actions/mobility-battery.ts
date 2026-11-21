"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { d1Open } from "@/lib/analytics/mobility-battery";
import { gateOf, loadBatterySession } from "@/lib/data/mobility-battery";
import { BATTERY_PROTOCOL_VERSION, CARD_BY_ID } from "@/lib/training/mobility-battery/cards";
import { buildCardRows, cardInputSchema, d1Schema, startSchema, type BuildError } from "@/lib/training/mobility-battery/results";
import { safetyScreen, type SafetyOutcome, type StopSign } from "@/lib/training/mobility-battery/safety";
import { localDate_ } from "@/lib/training/sessions";

/**
 * Mobility battery writes. Access levels and stop conditions are enforced here from the
 * stored bilan (never from what the browser claims), and again by the database.
 */

type ErrorCode = "invalid" | "locked" | "closed" | "open" | "blocked" | "not_found" | "unknown";
type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: ErrorCode; detail?: BuildError | SafetyOutcome };

function revalidateBattery() {
  revalidatePath("/train/mobility", "layout");
  revalidatePath("/follow-up/mobility", "layout");
}

/**
 * Starts a bilan after the safety screen. A red flag blocks the start and nothing at all is
 * written: the answers themselves are never stored.
 */
export async function startBattery(input: unknown): Promise<Result<{ id: string }>> {
  const viewer = await requireViewer();
  const parsed = startSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const outcome = safetyScreen(parsed.data.safety);
  if (outcome !== "CLEAR") return { ok: false, error: "blocked", detail: outcome };
  const today = localDate_(new Date());
  if (parsed.data.clinicalReviewOn && parsed.data.clinicalReviewOn > today) return { ok: false, error: "invalid" };
  const { data, error } = await viewer.supabase.from("mobility_battery_sessions").insert({
    user_id: viewer.userId, protocol_version: BATTERY_PROTOCOL_VERSION, started_on: today,
    conditions: parsed.data.conditions, knee_pain_today: parsed.data.kneePainToday, clinical_review_on: parsed.data.clinicalReviewOn,
  }).select("id").single();
  if (error?.code === "23505") return { ok: false, error: "open" };
  if (error || !data) return { ok: false, error: "unknown" };
  revalidateBattery();
  return { ok: true, data: { id: data.id } };
}

/**
 * Saves one card (all its sides, items and trials), replacing what was saved before for
 * that card. A stop sign keeps the trial as "not done (stopped)"; radiation lower or
 * stronger, weakness, or worse neurological symptoms stop the whole bilan.
 */
export async function saveBatteryCard(input: unknown): Promise<Result<{ endSession: null | "NEURO_WORSE" | "SYMPTOM"; stopped: StopSign[] }>> {
  const viewer = await requireViewer();
  const parsed = cardInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { sessionId, cardId, entries, note, clinicalReviewOn } = parsed.data;
  const loaded = await loadBatterySession(viewer.supabase, sessionId);
  if (!loaded) return { ok: false, error: "not_found" };
  if (loaded.session.status !== "IN_PROGRESS") return { ok: false, error: "closed" };
  const card = CARD_BY_ID.get(cardId)!;

  // M20: the date of the clinical review opens the "after clinical review" cards.
  if (cardId === "M20" && clinicalReviewOn !== undefined) {
    if (clinicalReviewOn && clinicalReviewOn > localDate_(new Date())) return { ok: false, error: "invalid" };
    const { error } = await viewer.supabase.from("mobility_battery_sessions").update({ clinical_review_on: clinicalReviewOn }).eq("id", sessionId);
    if (error) return { ok: false, error: "unknown" };
  }

  // M01 is judged on the values being saved now, not the previous ones.
  const others = loaded.results.filter((r) => r.cardId !== cardId);
  const built = buildCardRows(card, entries, note, gateOf(loaded.session, others));
  if (!built.ok) return { ok: false, error: "invalid", detail: built.error };

  const { error: delError } = await viewer.supabase.from("mobility_battery_results").delete().eq("session_id", sessionId).eq("card_id", cardId);
  if (delError) return { ok: false, error: "unknown" };
  const { error } = await viewer.supabase.from("mobility_battery_results")
    .insert(built.rows.map((r) => ({ ...r, session_id: sessionId, user_id: viewer.userId })));
  if (error) return { ok: false, error: error.code === "23514" ? "locked" : "unknown" };

  if (built.endSession) {
    await viewer.supabase.from("mobility_battery_sessions")
      .update({ status: "STOPPED", stop_reason: built.endSession, completed_at: new Date().toISOString() }).eq("id", sessionId);
  }
  revalidateBattery();
  return { ok: true, data: { endSession: built.endSession, stopped: built.stopped } };
}

const idSchema = z.string().uuid();

/** Finishes the bilan; cards left empty simply stay "not done". */
export async function finishBattery(sessionId: unknown): Promise<Result> {
  return closeBattery(sessionId, "COMPLETED");
}

/** Stops the bilan at the climber's request; what is saved is kept. */
export async function stopBattery(sessionId: unknown): Promise<Result> {
  return closeBattery(sessionId, "STOPPED");
}

async function closeBattery(sessionId: unknown, status: "COMPLETED" | "STOPPED"): Promise<Result> {
  const viewer = await requireViewer();
  const id = idSchema.safeParse(sessionId);
  if (!id.success) return { ok: false, error: "invalid" };
  const { data, error } = await viewer.supabase.from("mobility_battery_sessions")
    .update({ status, stop_reason: status === "STOPPED" ? "CHOICE" : null, completed_at: new Date().toISOString() })
    .eq("id", id.data).eq("status", "IN_PROGRESS").select("id");
  if (error) return { ok: false, error: "unknown" };
  if (!data?.length) return { ok: false, error: "closed" };
  revalidateBattery();
  return { ok: true, data: undefined };
}

/** The next-day symptom check, from the day after a finished bilan. */
export async function saveBatteryD1(input: unknown): Promise<Result> {
  const viewer = await requireViewer();
  const parsed = d1Schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const loaded = await loadBatterySession(viewer.supabase, parsed.data.sessionId);
  if (!loaded) return { ok: false, error: "not_found" };
  const today = localDate_(new Date());
  if (!d1Open(loaded.session, today)) return { ok: false, error: "invalid" };
  const { backPain, legPain, radiationLower, newSymptoms, note } = parsed.data;
  const { error } = await viewer.supabase.from("mobility_battery_sessions").update({ d1_check: { backPain, legPain, radiationLower, newSymptoms, note, date: today } }).eq("id", parsed.data.sessionId);
  if (error) return { ok: false, error: "unknown" };
  revalidateBattery();
  return { ok: true, data: undefined };
}
