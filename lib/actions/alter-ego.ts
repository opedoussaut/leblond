"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PROGRESSION_V1, pactTransition } from "@/lib/analytics/alter-ego";
import { requireViewer } from "@/lib/auth/viewer";
import { changePactSchema, pactFromRow, signPactSchema } from "@/lib/training/alter-ego";
import { planSessionSchema } from "@/lib/training/plans";
import { localDate_ } from "@/lib/training/sessions";

type Result = { ok: true; id: string } | { ok: false; error: "invalid" | "grades" | "open_pact" | "not_found" | "unknown" };

function revalidatePact() {
  revalidatePath("/train");
  revalidatePath("/train/alter-ego");
}

/** Signs a pact from one of the climber's plans. The plan is copied, so editing it later changes nothing. */
export async function signPact(input: unknown): Promise<Result> {
  const viewer = await requireViewer();
  const parsed = signPactSchema.safeParse(input);
  if (!parsed.success) {
    // The two grade rules apply to the whole form, every other rule to one field.
    return { ok: false, error: parsed.error.issues.some((i) => i.path.length === 0) ? "grades" : "invalid" };
  }
  const v = parsed.data;
  const { data: plan } = await viewer.supabase.from("training_plans").select("id, name, sessions").eq("id", v.planId).maybeSingle();
  if (!plan) return { ok: false, error: "not_found" };
  const sessions = z.array(planSessionSchema).min(1).max(14).safeParse(plan.sessions);
  if (!sessions.success) return { ok: false, error: "invalid" };
  const { data, error } = await viewer.supabase.from("alter_ego_pacts").insert({
    user_id: viewer.userId, display_name: v.displayName, plan_id: plan.id, plan_name: plan.name,
    plan_snapshot: sessions.data, progression: PROGRESSION_V1, start_date: v.startDate, horizon_weeks: v.horizonWeeks,
    start_boulder_grade: v.startBoulderGrade, target_boulder_grade: v.targetBoulderGrade,
    start_route_grade: v.startRouteGrade, target_route_grade: v.targetRouteGrade,
  }).select("id").single();
  if (error?.code === "23505") return { ok: false, error: "open_pact" };
  if (error || !data) return { ok: false, error: "unknown" };
  revalidatePact();
  return { ok: true, id: data.id };
}

export async function changePact(input: unknown): Promise<{ ok: boolean }> {
  const viewer = await requireViewer();
  const parsed = changePactSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { id, action } = parsed.data;
  const { data: row } = await viewer.supabase.from("alter_ego_pacts").select("*").eq("id", id).maybeSingle();
  const pact = row ? pactFromRow(row) : null;
  if (!pact) return { ok: false };
  const update = pactTransition(pact, action, localDate_(new Date()));
  if (!update) return { ok: false };
  const { error } = await viewer.supabase.from("alter_ego_pacts").update(update).eq("id", id).eq("user_id", viewer.userId);
  if (error) return { ok: false };
  revalidatePact();
  return { ok: true };
}
