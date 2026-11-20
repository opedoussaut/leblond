import "server-only";
import type { Tables } from "@/lib/supabase/database.types";
import type { ServerSupabase } from "@/lib/supabase/server";
import { overlapsSession } from "@/lib/integrations/wearables/overlap";

export type ActivityCandidate = { id: string; startedAt: string; durationSeconds: number; device: string | null };

/**
 * Imported watch activities not linked to any séance that overlap this one
 * (offered for one-tap linking). Empty when the séance already has one. RLS
 * keeps the query to the viewer's own activities.
 */
export async function loadActivityCandidates(
  supabase: ServerSupabase,
  session: Pick<Tables<"sessions">, "started_at" | "ended_at" | "wearable_activity_id">,
): Promise<ActivityCandidate[]> {
  if (session.wearable_activity_id) return [];
  const windowStart = new Date(new Date(session.started_at).getTime() - 6 * 3_600_000).toISOString();
  const windowEnd = new Date(new Date(session.ended_at ?? session.started_at).getTime() + 6 * 3_600_000).toISOString();
  const { data } = await supabase
    .from("wearable_activities")
    .select("id, started_at, duration_seconds, device_name")
    .is("session_id", null)
    .is("training_session_id", null)
    .gte("started_at", windowStart)
    .lte("started_at", windowEnd);
  const window = { startedAt: new Date(session.started_at), endedAt: session.ended_at ? new Date(session.ended_at) : null };
  return (data ?? [])
    .filter((a) => overlapsSession({ startedAt: new Date(a.started_at), durationSeconds: a.duration_seconds }, window))
    .map((a) => ({ id: a.id, startedAt: a.started_at, durationSeconds: a.duration_seconds, device: a.device_name }));
}
