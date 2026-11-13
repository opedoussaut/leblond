import "server-only";
import { avatarProgress, boulderSendsFrom, routeSendsFrom, type AvatarProgress, type RouteSendRow } from "@/lib/analytics/avatar";
import type { ClimbingDataset } from "@/lib/analytics/types";
import { loadBoardAscents, toBoardFact, type BoardAscentRow } from "@/lib/data/boards";
import { loadClimbingDataset } from "@/lib/data/climbing";
import { parseStoredResults } from "@/lib/training/hip-mobility/assessment";
import type { ServerSupabase } from "@/lib/supabase/server";

async function routeRows(supabase: ServerSupabase): Promise<RouteSendRow[]> {
  const out: RouteSendRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("route_ascents")
      .select("id, session_id, grade, style, result, route_name").eq("style", "LEAD").range(from, from + 999);
    if (error) return out;
    out.push(...data.map((a) => ({ id: a.id, sessionId: a.session_id, grade: a.grade, style: a.style, result: a.result, routeName: a.route_name ?? "" })));
    if (data.length < 1000) return out;
  }
}

/**
 * The viewer's avatar from their logbook and their last two hip-mobility
 * assessments (RLS-scoped). Pages that already loaded the climbing dataset or
 * the board climbs pass them in.
 */
export async function loadAvatar(supabase: ServerSupabase, preloaded: { dataset?: ClimbingDataset; boardRows?: BoardAscentRow[] } = {}): Promise<AvatarProgress> {
  const [dataset, boardRows, routes, { data: assessments }] = await Promise.all([
    preloaded.dataset ?? loadClimbingDataset(supabase),
    preloaded.boardRows ?? loadBoardAscents(supabase),
    routeRows(supabase),
    supabase.from("mobility_assessments").select("results").order("assessed_on", { ascending: false })
      .order("created_at", { ascending: false }).limit(2),
  ]);
  return avatarProgress({
    boulderSends: boulderSendsFrom(dataset.problems, dataset.attempts, boardRows.map(toBoardFact)),
    routeSends: routeSendsFrom(routes),
    assessments: (assessments ?? []).map((a) => ({ results: parseStoredResults(a.results) })),
  });
}
