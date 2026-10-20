import "server-only";
import { computeProblemOutcomes, computeSnapshot, countActivity, summarizeSession } from "@/lib/analytics";
import type { Viewer } from "@/lib/auth/viewer";
import { isSend } from "@/lib/climbing/types";
import { loadClimbingDataset } from "@/lib/data/climbing";
import { loadRouteAscents } from "@/lib/data/routes";
import { routeAscentsInLastDays, routeWorkingGrade, summarizeRoutes } from "@/lib/analytics/routes";
import { resolveNormalized } from "@/lib/grading";
import { buildCoachContext, type QuickAction, type RecentSessionInput } from "./context";

/**
 * Loads the climber's data (RLS-scoped to the viewer), runs the analytics
 * engine and assembles Patrick's bounded context.
 */
export async function assembleCoachContext(
  viewer: Viewer,
  opts: { sessionId?: string | null; projectId?: string | null; routeProjectId?: string | null; quickAction?: QuickAction | null },
) {
  const now = new Date();
  const [data, routeAscents] = await Promise.all([loadClimbingDataset(viewer.supabase), loadRouteAscents(viewer.supabase)]);
  const routes = routeAscents ?? [];
  const target = { grade: viewer.profile.target_grade, system: viewer.profile.target_grade_system };
  const snapshot30 = computeSnapshot(data, target, now, 30);
  const snapshot90 = computeSnapshot(data, target, now, 90);
  const gymById = new Map(data.gyms.map((g) => [g.id, g]));
  const problemById = new Map(data.problems.map((p) => [p.id, p]));

  const { data: sessionRows } = await viewer.supabase
    .from("sessions")
    .select("id, started_at, ended_at, gym_id, discipline, duration_minutes, perceived_energy_before, perceived_energy_after, fatigue, motivation, notes")
    .order("started_at", { ascending: false })
    .limit(8);

  const recentSessions: RecentSessionInput[] = (sessionRows ?? []).map((s) => {
    const fact = data.sessions.find((x) => x.id === s.id);
    const c = countActivity(data.attempts.filter((a) => a.sessionId === s.id));
    const g = gymById.get(s.gym_id);
    const rs = s.discipline === "ROUTE" ? summarizeRoutes(routes.filter((a) => a.sessionId === s.id)) : null;
    return {
      id: s.id,
      discipline: s.discipline,
      routes: rs ? { climbed: rs.ascents, clean: rs.clean, onsights: rs.onsights, hardestClean: rs.highestClean?.grade ?? null } : null,
      startedAt: s.started_at,
      gymName: g?.name ?? "",
      gymBrand: g?.brand ?? "OTHER",
      durationMinutes: s.duration_minutes,
      ...c,
      energyBefore: s.perceived_energy_before,
      energyAfter: s.perceived_energy_after,
      fatigue: s.fatigue,
      motivation: s.motivation,
      wearable: fact?.wearable
        ? {
            avgHeartRate: fact.wearable.avgHeartRate,
            maxHeartRate: fact.wearable.maxHeartRate,
            trainingLoad: fact.wearable.trainingLoad,
            device: fact.wearable.deviceName,
          }
        : null,
    };
  });

  // Focus session: explicitly requested, or the last completed one (either discipline) for "analyse my last session".
  let focusSessionId = opts.sessionId ?? null;
  if (!focusSessionId && opts.quickAction === "lastSession") {
    focusSessionId = (sessionRows ?? []).find((s) => s.ended_at)?.id ?? null;
  }
  // Route sessions are analysed from route ascents, never through the bouldering dataset.
  let focusRouteSession = null;
  let routeFocusRow = focusSessionId ? sessionRows?.find((s) => s.id === focusSessionId) : undefined;
  if (focusSessionId && !routeFocusRow) {
    const { data: row } = await viewer.supabase.from("sessions").select("id, started_at, ended_at, gym_id, discipline, notes")
      .eq("id", focusSessionId).maybeSingle();
    if (row?.discipline === "ROUTE") routeFocusRow = { ...row, duration_minutes: null, perceived_energy_before: null,
      perceived_energy_after: null, fatigue: null, motivation: null };
  }
  if (routeFocusRow?.discipline === "ROUTE") {
    const { data: rows } = await viewer.supabase.from("route_ascents")
      .select("grade, style, result, falls, route_projects(route_name)").eq("session_id", routeFocusRow.id).order("created_at");
    const sessionAscents = routes.filter((a) => a.sessionId === routeFocusRow!.id);
    focusRouteSession = {
      gymName: gymById.get(routeFocusRow.gym_id)?.name ?? "",
      startedAt: routeFocusRow.started_at,
      ended: routeFocusRow.ended_at !== null,
      notes: routeFocusRow.notes ?? null,
      summary: summarizeRoutes(sessionAscents),
      ascents: (rows ?? []).map((a) => ({ grade: a.grade, style: a.style, result: a.result, falls: a.falls,
        project: a.route_projects?.route_name ?? null })),
    };
    focusSessionId = null;
  }
  const focus = focusSessionId ? data.sessions.find((s) => s.id === focusSessionId) : undefined;
  const focusRow = sessionRows?.find((s) => s.id === focusSessionId);
  const focusSession = focus
    ? (() => {
        const sessionAttempts = data.attempts.filter((a) => a.sessionId === focus.id);
        const outcomes = computeProblemOutcomes(sessionAttempts);
        const gym = gymById.get(focus.gymId);
        return {
          id: focus.id,
          gymName: gym?.name ?? "",
          gymBrand: gym?.brand ?? "OTHER",
          startedAt: focus.startedAt.toISOString(),
          ended: focus.endedAt !== null,
          notes: focusRow?.notes ?? null,
          summary: summarizeSession(focus, data.problems, data.attempts),
          problems: [...outcomes.values()].map((o) => {
            const p = problemById.get(o.problemId)!;
            const est = resolveNormalized(p);
            return {
              grade: p.nativeGrade,
              system: p.nativeGradeSystem,
              fontEstimate: est && p.nativeGradeSystem !== "FONT" ? { grade: est.grade, confidence: est.confidence } : null,
              wallAngle: p.wallAngle,
              styles: p.tags,
              attemptsThisSession: o.attempts,
              result: o.flashed ? ("FLASH" as const) : o.sent ? ("TOP" as const) : ("NOT_SENT" as const),
              totalAttemptsEver: data.attempts.filter((a) => a.problemId === p.id).length,
            };
          }),
        };
      })()
    : null;

  const { data: projects } = await viewer.supabase
    .from("projects")
    .select("id, status, started_at, notes, problem_id")
    .order("started_at", { ascending: false });
  const activeProjects = (projects ?? [])
    .filter((p) => p.status === "ACTIVE")
    .map((p) => {
      const pr = problemById.get(p.problem_id);
      return {
        grade: pr?.nativeGrade ?? "",
        system: pr?.nativeGradeSystem ?? "UNKNOWN",
        attempts: data.attempts.filter((a) => a.problemId === p.problem_id).length,
        gymName: (pr && gymById.get(pr.gymId)?.name) ?? "",
      };
    });

  // Route projects (separate from boulder projects).
  const { data: routeProjectRows } = await viewer.supabase.from("route_projects")
    .select("id, route_name, grade, goal_style, status, notes, started_at, sent_at, gym_id").order("started_at", { ascending: false });
  let routeProjectId = opts.routeProjectId ?? null;
  let projectId = opts.projectId ?? null;
  if (!projectId && !routeProjectId && opts.quickAction === "project") {
    projectId = projects?.find((p) => p.status === "ACTIVE")?.id ?? null;
    if (!projectId) routeProjectId = routeProjectRows?.find((p) => p.status === "ACTIVE")?.id ?? null;
  }
  const { data: projectGoes } = await viewer.supabase.from("route_ascents")
    .select("route_project_id, session_id, style, result, falls, created_at").not("route_project_id", "is", null).order("created_at");
  const activeRouteProjects = (routeProjectRows ?? []).filter((p) => p.status === "ACTIVE").map((p) => ({
    name: p.route_name, grade: p.grade, goalStyle: p.goal_style, gymName: gymById.get(p.gym_id)?.name ?? "",
    goes: (projectGoes ?? []).filter((g) => g.route_project_id === p.id).length,
  }));
  const routeProject = routeProjectId ? routeProjectRows?.find((p) => p.id === routeProjectId) : undefined;
  const goes = routeProject ? (projectGoes ?? []).filter((g) => g.route_project_id === routeProject.id) : [];
  const focusRouteProject = routeProject
    ? {
        name: routeProject.route_name, grade: routeProject.grade, goalStyle: routeProject.goal_style, status: routeProject.status,
        gymName: gymById.get(routeProject.gym_id)?.name ?? "", startedAt: routeProject.started_at, sentAt: routeProject.sent_at,
        notes: routeProject.notes,
        goes: goes.map((g, i) => ({ n: i + 1, date: g.created_at.slice(0, 10), style: g.style, result: g.result, falls: g.falls })),
        sessionsCount: new Set(goes.map((g) => g.session_id)).size,
      }
    : null;
  const project = projectId ? projects?.find((p) => p.id === projectId) : undefined;
  let focusProject = null;
  if (project) {
    const pr = problemById.get(project.problem_id);
    const pa = data.attempts.filter((a) => a.problemId === project.problem_id).sort((a, b) => a.attemptNumber - b.attemptNumber);
    const { count: videos } = await viewer.supabase
      .from("media")
      .select("id", { count: "exact", head: true })
      .eq("problem_id", project.problem_id)
      .neq("media_type", "PROBLEM_PHOTO");
    if (pr) {
      focusProject = {
        status: project.status,
        startedAt: project.started_at,
        notes: project.notes,
        grade: pr.nativeGrade,
        system: pr.nativeGradeSystem,
        gymName: gymById.get(pr.gymId)?.name ?? "",
        wallAngle: pr.wallAngle,
        styles: pr.tags,
        attempts: pa.map((a) => ({ n: a.attemptNumber, result: isSend(a.result) ? a.result : "ATTEMPT", date: a.createdAt.toISOString().slice(0, 10) })),
        sessionsCount: new Set(pa.map((a) => a.sessionId)).size,
        videos: videos ?? 0,
      };
    }
  }

  return buildCoachContext({
    climber: {
      name: viewer.profile.display_name,
      language: viewer.profile.preferred_language === "en" ? "en" : "fr",
      target,
    },
    snapshot30,
    snapshot90,
    recentSessions,
    focusSession,
    focusProject,
    activeProjects,
    routeClimbing: routes.length
      ? {
          last30: summarizeRoutes(routeAscentsInLastDays(routes, 30, now)),
          last90: summarizeRoutes(routeAscentsInLastDays(routes, 90, now)),
          leadWorkingGrade: routeWorkingGrade(routes, now),
        }
      : null,
    focusRouteSession,
    focusRouteProject,
    activeRouteProjects,
    quickAction: opts.quickAction ?? null,
    now,
  });
}
