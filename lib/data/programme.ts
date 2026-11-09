import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { parseContext } from "@/lib/training/assessment-protocol";
import { dayCheckInputSchema } from "@/lib/training/day-check";
import { injuriesSchema } from "@/lib/training/health";
import { trainingPlanSchema } from "@/lib/training/plans";
import {
  DAY_OUTCOMES, REPLAN_WINDOW_DAYS, addDays, programmeView, replanSignal,
  type DayCheckRecord, type DayOutcome, type ProgrammeAssessment, type ProgrammePlan, type ProgrammeView, type ScheduledSession,
} from "@/lib/training/programme";
import { localDate_ } from "@/lib/training/sessions";

export type SavedDayCheck = DayCheckRecord & {
  input: ReturnType<typeof dayCheckInputSchema.parse>;
  methodId: string | null;
  recommendedMinutes: number;
};

export type ProgrammeState = {
  view: ProgrammeView | null;
  scheduledToday: ScheduledSession | null;
  todayCheck: SavedDayCheck | null;
  recentChecks: SavedDayCheck[];
  replan: ReturnType<typeof replanSignal>;
};

function toCheck(r: {
  check_date: string; sleep: number; fatigue: number; soreness: number; pain: unknown; minutes_available: number;
  place: string; outcome: string; method_id: string | null; recommended_minutes: number; reasons: unknown;
}): SavedDayCheck | null {
  const pain = injuriesSchema.safeParse(r.pain);
  const input = dayCheckInputSchema.safeParse({
    sleep: r.sleep, fatigue: r.fatigue, soreness: r.soreness, pain: pain.success ? pain.data : [],
    minutes: r.minutes_available, place: r.place,
  });
  if (!input.success || !(DAY_OUTCOMES as readonly string[]).includes(r.outcome)) return null;
  const reasons = Array.isArray(r.reasons) ? r.reasons.filter((x): x is string => typeof x === "string") : [];
  return {
    date: r.check_date, outcome: r.outcome as DayOutcome, reasons, pain: input.data.pain,
    input: input.data, methodId: r.method_id, recommendedMinutes: r.recommended_minutes,
  };
}

/**
 * The programme in progress (latest full assessment + its weekly template),
 * today's scheduled session and the recent daily check-ins. RLS scopes every
 * query to the viewer. Missing tables (migration not applied yet) degrade to "no programme".
 */
export async function loadProgramme(supabase: ServerSupabase, today = localDate_(new Date())): Promise<ProgrammeState> {
  const [{ data: assessmentRow }, { data: scheduledRows }, { data: checkRows }] = await Promise.all([
    supabase.from("training_assessments")
      .select("id, method_id, horizon_weeks, sessions_per_week, goal, context, created_at")
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("training_sessions").select("id, title, method_id, scheduled_date, planned_minutes")
      .eq("status", "PLANNED").gte("scheduled_date", today).order("scheduled_date").limit(10),
    supabase.from("training_day_checks")
      .select("check_date, sleep, fatigue, soreness, pain, minutes_available, place, outcome, method_id, recommended_minutes, reasons")
      .gte("check_date", addDays(today, -(REPLAN_WINDOW_DAYS + 4))).order("check_date", { ascending: false }).limit(20),
  ]);

  const scheduled: ScheduledSession[] = (scheduledRows ?? []).flatMap((s) => s.scheduled_date
    ? [{ id: s.id, title: s.title, methodId: s.method_id, date: s.scheduled_date, minutes: s.planned_minutes }] : []);
  const recentChecks = (checkRows ?? []).flatMap((r) => { const c = toCheck(r); return c ? [c] : []; });

  let view: ProgrammeView | null = null;
  if (assessmentRow) {
    const { data: planRow } = await supabase.from("training_plans").select("id, name, goal, weeks, sessions")
      .eq("assessment_id", assessmentRow.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    const parsedPlan = planRow ? trainingPlanSchema.safeParse({ name: planRow.name, goal: planRow.goal, weeks: planRow.weeks, sessions: planRow.sessions }) : null;
    const plan: ProgrammePlan | null = planRow && parsedPlan?.success ? { id: planRow.id, name: planRow.name, sessions: parsedPlan.data.sessions } : null;
    const assessment: ProgrammeAssessment = {
      id: assessmentRow.id, methodId: assessmentRow.method_id, horizonWeeks: assessmentRow.horizon_weeks,
      sessionsPerWeek: assessmentRow.sessions_per_week, goal: assessmentRow.goal,
      startDate: localDate_(new Date(assessmentRow.created_at)), context: parseContext(assessmentRow.context),
    };
    view = programmeView({ assessment, plan, scheduled, today });
  }

  return {
    view,
    scheduledToday: scheduled.find((s) => s.date === today) ?? null,
    todayCheck: recentChecks.find((c) => c.date === today) ?? null,
    recentChecks,
    replan: replanSignal(recentChecks, today),
  };
}
