"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { assessmentInputSchema, checkinInputSchema, elapsedWeeks } from "@/lib/training/assessment";

type Result = { ok: true; id: string } | { ok: false; error: "invalid" | "limit" | "not_found" | "unknown" };

export async function createTrainingAssessment(input: unknown): Promise<Result> {
  const viewer = await requireViewer();
  const parsed = assessmentInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { count, error: countError } = await viewer.supabase.from("training_assessments")
    .select("id", { count: "exact", head: true });
  if (countError) return { ok: false, error: "unknown" };
  if ((count ?? 0) >= 12) return { ok: false, error: "limit" };

  const { methodId, ratings, horizonWeeks, sessionsPerWeek, goal } = parsed.data;
  const { data, error } = await viewer.supabase.from("training_assessments")
    .insert({ user_id: viewer.userId, method_id: methodId, ratings, horizon_weeks: horizonWeeks, sessions_per_week: sessionsPerWeek, goal })
    .select("id").single();
  if (error || !data) return { ok: false, error: "unknown" };
  revalidatePath("/training-assessment");
  return { ok: true, id: data.id };
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
  revalidatePath("/training-assessment");
  return { ok: true };
}
