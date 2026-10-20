import { notFound } from "next/navigation";
import type { StyleTag, WallAngle } from "@/lib/climbing/types";
import { requireViewer } from "@/lib/auth/viewer";
import { loadOutdoorAreaForGym } from "@/lib/data/outdoor";
import { loadSessionView, tagSlugs } from "@/lib/data/session";
import { LiveSession } from "./live-session";
import { SessionSummaryView } from "./summary";
import { RouteSession } from "./route-session";
import { RouteSessionSummary } from "./route-summary";
import type { RouteAscentRow } from "@/lib/actions/routes";
import { isFrenchRouteGrade } from "@/lib/grading/route-grades";
import { getI18n } from "@/lib/i18n/server";

export default async function SessionPage({ params }: PageProps<"/session/[id]">) {
  const { id } = await params;
  const viewer = await requireViewer();
  const view = await loadSessionView(viewer.supabase, id);
  if (!view) notFound();

  if (view.session.discipline === "ROUTE") {
    const { locale } = await getI18n(viewer.profile.preferred_language);
    const { data } = await viewer.supabase.from("route_ascents")
      .select("id,session_id,client_id,route_name,grade,style,result,falls,wall_angle,created_at,route_project_id")
      .eq("session_id", view.session.id).order("created_at", { ascending: false });
    const ascents = (data ?? []) as RouteAscentRow[];
    if (!view.session.ended_at) {
      const level = viewer.profile.self_reported_route_grade;
      const defaultGrade = (ascents[0]?.grade ?? (level && isFrenchRouteGrade(level) ? level : "6a")) as "6a";
      const { data: projects } = await viewer.supabase.from("route_projects").select("id, route_name, grade, goal_style")
        .eq("gym_id", view.gym.id).eq("status", "ACTIVE").order("started_at", { ascending: false });
      return <RouteSession sessionId={view.session.id} gymId={view.gym.id}
        gymName={view.gym.name} startedAt={view.session.started_at}
        initialAscents={ascents} defaultGrade={defaultGrade} initialProjects={projects ?? []} />;
    }
    return <RouteSessionSummary locale={locale} session={view.session} gymName={view.gym.name} ascents={ascents} />;
  }

  if (!view.session.ended_at) {
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
      />
    );
  }
  return <SessionSummaryView viewer={viewer} view={view} />;
}
