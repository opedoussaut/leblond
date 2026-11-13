import "server-only";
import type { BoardAscentFact } from "@/lib/analytics/boards";
import type { Board, BoardResult, BoardScale } from "@/lib/climbing/boards";
import type { ServerSupabase } from "@/lib/supabase/server";

export const BOARD_ASCENT_COLUMNS =
  "id, session_id, client_id, board, climb_name, climb_key, angle, grade, grade_scale, tries, result, is_benchmark, is_mirror, notes, climbed_at, source";

export type BoardAscentRow = {
  id: string; session_id: string; client_id: string; board: string; climb_name: string; climb_key: string; angle: number;
  grade: string; grade_scale: string; tries: number; result: string; is_benchmark: boolean; is_mirror: boolean; notes: string;
  climbed_at: string; source: string;
};

export type BoardProjectRow = {
  id: string; board: string; climb_name: string; climb_key: string; angle: number; grade: string; grade_scale: string;
  status: string; notes: string; started_at: string; sent_at: string | null;
};
export const BOARD_PROJECT_COLUMNS = "id, board, climb_name, climb_key, angle, grade, grade_scale, status, notes, started_at, sent_at";

export function toBoardFact(r: BoardAscentRow): BoardAscentFact {
  return {
    id: r.id, sessionId: r.session_id, board: r.board as Board, climbKey: r.climb_key, climbName: r.climb_name, angle: r.angle,
    grade: r.grade, gradeScale: r.grade_scale as BoardScale, tries: r.tries, result: r.result as BoardResult,
    isBenchmark: r.is_benchmark, climbedAt: new Date(r.climbed_at),
  };
}

/** Every board climb of the viewer (RLS), oldest first. Empty before the board migration. */
export async function loadBoardAscents(supabase: ServerSupabase, limit = 5000): Promise<BoardAscentRow[]> {
  const { data, error } = await supabase.from("board_ascents").select(BOARD_ASCENT_COLUMNS).order("climbed_at").limit(limit);
  return error ? [] : ((data ?? []) as BoardAscentRow[]);
}

export async function loadBoardProjects(supabase: ServerSupabase, status?: "ACTIVE"): Promise<BoardProjectRow[]> {
  let q = supabase.from("board_projects").select(BOARD_PROJECT_COLUMNS).order("started_at", { ascending: false });
  if (status) q = q.eq("status", status);
  const { data, error } = await q;
  return error ? [] : ((data ?? []) as BoardProjectRow[]);
}

/** The shared "à la maison" venue used for a board at home. */
export async function homeBoardGymId(supabase: ServerSupabase): Promise<string | null> {
  const { data } = await supabase.from("gyms").select("id").eq("external_provider", "leblond-board").eq("external_id", "home").maybeSingle();
  return data?.id ?? null;
}
