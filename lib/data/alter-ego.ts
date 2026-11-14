import "server-only";
import type { ClimberWork, Pact, WorkTarget } from "@/lib/analytics/alter-ego";
import { rivalSettingsFromRow, type RivalSettings } from "@/lib/analytics/rival";
import type { ServerSupabase } from "@/lib/supabase/server";
import { pactFromRow } from "@/lib/training/alter-ego";
import { localDate_ } from "@/lib/training/sessions";

/** The climber's open pact (RLS-scoped), or null when none is signed. */
export async function loadOpenPact(supabase: ServerSupabase): Promise<Pact | null> {
  return (await loadOpenRival(supabase))?.pact ?? null;
}

/** The open pact with the rival's settings (defaults before the rival migration). */
export async function loadOpenRival(supabase: ServerSupabase): Promise<{ pact: Pact; settings: RivalSettings } | null> {
  const { data } = await supabase.from("alter_ego_pacts").select("*").in("status", ["ACTIVE", "PAUSED"]).maybeSingle();
  const pact = data ? pactFromRow(data) : null;
  return pact && data ? { pact, settings: rivalSettingsFromRow(data as Record<string, unknown>) } : null;
}

type SetRow = { reps: number | null; training_session_exercises: { session_id: string; modality: string } | null };

/** Completed training with its counted reps. Only what the climber really recorded. */
export async function loadClimberWork(supabase: ServerSupabase): Promise<ClimberWork[]> {
  const [{ data: sessions }, { data: sets }, { data: exercises }] = await Promise.all([
    supabase.from("training_sessions").select("id, status, scheduled_date, completed_at, actual_minutes, pain")
      .eq("status", "COMPLETED").order("completed_at", { ascending: false }).limit(400),
    supabase.from("training_exercise_sets").select("reps, training_session_exercises!inner(session_id, modality)")
      .eq("completed", true).not("reps", "is", null).limit(5000),
    // The exercises of completed séances: the rival raced them alongside, at its own load.
    supabase.from("training_session_exercises")
      .select("session_id, block, method_id, modality, target_sets, target_reps, target_seconds, rest_seconds, training_sessions!inner(status)")
      .eq("training_sessions.status", "COMPLETED").order("position").limit(5000),
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
  return (sessions ?? []).map((s) => ({
    status: s.status,
    date: s.scheduled_date ?? localDate_(new Date(s.completed_at ?? Date.now())),
    actualMinutes: s.actual_minutes, pain: s.pain, reps: reps.get(s.id) ?? 0, targets: targets.get(s.id) ?? [],
  }));
}
