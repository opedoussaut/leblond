import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import type { ExerciseSnapshot } from "@/lib/training/session-templates";
import type { TrainingExercise, TrainingSession, TrainingSet } from "@/lib/training/sessions";

export const SESSION_COLUMNS =
  "id,title,objective,method_id,plan_id,plan_session_index,calendar_entry_id,climbing_session_id,venue,status," +
  "scheduled_date,scheduled_time,planned_minutes,started_at,paused_at,paused_seconds,completed_at,actual_minutes," +
  "current_index,rpe,pain,pain_notes,notes,created_at";

type SessionRow = Pick<Tables<"training_sessions">,
  "id" | "title" | "objective" | "method_id" | "plan_id" | "plan_session_index" | "calendar_entry_id" |
  "climbing_session_id" | "venue" | "status" | "scheduled_date" | "scheduled_time" | "planned_minutes" |
  "started_at" | "paused_at" | "paused_seconds" | "completed_at" | "actual_minutes" | "current_index" |
  "rpe" | "pain" | "pain_notes" | "notes" | "created_at">;

export function toSession(r: SessionRow): TrainingSession {
  return {
    id: r.id, title: r.title, objective: r.objective, methodId: r.method_id, planId: r.plan_id,
    planSessionIndex: r.plan_session_index, calendarEntryId: r.calendar_entry_id,
    climbingSessionId: r.climbing_session_id, venue: r.venue, status: r.status,
    scheduledDate: r.scheduled_date, scheduledTime: r.scheduled_time?.slice(0, 5) ?? null,
    plannedMinutes: r.planned_minutes, startedAt: r.started_at, pausedAt: r.paused_at,
    pausedSeconds: r.paused_seconds, completedAt: r.completed_at, actualMinutes: r.actual_minutes,
    currentIndex: r.current_index, rpe: r.rpe, pain: r.pain, painNotes: r.pain_notes, notes: r.notes,
    createdAt: r.created_at,
  };
}

/** Lists the climber's training sessions (RLS scopes them to the viewer). */
export async function listTrainingSessions(supabase: ServerSupabase, limit = 200): Promise<TrainingSession[] | null> {
  const { data, error } = await supabase.from("training_sessions").select(SESSION_COLUMNS)
    .order("scheduled_date", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false }).limit(limit);
  if (error) return null;
  return (data as unknown as SessionRow[]).map(toSession);
}

/** One session with its exercises and recorded sets, or null if not visible. */
export async function loadTrainingSession(supabase: ServerSupabase, id: string):
  Promise<{ session: TrainingSession; exercises: TrainingExercise[] } | null> {
  const { data: row } = await supabase.from("training_sessions").select(SESSION_COLUMNS).eq("id", id).maybeSingle();
  if (!row) return null;
  const { data: exRows } = await supabase.from("training_session_exercises")
    .select("id,position,block,method_id,name,instructions,modality,target_sets,target_reps,target_seconds,rest_seconds,intensity,status,rpe,notes")
    .eq("session_id", id).order("position");
  const ids = (exRows ?? []).map((e) => e.id);
  const { data: setRows } = ids.length
    ? await supabase.from("training_exercise_sets")
      .select("id,exercise_id,set_index,reps,seconds,load_kg,completed,notes")
      .in("exercise_id", ids).order("set_index")
    : { data: [] as Tables<"training_exercise_sets">[] };
  const sets = new Map<string, TrainingSet[]>();
  for (const s of setRows ?? []) {
    const list = sets.get(s.exercise_id) ?? [];
    list.push({ id: s.id, setIndex: s.set_index, reps: s.reps, seconds: s.seconds,
      loadKg: s.load_kg === null ? null : Number(s.load_kg), completed: s.completed, notes: s.notes });
    sets.set(s.exercise_id, list);
  }
  return {
    session: toSession(row as unknown as SessionRow),
    exercises: (exRows ?? []).map((e) => ({
      id: e.id, position: e.position, block: e.block, methodId: e.method_id, name: e.name,
      instructions: (e.instructions ?? {}) as Partial<ExerciseSnapshot>, modality: e.modality,
      targetSets: e.target_sets, targetReps: e.target_reps, targetSeconds: e.target_seconds,
      restSeconds: e.rest_seconds, intensity: e.intensity, status: e.status, rpe: e.rpe, notes: e.notes,
      sets: sets.get(e.id) ?? [],
    })),
  };
}
