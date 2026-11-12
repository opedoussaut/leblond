"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer, type Viewer } from "@/lib/auth/viewer";
import { METHODS_FOR_PLANS } from "@/lib/training/catalogue";
import { PLAN_COLUMNS, phasesOf, planFromRow } from "@/lib/training/plans";
import { snapshotOf, templateFor } from "@/lib/training/session-templates";
import { COACH_SESSION_COLUMNS, coachExerciseRows, coachSessionFromRow } from "@/lib/training/coach-sessions";
import {
  activeSeconds, canTransition, completeSessionSchema, createTrainingSessionSchema, dateForPlanDay, editTrainingSchema, pastTrainingSchema,
  exerciseStatusSchema, saveSetSchema, settledExerciseStatus, type TrainingStatus,
} from "@/lib/training/sessions";
import { loadTrainingSession } from "@/lib/data/training-sessions";
import { currentPlan, loadMobility } from "@/lib/data/mobility";
import { HIP_METHOD_ID, LEVEL_SESSIONS, type SessionLength } from "@/lib/training/hip-mobility/content";
import { mobilityExerciseRows, sessionTitle } from "@/lib/training/hip-mobility/prescription";
import { scheduleMobilitySchema } from "@/lib/training/sessions";
import { zonedToUtc } from "@/lib/time";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: "invalid" | "not_found" | "live" | "state" | "limit" | "unknown"; liveId?: string };

const id = z.guid();
/** A planned hip-mobility session this short was the short version. */
const SHORT_MINUTES = LEVEL_SESSIONS[0]!.SHORT.minutes;
const MAX_SESSIONS = 3000;

function revalidateTraining(sessionId?: string) {
  revalidatePath("/train", "layout");
  revalidatePath("/patrick");
  revalidatePath("/calendar");
  revalidatePath("/follow-up", "layout");
  revalidatePath("/home");
  if (sessionId) revalidatePath("/train/sessions/" + sessionId);
}

function methodTitle(methodId: string | null): string | null {
  return METHODS_FOR_PLANS.find((m) => m.id === methodId)?.title ?? null;
}

async function liveSessionId(viewer: Viewer): Promise<string | null> {
  const { data } = await viewer.supabase.from("training_sessions").select("id")
    .eq("status", "IN_PROGRESS").maybeSingle();
  return data?.id ?? null;
}

type NewSession = {
  title: string; objective: string; methodId: string | null;
  planId?: string | null; planSessionIndex?: number | null; calendarEntryId?: string | null;
  date: string | null; time: string | null; minutes: number | null; startNow: boolean;
  /** Exercises of their own (coach sessions); otherwise the Atlas template of `methodId`. */
  exercises?: ReturnType<typeof coachExerciseRows> | ReturnType<typeof mobilityExerciseRows>;
  /** Hip-mobility options: session length and accepted increases. */
  mobility?: { length?: SessionLength; accept?: readonly string[] };
};

/**
 * The exercise rows of a hip-mobility session, prescribed from the climber's own
 * records (never the fixed Atlas template), whatever the session came from.
 */
async function mobilityRows(viewer: Viewer, options: NewSession["mobility"]) {
  const locale = viewer.profile.preferred_language === "en" ? "en" : "fr";
  const plan = currentPlan(await loadMobility(viewer.supabase), options?.length, options?.accept);
  return { plan, rows: mobilityExerciseRows(plan, locale) };
}

/** Creates a session and its exercise snapshot atomically (compensating delete on failure). */
async function insertSession(viewer: Viewer, s: NewSession): Promise<Result<{ id: string }>> {
  const { count } = await viewer.supabase.from("training_sessions").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= MAX_SESSIONS) return { ok: false, error: "limit" };
  if (s.startNow) {
    const live = await liveSessionId(viewer);
    if (live) return { ok: false, error: "live", liveId: live };
  }
  const now = new Date().toISOString();
  const { data: created, error } = await viewer.supabase.from("training_sessions").insert({
    user_id: viewer.userId, title: s.title.slice(0, 120), objective: s.objective.slice(0, 300),
    method_id: s.methodId, plan_id: s.planId ?? null, plan_session_index: s.planSessionIndex ?? null,
    calendar_entry_id: s.calendarEntryId ?? null, scheduled_date: s.date, scheduled_time: s.time || null,
    planned_minutes: s.minutes, status: s.startNow ? "IN_PROGRESS" : "PLANNED", started_at: s.startNow ? now : null,
  }).select("id").single();
  if (error || !created) {
    if (error?.code === "23505" && s.calendarEntryId) {
      const { data: existing } = await viewer.supabase.from("training_sessions").select("id")
        .eq("calendar_entry_id", s.calendarEntryId).maybeSingle();
      if (existing) return { ok: true, data: { id: existing.id } };
    }
    if (error?.code === "23505") {
      const live = await liveSessionId(viewer);
      if (live) return { ok: false, error: "live", liveId: live };
    }
    return { ok: false, error: "unknown" };
  }
  const locale = viewer.profile.preferred_language === "en" ? "en" : "fr";
  const own = s.exercises ?? (s.methodId === HIP_METHOD_ID ? (await mobilityRows(viewer, s.mobility)).rows : undefined);
  const rows = own ? own.map((e) => ({ user_id: viewer.userId, session_id: created.id, ...e })) : templateFor(s.methodId, s.minutes).map((t, position) => ({
    user_id: viewer.userId, session_id: created.id, position, block: t.block, method_id: t.methodId,
    name: t.name[locale], instructions: snapshotOf(t), modality: t.modality,
    target_sets: t.targetSets, target_reps: t.targetReps, target_seconds: t.targetSeconds,
    rest_seconds: t.restSeconds, intensity: t.intensity[locale],
  }));
  const { error: exError } = await viewer.supabase.from("training_session_exercises").insert(rows);
  if (exError) {
    await viewer.supabase.from("training_sessions").delete().eq("id", created.id);
    return { ok: false, error: "unknown" };
  }
  return { ok: true, data: { id: created.id } };
}

/** Create (and optionally start) a training session from a quick action, a plan or a calendar entry. */
export async function createTrainingSession(input: unknown): Promise<Result<{ id: string }>> {
  const viewer = await requireViewer();
  const parsed = createTrainingSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const fr = viewer.profile.preferred_language !== "en";
  let result: Result<{ id: string }>;

  if (v.source === "quick") {
    result = await insertSession(viewer, {
      title: v.title || methodTitle(v.methodId) || (fr ? "Séance d’entraînement" : "Training session"),
      objective: "", methodId: v.methodId, date: v.date, time: v.time, minutes: v.minutes, startNow: v.startNow,
    });
  } else if (v.source === "coach") {
    const { data: row } = await viewer.supabase.from("coach_sessions").select(COACH_SESSION_COLUMNS)
      .eq("id", v.coachSessionId).maybeSingle();
    const coach = row ? coachSessionFromRow(row) : null;
    if (!coach) return { ok: false, error: "not_found" };
    result = await insertSession(viewer, {
      title: coach.title, objective: coach.objective, methodId: null,
      date: v.date, time: v.time, minutes: coach.minutes, startNow: v.startNow,
      exercises: coachExerciseRows(coach),
    });
  } else if (v.source === "mobility") {
    const { plan, rows } = await mobilityRows(viewer, { length: v.length, accept: v.accept });
    if (rows.length === 0) return { ok: false, error: "state" };
    result = await insertSession(viewer, {
      title: sessionTitle(plan, fr ? "fr" : "en"), objective: "", methodId: HIP_METHOD_ID,
      date: v.date, time: v.time, minutes: plan.minutes, startNow: v.startNow, exercises: rows,
    });
  } else if (v.source === "plan") {
    const { data: plan } = await viewer.supabase.from("training_plans").select(PLAN_COLUMNS)
      .eq("id", v.planId).maybeSingle();
    const parsedPlan = plan ? planFromRow(plan) : null;
    const ps = parsedPlan ? phasesOf(parsedPlan)[v.phaseIndex ?? 0]?.sessions[v.planSessionIndex] : undefined;
    if (!plan || !ps) return { ok: false, error: "not_found" };
    result = await insertSession(viewer, {
      title: (ps.title ?? methodTitle(ps.methodId) ?? "Training") + " · " + plan.name,
      objective: [plan.goal, ps.notes].filter(Boolean).join(" — "), methodId: ps.methodId,
      planId: plan.id, planSessionIndex: v.planSessionIndex,
      date: v.date, time: v.time, minutes: ps.minutes, startNow: v.startNow,
    });
  } else {
    const { data: existing } = await viewer.supabase.from("training_sessions").select("id,status")
      .eq("calendar_entry_id", v.calendarEntryId).maybeSingle();
    if (existing) {
      result = { ok: true, data: { id: existing.id } };
      if (v.startNow && existing.status === "PLANNED") {
        const started = await startTrainingSession(existing.id);
        if (!started.ok) return started;
      }
    } else {
      const { data: entry } = await viewer.supabase.from("calendar_entries")
        .select("id,title,event_date,start_time,duration_minutes,method_id,notes,kind")
        .eq("id", v.calendarEntryId).maybeSingle();
      if (!entry || entry.kind !== "TRAIN") return { ok: false, error: "not_found" };
      result = await insertSession(viewer, {
        title: entry.title, objective: entry.notes.slice(0, 300), methodId: entry.method_id,
        calendarEntryId: entry.id, date: entry.event_date, time: entry.start_time?.slice(0, 5) ?? null,
        minutes: entry.duration_minutes, startNow: v.startNow,
      });
    }
  }
  if (result.ok) revalidateTraining(result.data.id);
  return result;
}

/** Schedule every session of a saved plan (of one of its phases) into the week starting on `monday`. Idempotent per day. */
export async function schedulePlanWeek(planId: string, monday: string, phaseIndex = 0): Promise<Result<{ created: number }>> {
  const viewer = await requireViewer();
  if (!id.safeParse(planId).success || !z.iso.date().safeParse(monday).success
    || !z.number().int().min(0).max(11).safeParse(phaseIndex).success) return { ok: false, error: "invalid" };
  const { data: plan } = await viewer.supabase.from("training_plans").select(PLAN_COLUMNS).eq("id", planId).maybeSingle();
  const parsedPlan = plan ? planFromRow(plan) : null;
  const sessions = parsedPlan ? phasesOf(parsedPlan)[phaseIndex]?.sessions : undefined;
  if (!plan || !sessions) return { ok: false, error: "not_found" };
  const dates = sessions.map((s) => dateForPlanDay(monday, s.day));
  const { data: existing } = await viewer.supabase.from("training_sessions").select("plan_session_index,scheduled_date")
    .eq("plan_id", planId).gte("scheduled_date", dates.reduce((a, b) => a < b ? a : b)).lte("scheduled_date", dates.reduce((a, b) => a > b ? a : b));
  const taken = new Set((existing ?? []).map((e) => e.plan_session_index + "@" + e.scheduled_date));
  let created = 0;
  for (const [index, ps] of sessions.entries()) {
    if (taken.has(index + "@" + dates[index])) continue;
    const r = await insertSession(viewer, {
      title: (ps.title ?? methodTitle(ps.methodId) ?? "Training") + " · " + plan.name,
      objective: [plan.goal, ps.notes].filter(Boolean).join(" — "), methodId: ps.methodId,
      planId, planSessionIndex: index, date: dates[index], time: null, minutes: ps.minutes, startNow: false,
    });
    if (!r.ok) return { ok: false, error: r.error };
    created++;
  }
  revalidateTraining();
  return { ok: true, data: { created } };
}

/** Hip-mobility sessions planned on chosen days; days that already have one are skipped. */
export async function scheduleMobilitySessions(input: unknown): Promise<Result<{ created: number }>> {
  const viewer = await requireViewer();
  const parsed = scheduleMobilitySchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const dates = [...new Set(parsed.data.dates)].sort();
  const { data: existing } = await viewer.supabase.from("training_sessions").select("scheduled_date")
    .eq("method_id", HIP_METHOD_ID).in("scheduled_date", dates).in("status", ["PLANNED", "IN_PROGRESS", "COMPLETED"]);
  const taken = new Set((existing ?? []).map((e) => e.scheduled_date));
  const { plan, rows } = await mobilityRows(viewer, { length: parsed.data.length });
  if (rows.length === 0) return { ok: false, error: "state" };
  const fr = viewer.profile.preferred_language !== "en";
  let created = 0;
  for (const date of dates) {
    if (taken.has(date)) continue;
    const r = await insertSession(viewer, {
      title: sessionTitle(plan, fr ? "fr" : "en"), objective: "", methodId: HIP_METHOD_ID,
      date, time: null, minutes: plan.minutes, startNow: false, exercises: rows,
    });
    if (!r.ok) return { ok: false, error: r.error };
    created++;
  }
  revalidateTraining();
  return { ok: true, data: { created } };
}

/**
 * A planned hip-mobility session is prescribed again when it starts, so it
 * follows everything recorded since it was planned. The length is kept; earlier
 * accepted increases are not carried over (the climber accepts them again).
 */
async function refreshPlannedMobility(viewer: Viewer, sessionId: string, plannedMinutes: number | null): Promise<boolean> {
  const { data: current } = await viewer.supabase.from("training_session_exercises").select("id").eq("session_id", sessionId);
  const ids = (current ?? []).map((e) => e.id);
  if (ids.length) {
    const { count } = await viewer.supabase.from("training_exercise_sets").select("id", { count: "exact", head: true }).in("exercise_id", ids);
    if ((count ?? 0) > 0) return true;
  }
  const length: SessionLength = plannedMinutes !== null && plannedMinutes <= SHORT_MINUTES ? "SHORT" : "STANDARD";
  const { rows } = await mobilityRows(viewer, { length });
  if (rows.length === 0) return false;
  const { error: delError } = await viewer.supabase.from("training_session_exercises").delete().eq("session_id", sessionId);
  if (delError) return false;
  const { error } = await viewer.supabase.from("training_session_exercises")
    .insert(rows.map((e) => ({ user_id: viewer.userId, session_id: sessionId, ...e })));
  return !error;
}

async function loadOwned(viewer: Viewer, sessionId: string) {
  if (!id.safeParse(sessionId).success) return null;
  const { data } = await viewer.supabase.from("training_sessions")
    .select("id,status,started_at,paused_at,paused_seconds,completed_at,calendar_entry_id,method_id,planned_minutes")
    .eq("id", sessionId).maybeSingle();
  return data;
}

export async function startTrainingSession(sessionId: string): Promise<Result<{ id: string }>> {
  const viewer = await requireViewer();
  const s = await loadOwned(viewer, sessionId);
  if (!s) return { ok: false, error: "not_found" };
  if (s.status === "IN_PROGRESS") return { ok: true, data: { id: s.id } };
  if (!canTransition(s.status, "IN_PROGRESS")) return { ok: false, error: "state" };
  const live = await liveSessionId(viewer);
  if (live && live !== s.id) return { ok: false, error: "live", liveId: live };
  if (s.status === "PLANNED" && s.method_id === HIP_METHOD_ID && !(await refreshPlannedMobility(viewer, s.id, s.planned_minutes))) {
    return { ok: false, error: "unknown" };
  }
  const now = new Date().toISOString();
  // Resuming an interrupted session keeps its original start; the gap counts as paused.
  const update = s.status === "INTERRUPTED" && s.started_at
    ? { status: "IN_PROGRESS" as const, paused_at: s.paused_at ?? s.completed_at ?? now, completed_at: null }
    : { status: "IN_PROGRESS" as const, started_at: now, paused_at: null, paused_seconds: 0 };
  const { error } = await viewer.supabase.from("training_sessions").update(update).eq("id", s.id).eq("status", s.status);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "live", liveId: (await liveSessionId(viewer)) ?? undefined };
    return { ok: false, error: "unknown" };
  }
  revalidateTraining(s.id);
  return { ok: true, data: { id: s.id } };
}

export async function pauseTrainingSession(sessionId: string, paused: boolean): Promise<Result> {
  const viewer = await requireViewer();
  const s = await loadOwned(viewer, sessionId);
  if (!s) return { ok: false, error: "not_found" };
  if (s.status !== "IN_PROGRESS") return { ok: false, error: "state" };
  const now = new Date();
  if (paused && !s.paused_at) {
    await viewer.supabase.from("training_sessions").update({ paused_at: now.toISOString() }).eq("id", s.id).is("paused_at", null);
  } else if (!paused && s.paused_at) {
    const extra = Math.max(0, Math.round((now.getTime() - new Date(s.paused_at).getTime()) / 1000));
    await viewer.supabase.from("training_sessions")
      .update({ paused_at: null, paused_seconds: Math.min(86400, s.paused_seconds + extra) })
      .eq("id", s.id).eq("paused_at", s.paused_at);
  }
  revalidatePath("/train/sessions/" + s.id);
  return { ok: true, data: undefined };
}

export async function setCurrentExercise(sessionId: string, index: number): Promise<Result> {
  const viewer = await requireViewer();
  if (!id.safeParse(sessionId).success || !Number.isInteger(index) || index < 0 || index > 40) return { ok: false, error: "invalid" };
  const { error } = await viewer.supabase.from("training_sessions").update({ current_index: index })
    .eq("id", sessionId).eq("status", "IN_PROGRESS");
  return error ? { ok: false, error: "unknown" } : { ok: true, data: undefined };
}

async function exerciseInLiveSession(viewer: Viewer, exerciseId: string) {
  const { data: ex } = await viewer.supabase.from("training_session_exercises").select("id,session_id").eq("id", exerciseId).maybeSingle();
  if (!ex) return null;
  const { data: s } = await viewer.supabase.from("training_sessions").select("status").eq("id", ex.session_id).maybeSingle();
  return s && (s.status === "IN_PROGRESS" || s.status === "INTERRUPTED" || s.status === "COMPLETED") ? ex : null;
}

/** Save (insert or overwrite) one set. Keyed by (exercise, set number), so retries never duplicate. */
export async function saveTrainingSet(input: unknown): Promise<Result<{ id: string }>> {
  const viewer = await requireViewer();
  const parsed = saveSetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const ex = await exerciseInLiveSession(viewer, v.exerciseId);
  if (!ex) return { ok: false, error: "not_found" };
  const { data: existing } = await viewer.supabase.from("training_exercise_sets").select("id")
    .eq("exercise_id", v.exerciseId).eq("set_index", v.setIndex).maybeSingle();
  const values = {
    reps: v.reps, seconds: v.seconds, load_kg: v.loadKg, edge_mm: v.edgeMm ?? null, completed: v.completed, notes: v.notes,
    side: v.side ?? null, variant: v.variant ?? null, controlled: v.controlled ?? null, discomfort: v.discomfort ?? null,
    details: v.flags && v.flags.length ? { flags: v.flags } : null,
  };
  let result = existing
    ? await viewer.supabase.from("training_exercise_sets").update(values).eq("id", existing.id).select("id").single()
    : await viewer.supabase.from("training_exercise_sets")
      .insert({ ...values, user_id: viewer.userId, exercise_id: v.exerciseId, set_index: v.setIndex }).select("id").single();
  if (result.error?.code === "23505") {
    // A concurrent retry inserted the same set first: overwrite it instead.
    result = await viewer.supabase.from("training_exercise_sets").update(values)
      .eq("exercise_id", v.exerciseId).eq("set_index", v.setIndex).select("id").single();
  }
  if (result.error || !result.data) return { ok: false, error: "unknown" };
  revalidatePath("/train/sessions/" + ex.session_id);
  return { ok: true, data: { id: result.data.id } };
}

export async function deleteTrainingSet(exerciseId: string, setIndex: number): Promise<Result> {
  const viewer = await requireViewer();
  if (!id.safeParse(exerciseId).success || !Number.isInteger(setIndex)) return { ok: false, error: "invalid" };
  const ex = await exerciseInLiveSession(viewer, exerciseId);
  if (!ex) return { ok: false, error: "not_found" };
  const { error } = await viewer.supabase.from("training_exercise_sets").delete().eq("exercise_id", exerciseId).eq("set_index", setIndex);
  if (error) return { ok: false, error: "unknown" };
  revalidatePath("/train/sessions/" + ex.session_id);
  return { ok: true, data: undefined };
}

export async function setExerciseStatus(input: unknown): Promise<Result> {
  const viewer = await requireViewer();
  const parsed = exerciseStatusSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const ex = await exerciseInLiveSession(viewer, parsed.data.exerciseId);
  if (!ex) return { ok: false, error: "not_found" };
  const { error } = await viewer.supabase.from("training_session_exercises")
    .update({ status: parsed.data.status, rpe: parsed.data.rpe, notes: parsed.data.notes }).eq("id", ex.id);
  if (error) return { ok: false, error: "unknown" };
  revalidatePath("/train/sessions/" + ex.session_id);
  return { ok: true, data: undefined };
}

/** Finish a session. Idempotent: completing twice returns ok without changing anything. */
export async function completeTrainingSession(input: unknown): Promise<Result> {
  const viewer = await requireViewer();
  const parsed = completeSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const loaded = await loadTrainingSession(viewer.supabase, v.sessionId);
  if (!loaded) return { ok: false, error: "not_found" };
  const { session, exercises } = loaded;
  if (session.status === "COMPLETED") return { ok: true, data: undefined };
  if (!canTransition(session.status, "COMPLETED")) return { ok: false, error: "state" };
  const now = new Date();
  for (const e of exercises) {
    const settled = settledExerciseStatus(e);
    if (settled !== e.status) {
      await viewer.supabase.from("training_session_exercises").update({ status: settled }).eq("id", e.id);
    }
  }
  const pausedExtra = session.pausedAt ? Math.round((now.getTime() - new Date(session.pausedAt).getTime()) / 1000) : 0;
  const finished = { ...session, pausedAt: null, pausedSeconds: Math.min(86400, session.pausedSeconds + pausedExtra), completedAt: now.toISOString() };
  const { error } = await viewer.supabase.from("training_sessions").update({
    status: "COMPLETED", completed_at: finished.completedAt, paused_at: null, paused_seconds: finished.pausedSeconds,
    actual_minutes: Math.min(1440, Math.round(activeSeconds(finished, now) / 60)),
    rpe: v.rpe, pain: v.pain, pain_notes: v.painNotes, notes: v.notes, climbing_session_id: v.climbingSessionId,
  }).eq("id", session.id).eq("status", session.status);
  if (error) return { ok: false, error: "unknown" };
  if (session.calendarEntryId) {
    await viewer.supabase.from("calendar_entries").update({ status: "DONE" }).eq("id", session.calendarEntryId);
  }
  revalidateTraining(session.id);
  return { ok: true, data: undefined };
}

/** Skip / cancel a planned session, stop a running one early, or put a skipped one back on the plan. */
export async function changeTrainingStatus(sessionId: string, to: TrainingStatus): Promise<Result> {
  const viewer = await requireViewer();
  const s = await loadOwned(viewer, sessionId);
  if (!s) return { ok: false, error: "not_found" };
  if (!["SKIPPED", "CANCELED", "INTERRUPTED", "PLANNED"].includes(to) || !canTransition(s.status, to)) {
    return { ok: false, error: "state" };
  }
  const now = new Date().toISOString();
  const { error } = await viewer.supabase.from("training_sessions")
    .update(to === "INTERRUPTED" ? { status: to, paused_at: s.paused_at ?? now } : { status: to })
    .eq("id", s.id).eq("status", s.status);
  if (error) return { ok: false, error: "unknown" };
  if (s.calendar_entry_id && (to === "SKIPPED" || to === "PLANNED")) {
    await viewer.supabase.from("calendar_entries").update({ status: to }).eq("id", s.calendar_entry_id);
  }
  revalidateTraining(s.id);
  return { ok: true, data: undefined };
}

export async function deleteTrainingSession(sessionId: string): Promise<Result> {
  const viewer = await requireViewer();
  const s = await loadOwned(viewer, sessionId);
  if (!s) return { ok: false, error: "not_found" };
  if (s.status === "IN_PROGRESS") return { ok: false, error: "state" };
  const { error } = await viewer.supabase.from("training_sessions").delete().eq("id", s.id);
  if (error) return { ok: false, error: "unknown" };
  revalidateTraining();
  return { ok: true, data: undefined };
}

/**
 * Record a training session already done (e.g. strength work): type, date,
 * total time and a free description — no exercise-by-exercise detail required.
 */
export async function logPastTrainingSession(input: unknown): Promise<Result<{ id: string }>> {
  const viewer = await requireViewer();
  const parsed = pastTrainingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const start = zonedToUtc(v.date, v.time);
  if (Number.isNaN(start.getTime()) || start.getTime() > Date.now()) return { ok: false, error: "invalid" };
  const fr = viewer.profile.preferred_language !== "en";
  const { data, error } = await viewer.supabase.from("training_sessions").insert({
    user_id: viewer.userId,
    title: v.title || methodTitle(v.methodId) || (fr ? "Séance d’entraînement" : "Training session"),
    method_id: v.methodId, status: "COMPLETED",
    scheduled_date: v.date, scheduled_time: v.time, planned_minutes: v.minutes, actual_minutes: v.minutes,
    started_at: start.toISOString(), completed_at: new Date(start.getTime() + v.minutes * 60_000).toISOString(),
    rpe: v.rpe, notes: v.notes,
  }).select("id").single();
  if (error || !data) return { ok: false, error: "unknown" };
  revalidateTraining(data.id);
  return { ok: true, data: { id: data.id } };
}

/** Edit a session that is not running: title, date/time, total time, effort, pain, description. */
export async function updateTrainingSession(input: unknown): Promise<Result> {
  const viewer = await requireViewer();
  const parsed = editTrainingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const s = await loadOwned(viewer, v.sessionId);
  if (!s) return { ok: false, error: "not_found" };
  if (s.status === "IN_PROGRESS") return { ok: false, error: "state" };
  const start = zonedToUtc(v.date, v.time);
  if (Number.isNaN(start.getTime())) return { ok: false, error: "invalid" };
  const done = s.status === "COMPLETED" || s.status === "INTERRUPTED";
  if (done && start.getTime() > Date.now()) return { ok: false, error: "invalid" };
  const { error } = await viewer.supabase.from("training_sessions").update({
    title: v.title, scheduled_date: v.date, scheduled_time: v.time, rpe: v.rpe, pain: v.pain, notes: v.notes,
    ...(done
      ? { actual_minutes: v.minutes, started_at: start.toISOString(), paused_seconds: 0, paused_at: null,
          completed_at: new Date(start.getTime() + v.minutes * 60_000).toISOString() }
      : { planned_minutes: v.minutes }),
  }).eq("id", s.id);
  if (error) return { ok: false, error: "unknown" };
  revalidateTraining(s.id);
  return { ok: true, data: undefined };
}
