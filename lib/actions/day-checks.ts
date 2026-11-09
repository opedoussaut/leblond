"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth/viewer";
import { loadProgramme } from "@/lib/data/programme";
import { dayCheckInputSchema, recommendToday, type DayRecommendation } from "@/lib/training/day-check";
import { localDate_ } from "@/lib/training/sessions";

type Result = { ok: true; recommendation: DayRecommendation } | { ok: false; error: "invalid" | "unknown" };

/**
 * Records today's check-in and returns today's ideal session. The
 * recommendation is computed here from the programme in progress (never
 * trusted from the client) and stored as a snapshot. Redoing the check-in the
 * same day replaces the answers.
 */
export async function saveDayCheck(input: unknown): Promise<Result> {
  const viewer = await requireViewer();
  const parsed = dayCheckInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const today = localDate_(new Date());
  const state = await loadProgramme(viewer.supabase, today);
  const recommendation = recommendToday(parsed.data, {
    today,
    discipline: state.view?.discipline ?? viewer.profile.target_discipline,
    plan: state.view && !state.view.finished ? state.view.plan?.sessions ?? null : null,
    scheduledToday: state.scheduledToday,
  });
  const answers = {
    sleep: parsed.data.sleep, fatigue: parsed.data.fatigue, soreness: parsed.data.soreness, pain: parsed.data.pain,
    minutes_available: parsed.data.minutes, place: parsed.data.place,
    outcome: recommendation.outcome, method_id: recommendation.methodId,
    recommended_minutes: recommendation.minutes, reasons: recommendation.reasons,
  };
  // Separate UPDATE and INSERT: owner, day and programme link are not updatable columns.
  const { data: existing, error: lookupError } = await viewer.supabase.from("training_day_checks")
    .select("id").eq("check_date", today).maybeSingle();
  if (lookupError) return { ok: false, error: "unknown" };
  const { error } = existing
    ? await viewer.supabase.from("training_day_checks").update(answers).eq("id", existing.id)
    : await viewer.supabase.from("training_day_checks").insert({
      ...answers, user_id: viewer.userId, check_date: today, assessment_id: state.view?.assessmentId ?? null,
    });
  if (error) return { ok: false, error: "unknown" };
  revalidatePath("/train");
  revalidatePath("/train/today");
  return { ok: true, recommendation };
}
