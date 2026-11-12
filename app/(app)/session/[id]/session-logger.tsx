import type { RouteAscentRow } from "@/lib/actions/routes";
import type { Viewer } from "@/lib/auth/viewer";
import type { KnownBoulder } from "@/lib/climbing/offline-session";
import type { StyleTag, WallAngle } from "@/lib/climbing/types";
import { loadOutdoorAreaForGym } from "@/lib/data/outdoor";
import { tagSlugs, type loadSessionView } from "@/lib/data/session";
import { boulderSystemsForGym, gymScales, sessionBoulderSystem } from "@/lib/grading/scales";
import { isFrenchRouteGrade } from "@/lib/grading/route-grades";
import { LiveSession } from "./live-session";
import { RouteSession } from "./route-session";

type View = NonNullable<Awaited<ReturnType<typeof loadSessionView>>>;

export const ROUTE_ASCENT_COLUMNS =
  "id,session_id,client_id,route_name,grade,style,result,falls,wall_angle,created_at,route_project_id,native_grade,native_grade_system,tries,notes";

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
      initialProjects={projects ?? []} gymSystem={view.gym.route_grading === "GYM_COLOR" ? view.gym.grading_system : "FONT"}
      colourEquivalents={colourEquivalents} mode={mode} />;
  }

  // Boolder areas and outdoor sites with a team topo; null for a site without one.
  const outdoor = view.gym.brand === "OUTDOOR" ? await loadOutdoorAreaForGym(viewer.supabase, view.gym.id) : null;
  const known = outdoor ? await loadKnownTopoBoulders(viewer, view.gym.id, new Set(view.problems.map((p) => p.id))) : {};
  // The session's own scale (an old Climbing District session stays in colours), and the gym's other scales.
  const scales = gymScales(view.gym);
  return (
    <LiveSession
      sessionId={view.session.id}
      userId={viewer.userId}
      gym={{
        id: view.gym.id, name: view.gym.name, outdoor: view.gym.brand === "OUTDOOR",
        system: sessionBoulderSystem(view.session, scales), systems: boulderSystemsForGym(scales),
      }}
      startedAt={view.session.started_at}
      initialProblems={view.problems.map((p) => ({
        id: p.id,
        native_grade: p.native_grade,
        native_grade_system: p.native_grade_system,
        notes: p.notes,
        wall_angle: p.wall_angle as WallAngle,
        tags: tagSlugs(p) as StyleTag[],
        created_at: p.created_at,
        name: p.name,
        outdoor_problem_id: p.outdoor_problem_id,
      }))}
      outdoor={outdoor}
      known={known}
      // The logger tells fresh data from the copy kept for use without signal.
      renderedAt={new Date().toISOString()}
      initialAttempts={view.attempts}
      projectProblemIds={view.activeProjectProblemIds}
      projectsOpenedHere={view.projectsOpenedHere.map((p) => p.problemId)}
      mode={mode}
    />
  );
}

/**
 * The climber's topo boulders at this site that are not on screen (tried in
 * other sessions): picking one again keeps counting its tries, even without
 * signal.
 */
async function loadKnownTopoBoulders(viewer: Viewer, gymId: string, shown: Set<string>): Promise<Record<string, KnownBoulder>> {
  const { data } = await viewer.supabase.from("problems")
    .select("id, native_grade, name, outdoor_problem_id, attempts(attempt_number)")
    .eq("created_by", viewer.userId).eq("gym_id", gymId).not("outdoor_problem_id", "is", null);
  const out: Record<string, KnownBoulder> = {};
  for (const p of data ?? []) {
    if (p.outdoor_problem_id == null || shown.has(p.id)) continue;
    const numbers = (p.attempts ?? []).map((a) => a.attempt_number);
    out[String(p.outdoor_problem_id)] = {
      id: p.id, grade: p.native_grade, name: p.name, tries: numbers.length, lastNumber: numbers.length ? Math.max(...numbers) : 0,
    };
  }
  return out;
}
