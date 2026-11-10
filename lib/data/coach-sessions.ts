import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";
import { COACH_SESSION_COLUMNS, coachSessionFromRow, type CoachSession } from "@/lib/training/coach-sessions";

/** Coach sessions offered to the signed-in climber: their own and the shared library (RLS), most recent first. */
export async function listCoachSessions(supabase: ServerSupabase): Promise<CoachSession[]> {
  const { data } = await supabase.from("coach_sessions").select(COACH_SESSION_COLUMNS)
    .order("updated_at", { ascending: false }).limit(100);
  return (data ?? []).map(coachSessionFromRow).filter((s): s is CoachSession => s !== null);
}

export type CoachKey = { id: string; label: string; prefix: string; createdAt: string; lastUsedAt: string | null };

/** Active coach keys (never the hash: it is not readable by the client role). */
export async function listCoachKeys(supabase: ServerSupabase): Promise<CoachKey[]> {
  const { data } = await supabase.from("coach_keys").select("id,label,prefix,created_at,last_used_at,revoked_at")
    .is("revoked_at", null).order("created_at", { ascending: false });
  return (data ?? []).map((k) => ({ id: k.id, label: k.label, prefix: k.prefix, createdAt: k.created_at, lastUsedAt: k.last_used_at }));
}
