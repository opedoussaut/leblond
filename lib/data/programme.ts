import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { parseContext } from "@/lib/training/assessment-protocol";
import { dayCheckInputSchema } from "@/lib/training/day-check";
import { injuriesSchema } from "@/lib/training/health";
import { PLAN_COLUMNS, phaseAt, phasesOf, planFromRow } from "@/lib/training/plans";
import {
  DAY_OUTCOMES, REPLAN_WINDOW_DAYS, addDays, daysBetween, programmeView, replanSignal,
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
 * The programme in progress (the one the climber follows, or else the latest
 * full assessment's), today's scheduled session and the recent daily check-ins.
 * RLS scopes every query to the viewer. Missing tables or columns (migration not
 * applied yet) degrade to the previous behaviour, then to "no programme".
 */
export async function loadProgramme(supabase: ServerSupabase, today = localDate_(new Date())): Promise<ProgrammeState> {
  const [{ data: assessmentRow }, { data: scheduledRows }, { data: checkRows }, followed] = await Promise.all([
    supabase.from("training_assessments")
      .select("id, method_id, horizon_weeks, sessions_per_week, goal, context, created_at")
      .order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("training_sessions").select("id, title, method_id, scheduled_date, planned_minutes")
      .eq("status", "PLANNED").gte("scheduled_date", today).order("scheduled_date").limit(10),
    supabase.from("training_day_checks")
      .select("check_date, sleep, fatigue, soreness, pain, minutes_available, place, outcome, method_id, recommended_minutes, reasons")
      .gte("check_date", addDays(today, -(REPLAN_WINDOW_DAYS + 4))).order("check_date", { ascending: false }).limit(20),
    supabase.from("training_plans").select(`${PLAN_COLUMNS}, assessment_id, followed_since`)
      .not("followed_since", "is", null).limit(1).maybeSingle(),
  ]);

  const scheduled: ScheduledSession[] = (scheduledRows ?? []).flatMap((s) => s.scheduled_date
    ? [{ id: s.id, title: s.title, methodId: s.method_id, date: s.scheduled_date, minutes: s.planned_minutes }] : []);
  const recentChecks = (checkRows ?? []).flatMap((r) => { const c = toCheck(r); return c ? [c] : []; });

  // Week n of a programme in phases uses that phase's weekly template.
  const planAt = (row: { id: string; name: string }, parsed: NonNullable<ReturnType<typeof planFromRow>>, startDate: string): ProgrammePlan => {
    const week = Math.floor(Math.max(0, daysBetween(startDate, today)) / 7) + 1;
    return { id: row.id, name: row.name, sessions: phaseAt(phasesOf(parsed), week).phase.sessions };
  };

  let view: ProgrammeView | null = null;
  const followedRow = followed.error ? null : followed.data;
  const followedPlan = followedRow ? planFromRow(followedRow) : null;
  if (followedRow?.followed_since && followedPlan) {
    // The followed programme sets the weeks; its own assessment (if any) adds the context.
    const linked = followedRow.assessment_id && assessmentRow?.id === followedRow.assessment_id ? assessmentRow
      : followedRow.assessment_id
        ? (await supabase.from("training_assessments").select("id, method_id, horizon_weeks, sessions_per_week, goal, context, created_at")
          .eq("id", followedRow.assessment_id).maybeSingle()).data
        : null;
    const startDate = followedRow.followed_since;
    const phases = phasesOf(followedPlan);
    const weeks = Math.max(1, followedPlan.weeks);
    const plan = planAt(followedRow, followedPlan, startDate);
    const firstMethod = plan.sessions.find((s) => s.methodId)?.methodId ?? phases[0]?.sessions[0]?.methodId ?? "";
    const assessment: ProgrammeAssessment = {
      id: linked?.id ?? null, methodId: linked?.method_id ?? firstMethod, horizonWeeks: weeks,
      sessionsPerWeek: linked?.sessions_per_week ?? Math.max(1, plan.sessions.length), goal: followedPlan.goal || linked?.goal || "",
      startDate, context: linked ? parseContext(linked.context) : null,
    };
    view = programmeView({ assessment, plan, scheduled, today });
  } else if (assessmentRow) {
    // Before the followed-programme migration: the latest assessment's programme. After it, only
    // an assessment whose weekly template was never saved shows here (to offer creating it);
    // a programme the climber stopped following stays stopped.
    const { data: planRow } = await supabase.from("training_plans").select(PLAN_COLUMNS)
      .eq("assessment_id", assessmentRow.id).order("updated_at", { ascending: false }).limit(1).maybeSingle();
    if (!followed.error && planRow) return { view: null, ...rest(scheduled, recentChecks) };
    const parsedPlan = planRow ? planFromRow(planRow) : null;
    const startDate = localDate_(new Date(assessmentRow.created_at));
    const plan = planRow && parsedPlan ? planAt(planRow, parsedPlan, startDate) : null;
    const assessment: ProgrammeAssessment = {
      id: assessmentRow.id, methodId: assessmentRow.method_id, horizonWeeks: assessmentRow.horizon_weeks,
      sessionsPerWeek: assessmentRow.sessions_per_week, goal: assessmentRow.goal,
      startDate, context: parseContext(assessmentRow.context),
    };
    view = programmeView({ assessment, plan, scheduled, today });
  }

  return { view, ...rest(scheduled, recentChecks) };

  function rest(scheduledList: ScheduledSession[], checks: SavedDayCheck[]) {
    return {
      scheduledToday: scheduledList.find((s) => s.date === today) ?? null,
      todayCheck: checks.find((c) => c.date === today) ?? null,
      recentChecks: checks,
      replan: replanSignal(checks, today),
    };
  }
}

/**
 * Sets the followed programme (null: none). The previous one is released first,
 * since a climber follows one programme at a time (unique index).
 */
export async function setFollowedPlan(supabase: ServerSupabase, userId: string, planId: string | null, since: string): Promise<boolean> {
  const { error: clearError } = await supabase.from("training_plans").update({ followed_since: null })
    .eq("user_id", userId).not("followed_since", "is", null);
  if (clearError) return false;
  if (!planId) return true;
  const { data, error } = await supabase.from("training_plans").update({ followed_since: since })
    .eq("id", planId).eq("user_id", userId).select("id");
  return !error && (data?.length ?? 0) === 1;
}
