import "server-only";
import type { Tables } from "@/lib/supabase/database.types";
import type { ServerSupabase } from "@/lib/supabase/server";
import { PROBLEM_SELECT } from "./climbing";

export type ProblemWithTags = Tables<"problems"> & { problem_tags: Array<{ tags: { slug: string } | null }> };

export function tagSlugs(p: ProblemWithTags): string[] {
  return p.problem_tags.map((pt) => pt.tags?.slug).filter((s): s is string => Boolean(s));
}

/**
 * Everything the live-session and summary screens need, scoped by RLS to the
 * viewer: the session, its gym, the problems touched in it (or created during
 * it, or active projects at that gym) and all attempts on those problems.
 */
export async function loadSessionView(supabase: ServerSupabase, sessionId: string) {
  const { data: session } = await supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle();
  if (!session) return null;

  const [{ data: gym }, { data: sessionAttempts }, { data: createdDuring }, { data: projects }, { data: activity }] =
    await Promise.all([
      supabase.from("gyms").select("*").eq("id", session.gym_id).single(),
      supabase.from("attempts").select("problem_id").eq("session_id", sessionId),
      supabase
        .from("problems")
        .select("id")
        .eq("gym_id", session.gym_id)
        .gte("created_at", session.started_at)
        .lte("created_at", session.ended_at ?? new Date(Date.now() + 60_000).toISOString()),
      supabase.from("projects").select("id, problem_id, status").eq("status", "ACTIVE"),
      session.wearable_activity_id
        ? supabase.from("wearable_activities").select("*").eq("id", session.wearable_activity_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
  if (!gym) return null;

  const ids = new Set<string>([
    ...(sessionAttempts ?? []).map((a) => a.problem_id),
    ...(createdDuring ?? []).map((p) => p.id),
  ]);
  const projectProblemIds = (projects ?? []).map((p) => p.problem_id);

  const { data: problems } = await supabase
    .from("problems")
    .select(PROBLEM_SELECT)
    .in("id", [...new Set([...ids, ...projectProblemIds])])
    .eq("gym_id", gym.id)
    .order("created_at");
  const problemList = (problems ?? []) as unknown as ProblemWithTags[];

  const { data: attempts } = problemList.length
    ? await supabase
        .from("attempts")
        .select("*")
        .in(
          "problem_id",
          problemList.map((p) => p.id),
        )
        .order("attempt_number")
    : { data: [] as Tables<"attempts">[] };

  return {
    session,
    gym,
    problems: problemList,
    attempts: attempts ?? [],
    activeProjectProblemIds: projectProblemIds,
    activity: (activity ?? null) as Tables<"wearable_activities"> | null,
  };
}
