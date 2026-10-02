import "server-only";
import type { ClimbingDataset, GymFact, ProblemFact, SessionFact, AttemptFact } from "@/lib/analytics";
import type { GradeSystem, StyleTag } from "@/lib/climbing/types";
import type { Tables } from "@/lib/supabase/database.types";
import type { ServerSupabase } from "@/lib/supabase/server";

const PAGE = 1000;

/** PostgREST caps responses (1000 rows by default): page through everything. */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await page(from, from + PAGE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) return rows;
  }
}

type ProblemRow = Tables<"problems"> & { problem_tags: Array<{ tags: { slug: string } | null }> };
type SessionRow = Tables<"sessions"> & { wearable_activities: Tables<"wearable_activities"> | null };

export function toGymFact(g: Tables<"gyms">): GymFact {
  return { id: g.id, name: g.name, brand: g.brand, gradingSystem: g.grading_system as GradeSystem };
}

export function toProblemFact(p: ProblemRow | (Tables<"problems"> & { tags?: StyleTag[] })): ProblemFact {
  const tags =
    "problem_tags" in p
      ? (p.problem_tags.map((pt) => pt.tags?.slug).filter(Boolean) as StyleTag[])
      : ((p as { tags?: StyleTag[] }).tags ?? []);
  return {
    id: p.id,
    gymId: p.gym_id,
    nativeGrade: p.native_grade,
    nativeGradeSystem: p.native_grade_system as GradeSystem,
    normalizedGrade: p.normalized_grade,
    normalizedGradeSystem: p.normalized_grade_system,
    normalizationConfidence: p.normalization_confidence,
    normalizationSource: p.normalization_source,
    wallAngle: p.wall_angle,
    tags,
  };
}

export function toAttemptFact(a: Tables<"attempts">): AttemptFact {
  return {
    id: a.id,
    problemId: a.problem_id,
    sessionId: a.session_id,
    result: a.result,
    attemptNumber: a.attempt_number,
    createdAt: new Date(a.created_at),
  };
}

export function toSessionFact(s: SessionRow | Tables<"sessions">, activity?: Tables<"wearable_activities"> | null): SessionFact {
  const w = activity ?? ("wearable_activities" in s ? s.wearable_activities : null);
  return {
    id: s.id,
    gymId: s.gym_id,
    startedAt: new Date(s.started_at),
    endedAt: s.ended_at ? new Date(s.ended_at) : null,
    durationMinutes: s.duration_minutes,
    wearable: w
      ? {
          provider: w.provider,
          durationSeconds: w.duration_seconds,
          avgHeartRate: w.avg_heart_rate,
          maxHeartRate: w.max_heart_rate,
          calories: w.calories,
          trainingLoad: w.training_load,
          deviceName: w.device_name,
        }
      : null,
  };
}

export const PROBLEM_SELECT = "*, problem_tags(tags(slug))";
export const SESSION_SELECT = "*, wearable_activities!sessions_wearable_activity_fk(*)";

/**
 * The climber's full history as analytics facts. RLS guarantees only the
 * viewer's own rows are returned; gyms come from the shared catalogue.
 */
export async function loadClimbingDataset(supabase: ServerSupabase): Promise<ClimbingDataset> {
  const [problems, attempts, sessions, gyms] = await Promise.all([
    fetchAll<ProblemRow>((from, to) =>
      supabase.from("problems").select(PROBLEM_SELECT).order("created_at").range(from, to) as never,
    ),
    fetchAll<Tables<"attempts">>((from, to) =>
      supabase.from("attempts").select("*").order("created_at").range(from, to),
    ),
    fetchAll<SessionRow>((from, to) =>
      supabase.from("sessions").select(SESSION_SELECT).order("started_at").range(from, to) as never,
    ),
    fetchAll<Tables<"gyms">>((from, to) => supabase.from("gyms").select("*").order("name").range(from, to)),
  ]);
  return {
    gyms: gyms.map(toGymFact),
    problems: problems.map(toProblemFact),
    attempts: attempts.map(toAttemptFact),
    sessions: sessions.map((s) => toSessionFact(s)),
  };
}
