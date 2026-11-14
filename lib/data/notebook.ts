import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { HangSet } from "@/lib/analytics/notebook";

/** Hangboard methods whose sets carry a load worth comparing. */
const HANG_METHODS = ["max-hangs", "hangboard"];

/** Hangboard sets with a recorded load, from completed training sessions (RLS scopes them to the viewer). */
export async function loadHangSets(supabase: ServerSupabase): Promise<HangSet[]> {
  const { data } = await supabase.from("training_exercise_sets")
    .select("load_kg, edge_mm, seconds, completed, training_session_exercises!inner(method_id, training_sessions!inner(status, scheduled_date, completed_at, created_at))")
    .not("load_kg", "is", null)
    .in("training_session_exercises.method_id", HANG_METHODS)
    .eq("training_session_exercises.training_sessions.status", "COMPLETED")
    .limit(2000);
  type Row = { load_kg: number | null; edge_mm: number | null; seconds: number | null; completed: boolean;
    training_session_exercises: { training_sessions: { scheduled_date: string | null; completed_at: string | null; created_at: string } } };
  return ((data ?? []) as unknown as Row[]).filter((r) => r.completed && r.load_kg !== null).map((r) => {
    const s = r.training_session_exercises.training_sessions;
    return { loadKg: Number(r.load_kg), edgeMm: r.edge_mm, seconds: r.seconds, date: s.scheduled_date ?? (s.completed_at ?? s.created_at).slice(0, 10) };
  });
}

/** Climbing sessions since a day, with the limiters ticked in their summary. */
export async function loadSessionLimiters(supabase: ServerSupabase, since: string): Promise<{ date: string; limiters: string[] }[]> {
  const { data } = await supabase.from("sessions").select("started_at, limiters")
    .gte("started_at", since + "T00:00:00Z").not("ended_at", "is", null).limit(1000);
  return (data ?? []).map((s) => ({ date: s.started_at.slice(0, 10), limiters: s.limiters ?? [] }));
}
