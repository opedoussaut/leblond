"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { setFollowedPlan } from "@/lib/data/programme";
import { getI18n } from "@/lib/i18n/server";
import { catalogueProgramme, cataloguePlan } from "@/lib/training/programme-catalogue";
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

/**
 * Follows a programme of the catalogue from today: it is copied into the climber's own
 * programmes (in their language), or the copy made earlier is reused, then followed.
 */
export async function followCatalogueProgramme(catalogueId: string, today: string): Promise<{ ok: true; id: string } | { ok: false; error: "invalid" | "limit" | "unknown" }> {
  const viewer = await requireViewer();
  const entry = catalogueProgramme(catalogueId);
  if (!entry || !z.iso.date().safeParse(today).success) return { ok: false, error: "invalid" };
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const plan = cataloguePlan(entry, locale);
  const { data: existing, error: findError } = await viewer.supabase.from("training_plans").select("id")
    .eq("user_id", viewer.userId).eq("name", plan.name).order("updated_at", { ascending: false }).limit(1).maybeSingle();
  if (findError) return { ok: false, error: "unknown" };
  let id = existing?.id;
  if (!id) {
    const saved = await saveTrainingPlan(plan);
    if (!saved.ok) return saved;
    id = saved.id;
  }
  const ok = await setFollowedPlan(viewer.supabase, viewer.userId, id, today);
  revalidatePath("/programmes");
  revalidatePath("/home");
  return ok ? { ok: true, id } : { ok: false, error: "unknown" };
}
