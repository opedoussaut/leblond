"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer, type Viewer } from "@/lib/auth/viewer";
import {
  MAX_MOBILITY_ASSESSMENTS, MOBILITY_PROTOCOL_VERSION, STAGE_RULES_VERSION, classifyStage, mobilityAssessmentInputSchema,
} from "@/lib/training/hip-mobility/assessment";
import { HIP_PROGRAMME, type Level } from "@/lib/training/hip-mobility/content";
import { localDate_ } from "@/lib/training/sessions";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: "invalid" | "not_found" | "limit" | "unknown" };

const settingsSchema = z.object({
  sessionsPerWeek: z.number().int().min(1).max(7),
  sessionLength: z.enum(["SHORT", "STANDARD"]),
  status: z.enum(["ACTIVE", "PAUSED"]).optional(),
}).strict();

function revalidateMobility() {
  revalidatePath("/train", "layout");
  revalidatePath("/follow-up", "layout");
  revalidatePath("/patrick");
  revalidatePath("/home");
}

/** Starts the programme for the viewer (idempotent: an existing enrolment is reactivated, its level kept). */
async function ensureEnrollment(viewer: Viewer, settings?: z.infer<typeof settingsSchema>): Promise<boolean> {
  const { data: existing } = await viewer.supabase.from("mobility_enrollments").select("id,status")
    .eq("programme", HIP_PROGRAMME).maybeSingle();
  if (existing) {
    if (!settings && existing.status === "ACTIVE") return true;
    const { error } = await viewer.supabase.from("mobility_enrollments").update({
      ...(settings ? { sessions_per_week: settings.sessionsPerWeek, session_length: settings.sessionLength } : {}),
      status: settings?.status ?? "ACTIVE",
    }).eq("id", existing.id);
    return !error;
  }
  const { error } = await viewer.supabase.from("mobility_enrollments").insert({
    user_id: viewer.userId, programme: HIP_PROGRAMME, started_on: localDate_(new Date()),
    ...(settings ? { sessions_per_week: settings.sessionsPerWeek, session_length: settings.sessionLength } : {}),
  });
  // A concurrent enrolment (double tap) already created it.
  return !error || error.code === "23505";
}

/** Join the hip-mobility programme (any active climber; nothing else required). */
export async function enrollInMobility(input: unknown): Promise<Result> {
  const viewer = await requireViewer();
  const parsed = settingsSchema.safeParse(input ?? { sessionsPerWeek: 3, sessionLength: "STANDARD" });
  if (!parsed.success) return { ok: false, error: "invalid" };
  if (!(await ensureEnrollment(viewer, { ...parsed.data, status: "ACTIVE" }))) return { ok: false, error: "unknown" };
  revalidateMobility();
  return { ok: true, data: undefined };
}

/** Change sessions per week, the default session length, or pause / resume. */
export async function updateMobilitySettings(input: unknown): Promise<Result> {
  const viewer = await requireViewer();
  const parsed = settingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { data, error } = await viewer.supabase.from("mobility_enrollments").update({
    sessions_per_week: parsed.data.sessionsPerWeek, session_length: parsed.data.sessionLength,
    ...(parsed.data.status ? { status: parsed.data.status } : {}),
  }).eq("programme", HIP_PROGRAMME).select("id");
  if (error) return { ok: false, error: "unknown" };
  if (!data?.length) return { ok: false, error: "not_found" };
  revalidateMobility();
  return { ok: true, data: undefined };
}

/**
 * Save a beginner assessment. The stage is computed here (versioned rules), never
 * sent by the client; it is a label for the climber and never changes the
 * working level by itself.
 */
export async function saveMobilityAssessment(input: unknown): Promise<Result<{ id: string; stage: Level }>> {
  const viewer = await requireViewer();
  const parsed = mobilityAssessmentInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  if (v.assessedOn > localDate_(new Date())) return { ok: false, error: "invalid" };
  const { count } = await viewer.supabase.from("mobility_assessments").select("id", { count: "exact", head: true });
  if ((count ?? 0) >= MAX_MOBILITY_ASSESSMENTS) return { ok: false, error: "limit" };
  if (!(await ensureEnrollment(viewer))) return { ok: false, error: "unknown" };
  const { stage } = classifyStage(v.results);
  const { data, error } = await viewer.supabase.from("mobility_assessments").insert({
    user_id: viewer.userId, programme: HIP_PROGRAMME, assessed_on: v.assessedOn,
    protocol_version: MOBILITY_PROTOCOL_VERSION, conditions: v.conditions, results: v.results,
    stage, rules_version: STAGE_RULES_VERSION, notes: v.notes,
  }).select("id").single();
  if (error || !data) return { ok: false, error: "unknown" };
  revalidateMobility();
  return { ok: true, data: { id: data.id, stage } };
}

export async function deleteMobilityAssessment(assessmentId: string): Promise<Result> {
  const viewer = await requireViewer();
  if (!z.guid().safeParse(assessmentId).success) return { ok: false, error: "invalid" };
  const { data, error } = await viewer.supabase.from("mobility_assessments").delete().eq("id", assessmentId).select("id");
  if (error) return { ok: false, error: "unknown" };
  if (!data?.length) return { ok: false, error: "not_found" };
  revalidateMobility();
  return { ok: true, data: undefined };
}
