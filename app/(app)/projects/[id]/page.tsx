import Link from "next/link";
import { notFound } from "next/navigation";
import { GradeChip } from "@/components/climbing/grade-chip";
import { LinkButton } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { requireViewer } from "@/lib/auth/viewer";
import { formatDate, formatDateTime } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { MEDIA_BUCKET } from "@/lib/media";
import { ProjectForm } from "./project-form";

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  const viewer = await requireViewer();
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  const { data: project } = await viewer.supabase
    .from("projects")
    .select("*, problems(*, gyms(name))")
    .eq("id", id)
    .maybeSingle();
  if (!project || !project.problems) notFound();
  const problem = project.problems;

  const [{ data: attempts }, { data: videos }] = await Promise.all([
    viewer.supabase.from("attempts").select("*, sessions(started_at)").eq("problem_id", problem.id).order("attempt_number"),
    viewer.supabase
      .from("media")
      .select("*")
      .eq("problem_id", problem.id)
      .in("media_type", ["ATTEMPT_VIDEO", "SEND_VIDEO"])
      .order("created_at", { ascending: false }),
  ]);
  const signed = videos?.length
    ? (await viewer.supabase.storage.from(MEDIA_BUCKET).createSignedUrls(videos.map((v) => v.storage_path), 3600)).data
    : [];
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const sessions = new Map<string, string>();
  for (const a of attempts ?? []) if (a.sessions) sessions.set(a.session_id, a.sessions.started_at);

  return (
    <div className="space-y-5">
      <header>
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-accent">★ {t.problem.isProject}</p>
        <h1 className="mt-1 text-2xl font-black">{problem.name || t.problem.unnamed}</h1>
        <div className="mt-1 flex items-center gap-3">
          <GradeChip t={t} system={problem.native_grade_system} grade={problem.native_grade} size="lg" />
          <span className="text-sm text-ink-3">{problem.gyms?.name}</span>
        </div>
      </header>

      <Card className="grid grid-cols-3 gap-3">
        <Stat value={attempts?.length ?? 0} label={t.projects.attempts} />
        <Stat value={sessions.size} label={t.projects.sessions} />
        <Stat value={t.projects.status[project.status]} label={t.projects.setStatus} className="[&>div]:text-base" />
      </Card>

      <LinkButton href={`/patrick?project=${project.id}&q=project`} size="lg" className="w-full">
        {t.projects.askPatrick}
      </LinkButton>

      <Card>
        <SectionTitle>{t.projects.sessions}</SectionTitle>
        <ul className="mt-2 space-y-1 text-sm">
          {[...sessions.entries()].map(([sid, at]) => (
            <li key={sid}>
              <Link className="text-accent underline-offset-2 hover:underline" href={`/session/${sid}`}>
                {formatDateTime(at, locale)}
              </Link>{" "}
              · {(attempts ?? []).filter((a) => a.session_id === sid).length} × {t.results.ATTEMPT.toLowerCase()}
            </li>
          ))}
        </ul>
      </Card>

      {videos?.length ? (
        <Card>
          <SectionTitle>{t.problem.media}</SectionTitle>
          <ul className="mt-2 grid grid-cols-2 gap-2">
            {videos.map((v) =>
              urlByPath.get(v.storage_path) ? (
                <li key={v.id}>
                  <video src={urlByPath.get(v.storage_path)!} controls playsInline preload="metadata" className="aspect-square w-full rounded-xl object-cover" />
                  <p className="text-xs text-ink-3">{formatDate(v.created_at, locale)}</p>
                </li>
              ) : null,
            )}
          </ul>
        </Card>
      ) : null}

      <ProjectForm projectId={project.id} status={project.status} notes={project.notes ?? ""} />

      <Link href={`/problem/${problem.id}`} className="block text-sm text-accent underline-offset-2 hover:underline">
        {t.session.viewProblem} →
      </Link>
    </div>
  );
}
