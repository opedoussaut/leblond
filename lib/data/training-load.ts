import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import type { BoardAscentFact } from "@/lib/analytics/boards";
import { isMobilityWork } from "@/lib/analytics/charts";
import { mainEdge, type HangSet } from "@/lib/analytics/notebook";
import type { RouteAscentFact } from "@/lib/analytics/routes";
import {
  boardPerf, boardScaledAttempts, boulderPerf, boulderScaledAttempts, hangPerf, routePerf, routeScaledAttempts, trainingLoadReport,
  type ClimbSessionFact, type TrainingLoadReport,
} from "@/lib/analytics/training-load";
import type { ClimbingDataset } from "@/lib/analytics/types";
import { loadHangSets } from "@/lib/data/notebook";
import { listTrainingSessions, loadExerciseMethods } from "@/lib/data/training-sessions";
import type { MobilityState } from "@/lib/data/mobility";
import { HIP_METHOD_ID } from "@/lib/training/hip-mobility/content";
import type { TrainingSession } from "@/lib/training/sessions";

/** How far back load is read: the 1-year view plus the 42-day warm-up of the chronic average. */
export const LOAD_HISTORY_DAYS = 420;

/**
 * Finished climbing sessions of every discipline (boulder, route, board) for
 * the load model; RLS scopes them to the viewer.
 */
export async function loadClimbSessionsForLoad(supabase: ServerSupabase, since: string): Promise<Omit<ClimbSessionFact, "attempts" | "nearLimit">[]> {
  const { data } = await supabase.from("sessions")
    .select("id, discipline, started_at, ended_at, duration_minutes, fatigue")
    .gte("started_at", since + "T00:00:00Z").not("ended_at", "is", null).order("started_at").limit(2000);
  return (data ?? []).map((s) => ({
    id: s.id, discipline: s.discipline, date: s.started_at.slice(0, 10),
    startedAt: new Date(s.started_at), endedAt: s.ended_at ? new Date(s.ended_at) : null,
    durationMinutes: s.duration_minutes, fatigue: s.fatigue,
  }));
}

const sessionDate = (s: Pick<TrainingSession, "scheduledDate" | "completedAt" | "createdAt">) =>
  s.scheduledDate ?? (s.completedAt ?? s.createdAt).slice(0, 10);

/**
 * The training-load report from everything the climber records. Pieces the
 * caller already loaded are passed in; the rest is read here (RLS-scoped).
 * The hip programme's sessions come from `mobility.records`, never twice.
 */
export async function loadTrainingLoadReport(supabase: ServerSupabase, input: {
  today: string; now: Date; dataset: ClimbingDataset; routes: readonly RouteAscentFact[]; boardFacts: readonly BoardAscentFact[];
  mobility: Pick<MobilityState, "records">;
  training?: TrainingSession[] | null; hangSets?: HangSet[];
}): Promise<TrainingLoadReport> {
  const since = new Date(input.now.getTime() - LOAD_HISTORY_DAYS * 86_400_000).toISOString().slice(0, 10);
  const [climbs, training, hangSets] = await Promise.all([
    loadClimbSessionsForLoad(supabase, since),
    input.training !== undefined ? Promise.resolve(input.training) : listTrainingSessions(supabase, 400),
    input.hangSets ? Promise.resolve(input.hangSets) : loadHangSets(supabase),
  ]);
  const list = (training ?? []).filter((s) => s.methodId !== HIP_METHOD_ID);
  const methods = await loadExerciseMethods(supabase, list.filter((s) => !s.methodId).map((s) => s.id));
  return trainingLoadReport({
    today: input.today,
    climbs,
    scaledAttempts: [...boulderScaledAttempts(input.dataset.problems, input.dataset.attempts), ...routeScaledAttempts(input.routes), ...boardScaledAttempts(input.boardFacts)],
    training: list.map((s) => ({
      id: s.id, date: sessionDate(s), completed: s.status === "COMPLETED", actualMinutes: s.actualMinutes, plannedMinutes: s.plannedMinutes,
      rpe: s.rpe, pain: s.pain, mobility: isMobilityWork(s.methodId, methods.get(s.id) ?? []), climbingSessionId: s.climbingSessionId,
    })),
    mobility: input.mobility.records.filter((r) => r.status === "COMPLETED").map((r) => ({ date: r.date, minutes: r.minutes, rpe: r.rpe })),
    perf: [...boulderPerf(input.dataset.problems, input.dataset.attempts), ...routePerf(input.routes), ...boardPerf(input.boardFacts),
      ...hangPerf(hangSets, mainEdge(hangSets))],
  });
}
