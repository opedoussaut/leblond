import "server-only";
import type { ClimberWork, Pact, WorkKind, WorkTarget } from "@/lib/analytics/alter-ego";
import { rivalSettingsFromRow, type RivalSettings } from "@/lib/analytics/rival";
import { signedPhotoUrl } from "@/lib/data/uploaded-photo";
import { RIVAL_PHOTO_FOLDER, isOwnPhotoPath } from "@/lib/profile-photo";
import type { ServerSupabase } from "@/lib/supabase/server";
import { pactFromRow } from "@/lib/training/alter-ego";
import { localDate_ } from "@/lib/training/sessions";

/** The climber's open pact (RLS-scoped), or null when none is signed. */
export async function loadOpenPact(supabase: ServerSupabase): Promise<Pact | null> {
  return (await loadOpenRival(supabase))?.pact ?? null;
}

export type OpenRival = {
  pact: Pact;
  settings: RivalSettings;
  /** The climber's own photo for the rival ("<me>/rival/…"), or null for the drawn portrait. */
  photoPath: string | null;
};

/** The open pact with the rival's settings (defaults before the rival migration). */
export async function loadOpenRival(supabase: ServerSupabase): Promise<OpenRival | null> {
  const { data } = await supabase.from("alter_ego_pacts").select("*").in("status", ["ACTIVE", "PAUSED"]).maybeSingle();
  const pact = data ? pactFromRow(data) : null;
  if (!pact || !data) return null;
  const photoPath = isOwnPhotoPath(data.user_id, RIVAL_PHOTO_FOLDER, data.photo_path) ? data.photo_path : null;
  return { pact, settings: rivalSettingsFromRow(data as Record<string, unknown>), photoPath };
}

/** A short-lived URL for the rival's photo, or null when it has none (only pages that show it ask). */
export async function rivalPhotoUrl(supabase: ServerSupabase, rival: OpenRival | null): Promise<string | null> {
  return rival?.photoPath ? signedPhotoUrl(supabase, rival.photoPath) : null;
}

type SetRow = { reps: number | null; training_session_exercises: { session_id: string; modality: string } | null };

/** Finished climbing sessions (boulders, routes, board), each one séance with its duration. */
async function loadClimbingWork(supabase: ServerSupabase): Promise<ClimberWork[]> {
  const { data } = await supabase.from("sessions").select("discipline, started_at, ended_at, duration_minutes")
    .not("ended_at", "is", null).order("started_at", { ascending: false }).limit(400);
  return (data ?? []).map((s) => {
    const span = s.ended_at ? Math.round((Date.parse(s.ended_at) - Date.parse(s.started_at)) / 60_000) : null;
    const kind: WorkKind = s.discipline === "ROUTE" ? "ROUTE" : s.discipline === "BOARD" ? "BOARD" : "BOULDER";
    return {
      status: "COMPLETED" as const, kind, date: localDate_(new Date(s.started_at)), pain: null, reps: 0, endedAt: s.ended_at,
      actualMinutes: s.duration_minutes ?? (span !== null && span > 0 && span <= 12 * 60 ? span : null),
    };
  });
}

/** Completed training with its counted reps, and finished climbing sessions. Only what the climber really recorded. */
export async function loadClimberWork(supabase: ServerSupabase): Promise<ClimberWork[]> {
  const [{ data: sessions }, { data: sets }, { data: exercises }, climbing] = await Promise.all([
    supabase.from("training_sessions").select("id, status, scheduled_date, completed_at, actual_minutes, pain")
      .eq("status", "COMPLETED").order("completed_at", { ascending: false }).limit(400),
    supabase.from("training_exercise_sets").select("reps, training_session_exercises!inner(session_id, modality)")
      .eq("completed", true).not("reps", "is", null).limit(5000),
    // The exercises of completed séances: the rival raced them alongside, at its own load.
    supabase.from("training_session_exercises")
      .select("session_id, block, method_id, modality, target_sets, target_reps, target_seconds, rest_seconds, training_sessions!inner(status)")
      .eq("training_sessions.status", "COMPLETED").order("position").limit(5000),
    loadClimbingWork(supabase),
  ]);
  const targets = new Map<string, WorkTarget[]>();
  for (const e of exercises ?? []) {
    targets.set(e.session_id, [...(targets.get(e.session_id) ?? []), {
      block: e.block, methodId: e.method_id, modality: e.modality,
      targetSets: e.target_sets, targetReps: e.target_reps, targetSeconds: e.target_seconds, restSeconds: e.rest_seconds,
    } as WorkTarget]);
  }
  const reps = new Map<string, number>();
  for (const s of (sets ?? []) as unknown as SetRow[]) {
    const exercise = s.training_session_exercises;
    if (!exercise || !["REPS", "ROUTES", "INTERVALS"].includes(exercise.modality)) continue;
    reps.set(exercise.session_id, (reps.get(exercise.session_id) ?? 0) + (s.reps ?? 0));
  }
  return [...climbing, ...(sessions ?? []).map((s): ClimberWork => ({
    status: s.status, kind: "TRAINING",
    date: s.scheduled_date ?? localDate_(new Date(s.completed_at ?? Date.now())),
    actualMinutes: s.actual_minutes, pain: s.pain, reps: reps.get(s.id) ?? 0, targets: targets.get(s.id) ?? [], endedAt: s.completed_at,
  }))];
}
