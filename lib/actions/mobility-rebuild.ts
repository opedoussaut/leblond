"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer, type Viewer } from "@/lib/auth/viewer";
import { loadRebuild } from "@/lib/data/mobility-rebuild";
import { startTrainingSession, changeTrainingStatus } from "@/lib/actions/training-sessions";
import {
  OVERALL, REBUILD_METHOD_ID, STOP_REASONS, beforeVerdict, phaseFor, postponeDate, redate, slotInfo, stopIsEmergency, validDays,
  type Phase, type Verdict,
} from "@/lib/training/mobility-rebuild/engine";
import { rebuildExerciseRows, templateFor } from "@/lib/training/mobility-rebuild/templates";
import { localDate_ } from "@/lib/training/sessions";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: "invalid" | "not_found" | "state" | "live" | "unknown"; liveId?: string };

const pain = z.number().int().min(0).max(10);
const checkSchema = z.object({
  sessionId: z.guid(),
  backPain: pain, legRadiation: pain,
  radiationSpreading: z.boolean(), unusualPain: z.boolean(),
  newNeuro: z.boolean(), bladderBowel: z.boolean(), saddleNumbness: z.boolean(), recentFallSpinalPain: z.boolean(),
}).strict();
const stopSchema = z.object({ sessionId: z.guid(), reason: z.enum(STOP_REASONS) }).strict();
const followUpSchema = z.object({
  sessionId: z.guid(), overall: z.enum(OVERALL), backPain: pain, legRadiation: pain, radiationSpreading: z.boolean(),
  notes: z.string().trim().max(500).default(""),
}).strict();
const daysSchema = z.array(z.number().int().min(1).max(7)).refine(validDays);
const reviewSchema = z.object({ date: z.iso.date().nullable(), restrictions: z.string().trim().max(1000).default("") }).strict();

function revalidateRebuild(sessionId?: string) {
  revalidatePath("/train", "layout");
  revalidatePath("/follow-up", "layout");
  revalidatePath("/calendar");
  revalidatePath("/home");
  if (sessionId) revalidatePath("/train/sessions/" + sessionId);
}

async function ownSession(viewer: Viewer, sessionId: string) {
  const { data } = await viewer.supabase.from("training_sessions")
    .select("id,status,method_id,enrollment_id,programme_slot,programme_phase,scheduled_date,completed_at")
    .eq("id", sessionId).maybeSingle();
  return data && data.method_id === REBUILD_METHOD_ID && data.enrollment_id && data.programme_slot && data.programme_phase ? data : null;
}

/**
 * The symptom check before a séance, then the start. EMERGENCY and STOP never
 * start the séance; ADAPT starts the gentler version. The phase comes from the
 * climber's own record (engine.phaseFor), never from the calendar alone. Only
 * the verdict and the pain levels are stored, never the emergency answers.
 */
export async function checkInAndStart(input: unknown): Promise<Result<{ verdict: Verdict; reason: string; phase: Phase | null }>> {
  const viewer = await requireViewer();
  const parsed = checkSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const c = parsed.data;
  const s = await ownSession(viewer, c.sessionId);
  if (!s) return { ok: false, error: "not_found" };
  if (s.status !== "PLANNED" && s.status !== "INTERRUPTED") return { ok: false, error: "state" };
  const state = await loadRebuild(viewer.supabase);
  if (!state) return { ok: false, error: "not_found" };
  const { verdict, reason } = beforeVerdict(c, state.view.usual);
  const resume = s.status === "INTERRUPTED";
  const existing = state.view.sessions.find((x) => x.id === s.id)?.before ?? null;
  let phase: Phase | null = existing?.phaseUsed as Phase | null ?? null;
  if (!resume && (verdict === "GO" || verdict === "ADAPT")) {
    const history = state.view.history.filter((h) => h.slot !== s.programme_slot);
    phase = phaseFor(s.programme_phase as Phase, history, state.enrollment.clinicalReviewOn, verdict).phase;
  }
  const values = {
    back_pain: c.backPain, leg_radiation: c.legRadiation, radiation_spreading: c.radiationSpreading, unusual_pain: c.unusualPain,
    verdict, phase_used: phase,
  };
  const { error } = existing
    ? await viewer.supabase.from("mobility_session_checks").update(values).eq("session_id", s.id).eq("moment", "BEFORE")
    : await viewer.supabase.from("mobility_session_checks").insert({ ...values, user_id: viewer.userId, session_id: s.id, moment: "BEFORE" });
  if (error) return { ok: false, error: "unknown" };
  if (verdict === "STOP" || verdict === "EMERGENCY") {
    revalidateRebuild(s.id);
    return { ok: true, data: { verdict, reason, phase: null } };
  }
  if (!resume && phase !== null) {
    // The exercises of the phase in use (the gentler one when held back), from the current
    // content, unless work is already recorded.
    const t = state.enrollment.content ? templateFor(state.enrollment.content, slotInfo(s.programme_slot!).letter, phase) : null;
    const { data: current } = await viewer.supabase.from("training_session_exercises").select("id").eq("session_id", s.id);
    const ids = (current ?? []).map((e) => e.id);
    const { count } = ids.length
      ? await viewer.supabase.from("training_exercise_sets").select("id", { count: "exact", head: true }).in("exercise_id", ids)
      : { count: 0 };
    if (t && (count ?? 0) === 0) {
      const { error: delError } = await viewer.supabase.from("training_session_exercises").delete().eq("session_id", s.id);
      if (delError) return { ok: false, error: "unknown" };
      const { error: insError } = await viewer.supabase.from("training_session_exercises")
        .insert(rebuildExerciseRows(t).map((e) => ({ ...e, user_id: viewer.userId, session_id: s.id })));
      if (insError) return { ok: false, error: "unknown" };
    }
  }
  const started = await startTrainingSession(s.id);
  if (!started.ok) return { ok: false, error: started.error === "live" ? "live" : started.error === "not_found" ? "not_found" : "unknown", liveId: started.liveId };
  revalidateRebuild(s.id);
  return { ok: true, data: { verdict, reason, phase } };
}

/** A stop sign during the séance: recorded, and the séance is interrupted at once. */
export async function stopRebuildSession(input: unknown): Promise<Result<{ emergency: boolean }>> {
  const viewer = await requireViewer();
  const parsed = stopSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const s = await ownSession(viewer, parsed.data.sessionId);
  if (!s) return { ok: false, error: "not_found" };
  if (s.status !== "IN_PROGRESS") return { ok: false, error: "state" };
  const { data: after } = await viewer.supabase.from("mobility_session_checks").select("id")
    .eq("session_id", s.id).eq("moment", "AFTER").maybeSingle();
  const { error } = after
    ? await viewer.supabase.from("mobility_session_checks").update({ stop_reason: parsed.data.reason }).eq("id", after.id)
    : await viewer.supabase.from("mobility_session_checks")
      .insert({ user_id: viewer.userId, session_id: s.id, moment: "AFTER", stop_reason: parsed.data.reason });
  if (error) return { ok: false, error: "unknown" };
  const r = await changeTrainingStatus(s.id, "INTERRUPTED");
  if (!r.ok) return { ok: false, error: "unknown" };
  revalidateRebuild(s.id);
  return { ok: true, data: { emergency: stopIsEmergency(parsed.data.reason) } };
}

/** The next-day follow-up (from the day after, for a week, once). */
export async function saveRebuildFollowUp(input: unknown): Promise<Result> {
  const viewer = await requireViewer();
  const parsed = followUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const state = await loadRebuild(viewer.supabase);
  const s = state?.view.sessions.find((x) => x.id === v.sessionId);
  if (!state || !s) return { ok: false, error: "not_found" };
  if (!s.followUpOpen) return { ok: false, error: "state" };
  const { error } = await viewer.supabase.from("mobility_session_checks").insert({
    user_id: viewer.userId, session_id: s.id, moment: "D1", overall: v.overall,
    back_pain: v.backPain, leg_radiation: v.legRadiation, radiation_spreading: v.radiationSpreading, notes: v.notes,
  });
  if (error) return { ok: false, error: error.code === "23505" ? "state" : "unknown" };
  revalidateRebuild(s.id);
  return { ok: true, data: undefined };
}

/** Postpone a planned séance to the next free programme day after today. */
export async function postponeRebuildSession(sessionId: string): Promise<Result<{ date: string }>> {
  const viewer = await requireViewer();
  if (!z.guid().safeParse(sessionId).success) return { ok: false, error: "invalid" };
  const state = await loadRebuild(viewer.supabase);
  const s = state?.view.sessions.find((x) => x.id === sessionId);
  if (!state || !s) return { ok: false, error: "not_found" };
  if (s.status !== "PLANNED" && s.status !== "SKIPPED") return { ok: false, error: "state" };
  const taken = new Set(state.view.sessions.filter((x) => x.id !== s.id && x.scheduledDate).map((x) => x.scheduledDate!));
  const date = postponeDate(s.scheduledDate ?? state.today, state.today, state.enrollment.days, taken);
  const { error } = await viewer.supabase.from("training_sessions").update({ scheduled_date: date, status: "PLANNED" })
    .eq("id", s.id).in("status", ["PLANNED", "SKIPPED"]);
  if (error) return { ok: false, error: "unknown" };
  revalidateRebuild(s.id);
  return { ok: true, data: { date } };
}

/** Change the three weekdays; séances still planned are re-dated from tomorrow, in order. */
export async function setRebuildDays(input: unknown): Promise<Result<{ moved: number }>> {
  const viewer = await requireViewer();
  const parsed = daysSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const days = [...parsed.data].sort((a, b) => a - b);
  const state = await loadRebuild(viewer.supabase);
  if (!state) return { ok: false, error: "not_found" };
  const { error } = await viewer.supabase.from("mobility_enrollments").update({ schedule_days: days }).eq("id", state.enrollment.id);
  if (error) return { ok: false, error: "unknown" };
  const planned = state.view.sessions.filter((s) => s.status === "PLANNED").map((s) => ({ slot: s.slot, date: s.scheduledDate ?? state.today }));
  const dates = redate(planned, state.today, days);
  let moved = 0;
  for (const s of state.view.sessions) {
    const date = dates.get(s.slot);
    if (!date || s.status !== "PLANNED") continue;
    const { error: e } = await viewer.supabase.from("training_sessions").update({ scheduled_date: date, original_date: date })
      .eq("id", s.id).eq("status", "PLANNED");
    if (e) return { ok: false, error: "unknown" };
    moved++;
  }
  revalidateRebuild();
  return { ok: true, data: { moved } };
}

/** Record (or remove) a clinical review: self-reported date and restrictions. Never in the future. */
export async function saveClinicalReview(input: unknown): Promise<Result> {
  const viewer = await requireViewer();
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  if (v.date && (v.date > localDate_(new Date()) || v.date < "2020-01-01")) return { ok: false, error: "invalid" };
  const state = await loadRebuild(viewer.supabase);
  if (!state) return { ok: false, error: "not_found" };
  const { error } = await viewer.supabase.from("mobility_enrollments").update({
    clinical_review_on: v.date, clinical_restrictions: v.date ? v.restrictions : "",
  }).eq("id", state.enrollment.id);
  if (error) return { ok: false, error: "unknown" };
  revalidateRebuild();
  return { ok: true, data: undefined };
}
