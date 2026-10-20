import Link from "next/link";
import { notFound } from "next/navigation";
import { LinkButton } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { routeProjectProgress } from "@/lib/analytics/routes";
import { requireViewer } from "@/lib/auth/viewer";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { routeDictionary } from "@/lib/i18n/routes";
import { RouteProjectEditor } from "./route-project-editor";

export const metadata = { title: "Projet de voie" };

export default async function RouteProjectPage({ params }: PageProps<"/projects/routes/[id]">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const viewer = await requireViewer();
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  const r = routeDictionary(locale);
  const { data: project } = await viewer.supabase.from("route_projects")
    .select("id, route_name, grade, goal_style, status, notes, started_at, sent_at, gyms(name)").eq("id", id).maybeSingle();
  if (!project) notFound();
  const { data: rows } = await viewer.supabase.from("route_ascents")
    .select("id, session_id, grade, style, result, falls, created_at").eq("route_project_id", id).order("created_at");
  const ascents = (rows ?? []).map((a) => ({ id: a.id, sessionId: a.session_id, grade: a.grade, style: a.style,
    result: a.result, falls: a.falls, createdAt: new Date(a.created_at) }));
  const progress = routeProjectProgress(ascents);

  return <div className="space-y-5">
    <Link href="/projects" className="text-sm font-bold text-accent underline underline-offset-4">← {t.projects.title}</Link>
    <header>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">★ {r.projectsTitle} · {r.projectStatus[project.status]}</p>
      <h1 className="mt-1 text-2xl font-black tracking-tight">{project.route_name}</h1>
      <p className="mt-1 text-sm text-ink-2">
        <strong className="text-lg tabular-nums text-ink">{project.grade}</strong> · {project.gyms?.name} · {r.goalStyle} : {r.styles[project.goal_style]}
      </p>
      <p className="text-xs text-ink-3">{fmt(t.projects.since, { date: formatDate(project.started_at, locale) })}
        {project.sent_at ? ` · ${r.projectStatus.SENT} ${formatDate(project.sent_at, locale)}` : ""}</p>
    </header>

    <Card className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <Stat value={progress.ascents} label={r.ascents} />
      <Stat value={progress.sessions} label={r.sessions} />
      <Stat value={progress.bestResult ? r.results[progress.bestResult] : "—"} label={r.best} className="[&>div]:text-base" />
      <Stat value={progress.firstFalls === null ? "—" : `${progress.firstFalls} → ${progress.latestFalls}`} label={r.fallsTrend} />
    </Card>

    <LinkButton href={`/patrick?routeProject=${project.id}&q=project`} size="lg" className="w-full">{r.askPatrick}</LinkButton>

    <section aria-labelledby="route-project-history" className="space-y-2">
      <SectionTitle><span id="route-project-history">{r.history}</span></SectionTitle>
      {ascents.length === 0 ? <p className="text-sm text-ink-3">{r.noneYet} {r.logHereHint}</p> :
        <ol className="space-y-2">
          {ascents.map((a, i) => <li key={a.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-sm">
            <span><span className="text-ink-3 tabular-nums">#{i + 1}</span> <strong>{r.results[a.result]}</strong>
              <span className="ml-2 text-ink-2">{r.styles[a.style]}{a.falls ? ` · ${a.falls} ${r.falls.toLowerCase()}` : ""}</span></span>
            <Link href={`/session/${a.sessionId}`} className="text-xs font-semibold text-accent underline">{formatDate(a.createdAt, locale)}</Link>
          </li>)}
        </ol>}
      <p className="text-xs text-ink-3">{r.autoSentRule}</p>
    </section>

    <RouteProjectEditor project={{ id: project.id, grade: project.grade, goalStyle: project.goal_style, status: project.status, notes: project.notes }} />
  </div>;
}
