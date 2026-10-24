import type { RouteAscentRow } from "@/lib/actions/routes";
import type { Viewer } from "@/lib/auth/viewer";
import type { StyleTag, WallAngle } from "@/lib/climbing/types";
import { loadOutdoorAreaForGym } from "@/lib/data/outdoor";
import { tagSlugs, type loadSessionView } from "@/lib/data/session";
import { isFrenchRouteGrade } from "@/lib/grading/route-grades";
import { LiveSession } from "./live-session";
import { RouteSession } from "./route-session";

type View = NonNullable<Awaited<ReturnType<typeof loadSessionView>>>;

export const ROUTE_ASCENT_COLUMNS =
  "id,session_id,client_id,route_name,grade,style,result,falls,wall_angle,created_at,route_project_id,native_grade,native_grade_system";

export async function loadRouteAscents(viewer: Viewer, sessionId: string): Promise<RouteAscentRow[]> {
  const { data } = await viewer.supabase.from("route_ascents").select(ROUTE_ASCENT_COLUMNS)
    .eq("session_id", sessionId).order("created_at", { ascending: false });
  return (data ?? []) as RouteAscentRow[];
}

/**
 * The logger for a session, live or in edit mode: bouldering (problems and
 * attempts, native gym grades) or routes (French grades, plus the gym's colour
 * where it grades routes by colour).
 */
export async function SessionLogger({ viewer, view, mode }: { viewer: Viewer; view: View; mode: "live" | "edit" }) {
  if (view.session.discipline === "ROUTE") {
    const ascents = await loadRouteAscents(viewer, view.session.id);
    const level = viewer.profile.self_reported_route_grade;
    const defaultGrade = (ascents[0]?.grade ?? (level && isFrenchRouteGrade(level) ? level : "6a")) as "6a";
    const [{ data: projects }, { data: history }] = await Promise.all([
      viewer.supabase.from("route_projects").select("id, route_name, grade, goal_style")
        .eq("gym_id", view.gym.id).eq("status", "ACTIVE").order("started_at", { ascending: false }),
      // The climber's own colour → French choices at this gym, latest first.
      viewer.supabase.from("route_ascents").select("native_grade, grade, sessions!inner(gym_id)")
        .eq("sessions.gym_id", view.gym.id).not("native_grade", "is", null)
        .order("created_at", { ascending: false }).limit(200),
    ]);
    const colourEquivalents: Record<string, string> = {};
    for (const h of history ?? []) if (h.native_grade && !colourEquivalents[h.native_grade]) colourEquivalents[h.native_grade] = h.grade;
    return <RouteSession sessionId={view.session.id} gymId={view.gym.id} gymName={view.gym.name}
      startedAt={view.session.started_at} initialAscents={ascents} defaultGrade={defaultGrade}
      initialProjects={projects ?? []} gymSystem={view.gym.grading_system}
      colourEquivalents={colourEquivalents} mode={mode} />;
  }

  const outdoor = view.gym.external_provider === "BOOLDER" ? await loadOutdoorAreaForGym(viewer.supabase, view.gym.id) : null;
  return (
    <LiveSession
      sessionId={view.session.id}
      userId={viewer.userId}
      gym={{ id: view.gym.id, name: view.gym.name, system: view.gym.grading_system }}
      startedAt={view.session.started_at}
      initialProblems={view.problems.map((p) => ({
        id: p.id,
        native_grade: p.native_grade,
        wall_angle: p.wall_angle as WallAngle,
        tags: tagSlugs(p) as StyleTag[],
        created_at: p.created_at,
        name: p.name,
        outdoor_problem_id: p.outdoor_problem_id,
      }))}
      outdoor={outdoor}
      initialAttempts={view.attempts}
      projectProblemIds={view.activeProjectProblemIds}
      mode={mode}
    />
  );
}
