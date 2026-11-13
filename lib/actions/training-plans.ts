"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { setFollowedPlan } from "@/lib/data/programme";
import { planRow, trainingPlanSchema } from "@/lib/training/plans";

type PlanResult = { ok: true; id: string } | { ok: false; error: "invalid" | "limit" | "unknown" };

export async function saveTrainingPlan(input: unknown): Promise<PlanResult> {
  const viewer = await requireViewer();
  const parsed = trainingPlanSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };

  const { id } = parsed.data;
  const row = planRow(parsed.data);
  if (!id) {
    const { count, error: countError } = await viewer.supabase
      .from("training_plans").select("id", { count: "exact", head: true });
    if (countError) return { ok: false, error: "unknown" };
    if ((count ?? 0) >= 20) return { ok: false, error: "limit" };
  }

  const query = id
    ? viewer.supabase
      .from("training_plans")
      .update(row)
      .eq("id", id).eq("user_id", viewer.userId).select("id").single()
    : viewer.supabase
      .from("training_plans")
      .insert({ user_id: viewer.userId, ...row })
      .select("id").single();
  const { data, error } = await query;
  if (error || !data) return { ok: false, error: "unknown" };
  revalidatePath("/programmes");
  return { ok: true, id: data.id };
}

export async function deleteTrainingPlan(id: string): Promise<{ ok: boolean }> {
  const viewer = await requireViewer();
  if (!z.guid().safeParse(id).success) return { ok: false };
  const { error } = await viewer.supabase
    .from("training_plans")
    .delete()
    .eq("id", id).eq("user_id", viewer.userId);
  if (error) return { ok: false };
  revalidatePath("/programmes");
  return { ok: true };
}

/**
 * Makes a programme the one in progress, from today (week 1), or stops
 * following any programme (`planId` null). One followed programme at a time;
 * hip mobility is separate and keeps running alongside.
 */
export async function followTrainingPlan(planId: string | null, today: string): Promise<{ ok: boolean }> {
  const viewer = await requireViewer();
  if ((planId !== null && !z.guid().safeParse(planId).success) || !z.iso.date().safeParse(today).success) return { ok: false };
  const ok = await setFollowedPlan(viewer.supabase, viewer.userId, planId, today);
  revalidatePath("/programmes");
  revalidatePath("/home");
  return { ok };
}
