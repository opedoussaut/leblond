import Link from "next/link";
import { BoardProjectsSection } from "@/components/climbing/board-projects-section";
import { loadBoardProjects } from "@/lib/data/boards";
import { GradeChip } from "@/components/climbing/grade-chip";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { requireViewer } from "@/lib/auth/viewer";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { listGymsWithFavourites } from "@/lib/data/gyms";
import { routeDictionary } from "@/lib/i18n/routes";
import { listOutdoorAreas, listOutdoorSites } from "@/lib/data/outdoor";
import { projectPlace } from "@/lib/climbing/outdoor-projects";
import { outdoorProjectsDictionary } from "@/lib/i18n/outdoor-projects";
import { OutdoorBoulderProjectForm } from "./boulder-project-form";
import { RouteProjectForm } from "./route-project-form";

export const metadata = { title: "Projets" };

export default async function ProjectsPage() {
  const viewer = await requireViewer();
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  const { data: projects } = await viewer.supabase
    .from("projects")
    .select("id, status, started_at, problem_id, problems(name, native_grade, native_grade_system, wall_zone, gyms(name, brand))")
    .order("status")
    .order("started_at", { ascending: false });
  const ids = (projects ?? []).map((p) => p.problem_id);
  const { data: attempts } = ids.length
    ? await viewer.supabase.from("attempts").select("problem_id").in("problem_id", ids)
    : { data: [] };
  const r = routeDictionary(locale);
  const d = outdoorProjectsDictionary(locale);
  const [{ data: routeProjects }, { data: routeGoes }, { gyms }, boardProjects, outdoorSites, bleauAreas] = await Promise.all([
    viewer.supabase.from("route_projects").select("id, route_name, grade, goal_style, status, started_at, sector, gyms(name, brand)")
      .order("status").order("started_at", { ascending: false }),
    viewer.supabase.from("route_ascents").select("route_project_id").not("route_project_id", "is", null),
    listGymsWithFavourites(viewer.supabase, viewer.userId),
    loadBoardProjects(viewer.supabase),
    listOutdoorSites(viewer.supabase),
    listOutdoorAreas(viewer.supabase),
  ]);
  const siteName = (g: { name: string; city: string | null }) => g.name + (g.city ? " · " + g.city : "");
  const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" });
  const boulderSites = {
    mine: outdoorSites.filter((g) => g.has_bouldering).map((g) => ({ id: g.id, name: siteName(g) })).sort(byName),
    bleau: bleauAreas.map((a) => ({ id: a.gym_id, name: a.name })).sort(byName),
  };
  const routeSites = { mine: outdoorSites.filter((g) => g.has_routes).map((g) => ({ id: g.id, name: siteName(g) })).sort(byName), bleau: [] };
  const routeGyms = gyms.filter((g) => g.has_routes)
    .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base", ignorePunctuation: true }))
    .map((g) => ({ id: g.id, name: g.name + (g.city ? " · " + g.city : "") }));

  return (
    <div>
      <PageHeader icon={<PAGE_ICONS.projects />} title={t.projects.title} />
      <h2 className="mb-3 text-lg font-bold">{r.boulderProjects}</h2>
      {projects?.length ? (
        <ul className="space-y-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/projects/${p.id}`} className="block rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2">
                <div className="flex items-center justify-between gap-2">
                  {p.problems ? (
                    <GradeChip t={t} system={p.problems.native_grade_system} grade={p.problems.native_grade} showFont />
                  ) : null}
                  <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{t.projects.status[p.status]}</span>
                </div>
                <p className="mt-1 font-semibold">{p.problems?.name || t.problem.unnamed}</p>
                <p className="text-sm text-ink-3">
                  {p.problems?.gyms?.brand === "OUTDOOR" ? <span className="font-semibold text-ink-2">{d.outdoorBadge} · </span> : null}
                  {projectPlace(p.problems?.gyms?.name, p.problems?.gyms?.brand === "OUTDOOR" ? p.problems?.wall_zone : null)} · {fmt(t.projects.since, { date: formatDate(p.started_at, locale) })} ·{" "}
                  {fmt(t.session.attemptsShort, { n: (attempts ?? []).filter((a) => a.problem_id === p.problem_id).length })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState body={t.projects.empty} />
      )}
      <details className="mt-3 rounded-2xl border border-line bg-surface p-4">
        <summary className="min-h-11 cursor-pointer font-bold text-accent">+ {d.newBoulderProject}</summary>
        <div className="mt-3"><OutdoorBoulderProjectForm sites={boulderSites} /></div>
      </details>

      <section aria-labelledby="route-projects" className="mt-8 space-y-3">
        <h2 id="route-projects" className="text-lg font-bold">{r.projectsTitle}</h2>
        {routeProjects?.length ? <ul className="space-y-2">
          {routeProjects.map((p) => <li key={p.id}>
            <Link href={`/projects/routes/${p.id}`} className="block rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-lg font-black tabular-nums">{p.grade}</span>
                <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{r.projectStatus[p.status]}</span>
              </div>
              <p className="mt-1 font-semibold">{p.route_name}</p>
              <p className="text-sm text-ink-3">
                {p.gyms?.brand === "OUTDOOR" ? <span className="font-semibold text-ink-2">{d.outdoorBadge} · </span> : null}
                {projectPlace(p.gyms?.name, p.sector)} · {r.styles[p.goal_style]} · {fmt(t.projects.since, { date: formatDate(p.started_at, locale) })} ·{" "}
                {(routeGoes ?? []).filter((g) => g.route_project_id === p.id).length} {r.ascents.toLowerCase()}
              </p>
            </Link>
          </li>)}
        </ul> : <p className="text-sm text-ink-2">{r.noProjects}</p>}
        <details className="rounded-2xl border border-line bg-surface p-4">
          <summary className="min-h-11 cursor-pointer font-bold text-accent">+ {r.newProject}</summary>
          <div className="mt-3"><RouteProjectForm gyms={routeGyms} sites={routeSites} /></div>
        </details>
      </section>

      <BoardProjectsSection supabase={viewer.supabase} locale={locale} projects={boardProjects} />
    </div>
  );
}
