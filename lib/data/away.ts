import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { isMobilityWork } from "@/lib/analytics/charts";
import { HIP_PROGRAMME } from "@/lib/training/hip-mobility/content";
import { levelView } from "@/lib/training/hip-mobility/levels";
import type { MobilityResult } from "@/lib/training/hip-mobility/assessment";
import { AWAY_KEY_PREFIX, awaySessionOf, climbStrain, strainOf, type RecentWork } from "@/lib/training/away";
import { localDate_ } from "@/lib/training/sessions";
import { utcToZoned } from "@/lib/time";

/** The stage of the latest hip test (0–4), or null when the climber never did one. */
export async function loadHipStage(supabase: ServerSupabase): Promise<number | null> {
  const { data } = await supabase.from("mobility_assessments").select("results")
    .eq("programme", HIP_PROGRAMME).order("assessed_on", { ascending: false }).order("created_at", { ascending: false })
    .limit(1).maybeSingle();
  if (!data || !Array.isArray(data.results)) return null;
  return levelView(data.results as unknown as MobilityResult[]).stage;
}

export type AwayDone = {
  sessionId: string;
  key: string;
  date: string;
  status: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "INTERRUPTED" | "SKIPPED" | "CANCELED";
  minutes: number | null;
  rpe: number | null;
};

/**
 * The climber's away séances, newest first: those started or planned from the
 * En déplacement page (their first exercise carries the "away:<key>:0" key).
 */
export async function loadAwayHistory(supabase: ServerSupabase, limit = 60): Promise<AwayDone[]> {
  const { data: firsts } = await supabase.from("training_session_exercises").select("session_id, instructions")
    .eq("position", 0).like("instructions->>key", AWAY_KEY_PREFIX + "%")
    .order("created_at", { ascending: false }).limit(limit);
  const keyOf = new Map<string, string>();
  for (const f of firsts ?? []) {
    const key = awaySessionOf((f.instructions as { key?: string } | null)?.key);
    if (key) keyOf.set(f.session_id, key);
  }
  if (!keyOf.size) return [];
  const { data: sessions } = await supabase.from("training_sessions")
    .select("id, status, scheduled_date, started_at, completed_at, created_at, actual_minutes, rpe")
    .in("id", [...keyOf.keys()]);
  return (sessions ?? []).map((s) => ({
    sessionId: s.id, key: keyOf.get(s.id)!,
    date: s.started_at ? utcToZoned(s.started_at).date : s.scheduled_date ?? localDate_(new Date(s.created_at)),
    status: s.status, minutes: s.actual_minutes, rpe: s.rpe,
  })).sort((a, b) => b.date.localeCompare(a.date));
}

/** Last date each away séance was done (completed or interrupted). */
export function lastDoneByKey(history: readonly AwayDone[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const h of history) {
    if (h.status !== "COMPLETED" && h.status !== "INTERRUPTED") continue;
    if (!out[h.key] || out[h.key] < h.date) out[h.key] = h.date;
  }
  return out;
}

/**
 * Yesterday's and today's work, for the recovery advice: training séances done
 * or under way, and climbing sessions. Away séances keep their own load.
 */
export async function loadRecentWork(supabase: ServerSupabase, today: string, away: readonly AwayDone[]): Promise<RecentWork[]> {
  const since = new Date(Date.parse(today + "T00:00:00Z") - 2 * 86_400_000).toISOString();
  const [{ data: training }, { data: climbs }] = await Promise.all([
    supabase.from("training_sessions").select("id, method_id, status, started_at, rpe")
      .in("status", ["IN_PROGRESS", "COMPLETED", "INTERRUPTED"]).gte("started_at", since).limit(20),
    supabase.from("sessions").select("started_at, duration_minutes, fatigue").gte("started_at", since).limit(20),
  ]);
  const awayKey = new Map(away.map((a) => [a.sessionId, a.key]));
  const ids = (training ?? []).map((t) => t.id);
  const { data: exercises } = ids.length
    ? await supabase.from("training_session_exercises").select("session_id, method_id").in("session_id", ids)
    : { data: [] as { session_id: string; method_id: string | null }[] };
  const methods = new Map<string, (string | null)[]>();
  for (const e of exercises ?? []) methods.set(e.session_id, [...(methods.get(e.session_id) ?? []), e.method_id]);
  const work: RecentWork[] = [];
  for (const t of training ?? []) {
    if (!t.started_at) continue;
    work.push({
      date: utcToZoned(t.started_at).date,
      strain: strainOf({ awayKey: awayKey.get(t.id), mobility: isMobilityWork(t.method_id, methods.get(t.id) ?? []), rpe: t.rpe }),
    });
  }
  for (const c of climbs ?? []) {
    work.push({ date: utcToZoned(c.started_at).date, strain: climbStrain({ fatigue: c.fatigue, minutes: c.duration_minutes }) });
  }
  return work;
}
