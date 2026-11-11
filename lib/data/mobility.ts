import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import type { AssessmentPoint } from "@/lib/analytics/mobility";
import { parseContext } from "@/lib/training/assessment-protocol";
import { parseStoredConditions, parseStoredResults, type MobilityResult } from "@/lib/training/hip-mobility/assessment";
import { HIP_METHOD_ID, HIP_PROGRAMME, LEVELS, type Level, type SessionLength } from "@/lib/training/hip-mobility/content";
import { planSession, type MobilitySessionRecord, type SessionPlan } from "@/lib/training/hip-mobility/prescription";
import { mobilityRecord, sessionDate } from "@/lib/training/hip-mobility/records";
import { NO_HEALTH_ISSUE, healthFromContext, injuriesSchema, type Health } from "@/lib/training/health";
import { localDate_, type TrainingExercise, type TrainingSet } from "@/lib/training/sessions";
import type { ExerciseSnapshot } from "@/lib/training/session-templates";
import { SESSION_COLUMNS, flagsOf, toSession } from "@/lib/data/training-sessions";

export type MobilityEnrollment = {
  id: string;
  startedOn: string;
  workingLevel: Level;
  levelChangedAt: string;
  sessionsPerWeek: number;
  sessionLength: SessionLength;
  status: "ACTIVE" | "PAUSED";
};

export type UpcomingMobilitySession = { id: string; date: string | null; title: string; status: "PLANNED" | "IN_PROGRESS" | "INTERRUPTED" };

export type MobilityState = {
  enrollment: MobilityEnrollment | null;
  /** Newest first. */
  assessments: AssessmentPoint[];
  /** Newest first: the latest ones with their exercises, older ones counted only (no exercises). */
  records: MobilitySessionRecord[];
  /** Planned or unfinished hip-mobility sessions, soonest first. */
  upcoming: UpcomingMobilitySession[];
  /** Body areas from today's check-in, else from the latest full assessment. */
  health: Health;
  today: string;
};

/** Sessions read in full (exercises and sets) for the rules and the follow-up; older ones are only counted. */
const DETAILED_SESSIONS = 20;
const COUNTED_SESSIONS = 300;

const EXERCISE_COLUMNS = "id,session_id,position,block,method_id,name,instructions,modality,target_sets,target_reps,target_seconds,rest_seconds,intensity,status,rpe,notes";
const SET_COLUMNS = "id,exercise_id,set_index,reps,seconds,load_kg,edge_mm,completed,notes,side,variant,controlled,discomfort,details";

function toEnrollment(r: Tables<"mobility_enrollments">): MobilityEnrollment {
  return {
    id: r.id, startedOn: r.started_on,
    workingLevel: ((LEVELS as readonly number[]).includes(r.working_level) ? r.working_level : 0) as Level,
    levelChangedAt: r.level_changed_at, sessionsPerWeek: r.sessions_per_week, sessionLength: r.session_length, status: r.status,
  };
}

export function toAssessmentPoint(r: Pick<Tables<"mobility_assessments">, "id" | "assessed_on" | "protocol_version" | "conditions" | "results" | "stage" | "rules_version">): AssessmentPoint {
  return {
    id: r.id, date: r.assessed_on, protocolVersion: r.protocol_version,
    conditions: parseStoredConditions(r.conditions), results: parseStoredResults(r.results),
    stage: ((LEVELS as readonly number[]).includes(r.stage) ? r.stage : 0) as Level, rulesVersion: r.rules_version,
  };
}

/**
 * Everything the hip-mobility pages, the session builder and Patrick need, in
 * a handful of queries. RLS scopes every query to the viewer. A missing table
 * (migration not applied yet) degrades to "not enrolled".
 */
export async function loadMobility(supabase: ServerSupabase, today = localDate_(new Date())): Promise<MobilityState> {
  const [{ data: enrollmentRow }, { data: assessmentRows }, { data: sessionRows }, { data: checkRow }, { data: fullAssessment }] = await Promise.all([
    supabase.from("mobility_enrollments").select("*").eq("programme", HIP_PROGRAMME).maybeSingle(),
    supabase.from("mobility_assessments")
      .select("id,assessed_on,protocol_version,conditions,results,stage,rules_version")
      .eq("programme", HIP_PROGRAMME).order("assessed_on", { ascending: false }).order("created_at", { ascending: false }).limit(60),
    supabase.from("training_sessions").select(SESSION_COLUMNS).eq("method_id", HIP_METHOD_ID)
      .order("scheduled_date", { ascending: false, nullsFirst: false }).order("created_at", { ascending: false }).limit(COUNTED_SESSIONS),
    supabase.from("training_day_checks").select("pain").eq("check_date", today).maybeSingle(),
    supabase.from("training_assessments").select("context").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);

  const sessions = ((sessionRows ?? []) as unknown as Parameters<typeof toSession>[0][]).map(toSession);
  const done = sessions.filter((s) => s.status === "COMPLETED" || s.status === "INTERRUPTED")
    .sort((a, b) => sessionDate(b).localeCompare(sessionDate(a)) || b.createdAt.localeCompare(a.createdAt));
  const detailed = done.slice(0, DETAILED_SESSIONS);

  const records: MobilitySessionRecord[] = [];
  if (detailed.length) {
    const { data: exRows } = await supabase.from("training_session_exercises").select(EXERCISE_COLUMNS)
      .in("session_id", detailed.map((s) => s.id)).order("position");
    const exIds = (exRows ?? []).map((e) => e.id);
    const { data: setRows } = exIds.length
      ? await supabase.from("training_exercise_sets").select(SET_COLUMNS).in("exercise_id", exIds).order("set_index")
      : { data: [] as Tables<"training_exercise_sets">[] };
    const sets = new Map<string, TrainingSet[]>();
    for (const s of setRows ?? []) {
      const list = sets.get(s.exercise_id) ?? [];
      list.push({ id: s.id, setIndex: s.set_index, reps: s.reps, seconds: s.seconds,
        loadKg: s.load_kg === null ? null : Number(s.load_kg), edgeMm: s.edge_mm, completed: s.completed, notes: s.notes,
        side: s.side, variant: s.variant, controlled: s.controlled, discomfort: s.discomfort, flags: flagsOf(s.details) });
      sets.set(s.exercise_id, list);
    }
    const bySession = new Map<string, TrainingExercise[]>();
    for (const e of exRows ?? []) {
      const list = bySession.get(e.session_id) ?? [];
      list.push({
        id: e.id, position: e.position, block: e.block, methodId: e.method_id, name: e.name,
        instructions: (e.instructions ?? {}) as Partial<ExerciseSnapshot>, modality: e.modality,
        targetSets: e.target_sets, targetReps: e.target_reps, targetSeconds: e.target_seconds,
        restSeconds: e.rest_seconds, intensity: e.intensity, status: e.status, rpe: e.rpe, notes: e.notes,
        sets: sets.get(e.id) ?? [],
      });
      bySession.set(e.session_id, list);
    }
    for (const s of detailed) {
      const r = mobilityRecord(s, bySession.get(s.id) ?? []);
      if (r) records.push(r);
    }
  }
  for (const s of done.slice(DETAILED_SESSIONS)) {
    records.push({ id: s.id, date: sessionDate(s), status: s.status as "COMPLETED" | "INTERRUPTED", level: 0, pain: s.pain, rpe: s.rpe, minutes: s.actualMinutes, exercises: [] });
  }

  const upcoming: UpcomingMobilitySession[] = sessions
    .filter((s) => s.status === "PLANNED" || s.status === "IN_PROGRESS" || (s.status === "INTERRUPTED" && s.scheduledDate === today))
    .filter((s) => s.status !== "PLANNED" || !s.scheduledDate || s.scheduledDate >= today)
    .map((s) => ({ id: s.id, date: s.scheduledDate, title: s.title, status: s.status as UpcomingMobilitySession["status"] }))
    .sort((a, b) => (a.status === "IN_PROGRESS" ? -1 : b.status === "IN_PROGRESS" ? 1 : (a.date ?? "").localeCompare(b.date ?? "")))
    .slice(0, 14);

  const pain = checkRow ? injuriesSchema.safeParse(checkRow.pain) : null;
  const health: Health = pain?.success ? { injuries: pain.data, unspecifiedPain: false }
    : fullAssessment ? healthFromContext(parseContext(fullAssessment.context)) : NO_HEALTH_ISSUE;

  return {
    enrollment: enrollmentRow ? toEnrollment(enrollmentRow) : null,
    assessments: (assessmentRows ?? []).map(toAssessmentPoint),
    records,
    upcoming,
    health,
    today,
  };
}

/** The latest assessment's results, used by the rules (starting version, asymmetry, assessment pain). */
export function latestResults(state: Pick<MobilityState, "assessments">): MobilityResult[] | null {
  return state.assessments[0]?.results ? [...state.assessments[0].results] : null;
}

/** The session the climber would do now (with offers), from the loaded state. */
export function currentPlan(state: MobilityState, length?: SessionLength, accept?: readonly string[]): SessionPlan {
  return planSession({
    workingLevel: state.enrollment?.workingLevel ?? 0,
    length: length ?? state.enrollment?.sessionLength ?? "STANDARD",
    records: state.records,
    assessment: latestResults(state),
    health: state.health,
    accept,
  });
}
