"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { journeyDictionary } from "@/lib/i18n/training-journey";
import { MAX_ASSESSMENTS, assessmentInputSchema, checkinInputSchema, elapsedWeeks } from "@/lib/training/assessment";
import { PROTOCOL_VERSION, parseContext } from "@/lib/training/assessment-protocol";
import { healthFromContext } from "@/lib/training/health";
import type { PlanSession } from "@/lib/training/plans";
import { availabilityOf, proposeProgramme } from "@/lib/training/programme";
import type { Viewer } from "@/lib/auth/viewer";
import { setFollowedPlan } from "@/lib/data/programme";
import { localDate_ } from "@/lib/training/sessions";

type Result = { ok: true; id: string } | { ok: false; error: "invalid" | "limit" | "not_found" | "unknown" };
/** `planId` is null when the weekly template could not be saved (e.g. the 20-plan limit). */
type AssessmentResult = { ok: true; id: string; planId: string | null } | { ok: false; error: "invalid" | "limit" | "not_found" | "unknown" };

const MAX_PLANS = 20;

/** Saves the weekly template of a programme as a private plan linked to its assessment. */
async function insertProgrammePlan(viewer: Viewer, assessmentId: string, goal: string, weeks: number, sessions: PlanSession[]): Promise<string | null> {
  const { count, error: countError } = await viewer.supabase.from("training_plans").select("id", { count: "exact", head: true });
  if (countError || (count ?? 0) >= MAX_PLANS) return null;
  const locale = viewer.profile.preferred_language === "en" ? "en" : "fr";
  const name = fmt(journeyDictionary(locale).programme.planName, { date: formatDate(new Date(), locale, { day: "numeric", month: "long", year: "numeric" }) });
  const { data, error } = await viewer.supabase.from("training_plans")
    .insert({ user_id: viewer.userId, name, goal, weeks: Math.min(52, weeks), sessions, assessment_id: assessmentId })
    .select("id").single();
  if (error || !data) return null;
  // A new full assessment's programme becomes the one in progress, as before.
  await setFollowedPlan(viewer.supabase, viewer.userId, data.id, localDate_(new Date()));
  return data.id;
}

export async function createTrainingAssessment(input: unknown): Promise<AssessmentResult> {
  const viewer = await requireViewer();
  const parsed = assessmentInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { count, error: countError } = await viewer.supabase.from("training_assessments")
    .select("id", { count: "exact", head: true });
  if (countError) return { ok: false, error: "unknown" };
  if ((count ?? 0) >= MAX_ASSESSMENTS) return { ok: false, error: "limit" };

  const { methodId, ratings, horizonWeeks, sessionsPerWeek, goal, kind, measurements, context, programme } = parsed.data;
  const structured = kind !== undefined;
  const { data, error } = await viewer.supabase.from("training_assessments")
    .insert({
      user_id: viewer.userId, method_id: methodId, ratings, horizon_weeks: horizonWeeks, sessions_per_week: sessionsPerWeek, goal,
      ...(structured ? {
        kind: (measurements?.length ?? 0) > 0 ? "STRUCTURED" as const : "BASIC" as const,
        protocol_version: PROTOCOL_VERSION, measurements: measurements ?? [], context: context ?? {},
      } : {}),
    })
    .select("id").single();
  if (error || !data) return { ok: false, error: "unknown" };
  const planId = programme ? await insertProgrammePlan(viewer, data.id, goal, horizonWeeks, programme.sessions) : null;
  revalidateAssessments();
  return { ok: true, id: data.id, planId };
}

/**
 * Creates the weekly template of an assessment that has none (assessments made
 * before programmes were linked), from what that assessment recorded.
 */
export async function createProgrammeForAssessment(assessmentId: unknown): Promise<Result> {
  const viewer = await requireViewer();
  if (!z.guid().safeParse(assessmentId).success) return { ok: false, error: "invalid" };
  const { data: a, error } = await viewer.supabase.from("training_assessments")
    .select("id, method_id, horizon_weeks, sessions_per_week, goal, context")
    .eq("id", assessmentId as string).maybeSingle();
  if (error || !a) return { ok: false, error: "not_found" };
  const { data: existing } = await viewer.supabase.from("training_plans").select("id").eq("assessment_id", a.id).limit(1).maybeSingle();
  if (existing) return { ok: true, id: existing.id };
  const context = parseContext(a.context);
  const sessions = proposeProgramme({
    methodId: a.method_id, discipline: context?.discipline ?? viewer.profile.target_discipline,
    availability: availabilityOf({ sessionsPerWeek: a.sessions_per_week, context }),
    health: healthFromContext(context), experienceMonths: context?.experienceMonths ?? 24,
    locale: viewer.profile.preferred_language === "en" ? "en" : "fr",
  });
  if (!sessions.length) return { ok: false, error: "invalid" };
  const planId = await insertProgrammePlan(viewer, a.id, a.goal, a.horizon_weeks, sessions);
  if (!planId) return { ok: false, error: "limit" };
  revalidateAssessments();
  return { ok: true, id: planId };
}

export async function saveTrainingCheckin(input: unknown): Promise<Result> {
  const viewer = await requireViewer();
  const parsed = checkinInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { assessmentId, week, ratings, notes } = parsed.data;
  const { data: assessment, error: lookupError } = await viewer.supabase.from("training_assessments")
    .select("id, created_at, horizon_weeks")
    .eq("id", assessmentId).eq("user_id", viewer.userId).maybeSingle();
  if (lookupError || !assessment) return { ok: false, error: "not_found" };
  if (week > assessment.horizon_weeks || week > elapsedWeeks(assessment.created_at, new Date())) {
    return { ok: false, error: "invalid" };
  }
  // Separate INSERT and UPDATE so the RLS table can deny identity-column
  // changes while allowing climbers to correct only their own ratings/notes.
  const { data: existing, error: lookupCheckinError } = await viewer.supabase
    .from("training_checkins").select("id")
    .eq("assessment_id", assessmentId).eq("week", week).maybeSingle();
  if (lookupCheckinError) return { ok: false, error: "unknown" };
  const { data, error } = existing
    ? await viewer.supabase.from("training_checkins")
        .update({ ratings, notes }).eq("id", existing.id).eq("user_id", viewer.userId)
        .select("id").single()
    : await viewer.supabase.from("training_checkins")
        .insert({ user_id: viewer.userId, assessment_id: assessmentId, week, ratings, notes })
        .select("id").single();
  if (error || !data) return { ok: false, error: "unknown" };
  revalidatePath("/training-assessment");
  return { ok: true, id: data.id };
}

export async function deleteTrainingAssessment(id: string): Promise<{ ok: boolean }> {
  const viewer = await requireViewer();
  if (!z.guid().safeParse(id).success) return { ok: false };
  const { error } = await viewer.supabase.from("training_assessments")
    .delete().eq("id", id).eq("user_id", viewer.userId);
  if (error) return { ok: false };
  revalidateAssessments();
  return { ok: true };
}

/** Clears the climber's assessments and, by cascade, their check-ins. The climbing journal is untouched. */
export async function resetTrainingAssessments(confirmation: unknown): Promise<{ ok: boolean }> {
  const viewer = await requireViewer();
  if (confirmation !== "RESET") return { ok: false };
  const { error } = await viewer.supabase.from("training_assessments")
    .delete().eq("user_id", viewer.userId);
  if (error) return { ok: false };
  revalidateAssessments();
  return { ok: true };
}

function revalidateAssessments() {
  revalidatePath("/training-assessment");
  revalidatePath("/train/assess");
  revalidatePath("/programmes");
  revalidatePath("/train/today");
  revalidatePath("/follow-up");
}
