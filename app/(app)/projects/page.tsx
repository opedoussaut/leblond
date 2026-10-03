import Link from "next/link";
import { GradeChip } from "@/components/climbing/grade-chip";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth/viewer";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "Projets" };

export default async function ProjectsPage() {
  const viewer = await requireViewer();
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  const { data: projects } = await viewer.supabase
    .from("projects")
    .select("id, status, started_at, problem_id, problems(name, native_grade, native_grade_system, gyms(name))")
    .order("status")
    .order("started_at", { ascending: false });
  const ids = (projects ?? []).map((p) => p.problem_id);
  const { data: attempts } = ids.length
    ? await viewer.supabase.from("attempts").select("problem_id").in("problem_id", ids)
    : { data: [] };

  return (
    <div>
      <PageHeader title={t.projects.title} />
      {projects?.length ? (
        <ul className="space-y-2">
          {projects.map((p) => (
            <li key={p.id}>
              <Link href={`/projects/${p.id}`} className="block rounded-2xl border border-line bg-surface p-4 hover:bg-surface-2">
                <div className="flex items-center justify-between gap-2">
                  {p.problems ? (
                    <GradeChip t={t} system={p.problems.native_grade_system} grade={p.problems.native_grade} />
                  ) : null}
                  <span className="text-xs font-bold uppercase tracking-wider text-ink-3">{t.projects.status[p.status]}</span>
                </div>
                <p className="mt-1 font-semibold">{p.problems?.name || t.problem.unnamed}</p>
                <p className="text-sm text-ink-3">
                  {p.problems?.gyms?.name} · {fmt(t.projects.since, { date: formatDate(p.started_at, locale) })} ·{" "}
                  {fmt(t.session.attemptsShort, { n: (attempts ?? []).filter((a) => a.problem_id === p.problem_id).length })}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState body={t.projects.empty} />
      )}
    </div>
  );
}
