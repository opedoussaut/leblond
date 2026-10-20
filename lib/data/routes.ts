import "server-only";
import type { RouteAscentFact } from "@/lib/analytics/routes";
import type { ServerSupabase } from "@/lib/supabase/server";

/** The climber's route ascents (RLS-scoped), oldest first, as analytics facts. */
export async function loadRouteAscents(supabase: ServerSupabase): Promise<RouteAscentFact[] | null> {
  const out: RouteAscentFact[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase.from("route_ascents")
      .select("id, session_id, grade, style, result, falls, created_at")
      .order("created_at").range(from, from + 999);
    if (error) return null;
    out.push(...data.map((a) => ({
      id: a.id, sessionId: a.session_id, grade: a.grade, style: a.style, result: a.result,
      falls: a.falls, createdAt: new Date(a.created_at),
    })));
    if (data.length < 1000) return out;
  }
}
