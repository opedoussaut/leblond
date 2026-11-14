import { boardGoalProgress } from "@/lib/analytics/boards";
import type { Board, BoardScale } from "@/lib/climbing/boards";
import { loadBoardAscents, loadBoardGoals, toBoardFact, type BoardProjectRow } from "@/lib/data/boards";
import type { Locale } from "@/lib/i18n";
import type { ServerSupabase } from "@/lib/supabase/server";
import { BoardProjects, type BoardGoalItem } from "./board-projects";

/**
 * Board projects on /projects: level goals per board (progress computed from
 * the climber's board climbs) and precise climbs kept as projects.
 */
export async function BoardProjectsSection({ supabase, locale, projects }: {
  supabase: ServerSupabase; locale: Locale; projects: BoardProjectRow[];
}) {
  const [goals, ascents] = await Promise.all([loadBoardGoals(supabase), loadBoardAscents(supabase)]);
  const facts = goals.length ? ascents.map(toBoardFact) : [];
  const items: BoardGoalItem[] = goals.map((g) => {
    const p = boardGoalProgress(facts, { board: g.board as Board, angle: g.angle, grade: g.grade, gradeScale: g.grade_scale as BoardScale });
    return { ...g, best: p.best, reached: p.reached, reachedAt: p.reachedAt?.toISOString() ?? null, climbsAtGoal: p.climbsAtGoal };
  });
  return <BoardProjects locale={locale} projects={projects} goals={items} />;
}
