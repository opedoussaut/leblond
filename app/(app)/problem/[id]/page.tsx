import Link from "next/link";
import { notFound } from "next/navigation";
import { GradeChip } from "@/components/climbing/grade-chip";
import { MediaUploader } from "@/components/climbing/media-uploader";
import { Button, LinkButton } from "@/components/ui/button";
import { Card, SectionTitle } from "@/components/ui/card";
import { createProject } from "@/lib/actions/projects";
import { computeProblemOutcomes } from "@/lib/analytics";
import { requireViewer } from "@/lib/auth/viewer";
import type { StyleTag } from "@/lib/climbing/types";
import { PROBLEM_SELECT, toAttemptFact } from "@/lib/data/climbing";
import { tagSlugs, type ProblemWithTags } from "@/lib/data/session";
import { formatDateTime } from "@/lib/format";
import { gradeMeaning } from "@/lib/grading/labels";
import { isMysteryGrade } from "@/lib/grading";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { MEDIA_BUCKET } from "@/lib/media";
import { AttemptHistory } from "./attempt-history";
import { MediaGallery } from "./media-gallery";
import { ProblemEditor } from "./problem-editor";

export default async function ProblemPage({ params }: PageProps<"/problem/[id]">) {
  const { id } = await params;
  const viewer = await requireViewer();
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  const { data } = await viewer.supabase.from("problems").select(PROBLEM_SELECT).eq("id", id).maybeSingle();
  if (!data) notFound();
  const problem = data as unknown as ProblemWithTags;

  const [{ data: gym }, { data: attempts }, { data: media }, { data: project }] = await Promise.all([
    viewer.supabase.from("gyms").select("name").eq("id", problem.gym_id).single(),
    viewer.supabase.from("attempts").select("*").eq("problem_id", id).order("attempt_number"),
    viewer.supabase.from("media").select("*").eq("problem_id", id).order("created_at", { ascending: false }),
    viewer.supabase.from("projects").select("id, status").eq("problem_id", id).maybeSingle(),
  ]);
  const signed = media?.length
    ? (await viewer.supabase.storage.from(MEDIA_BUCKET).createSignedUrls(media.map((m) => m.storage_path), 3600)).data
    : [];
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const outcome = computeProblemOutcomes((attempts ?? []).map(toAttemptFact)).get(id);
  const meaning = gradeMeaning(t, problem.native_grade_system, problem.native_grade);
  const lastSessionId = attempts?.at(-1)?.session_id ?? null;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-sm text-ink-3">
          {gym?.name} · {formatDateTime(problem.created_at, locale)}
        </p>
        <h1 className="text-2xl font-black">{problem.name || t.problem.unnamed}</h1>
        <div className="flex flex-wrap items-center gap-3">
          <GradeChip t={t} system={problem.native_grade_system} grade={problem.native_grade} size="lg" />
          {meaning ? <span className="text-sm text-ink-3">{meaning}</span> : null}
        </div>
        <p className="text-xs text-ink-3">{t.grades.nativeNote} · {t.grades.systems[problem.native_grade_system]}</p>
        {isMysteryGrade(problem.native_grade_system, problem.native_grade) ? (
          <p className="text-sm text-ink-2">{t.grades.mysteryHelp}</p>
        ) : null}
        <p className="pt-1 font-semibold">
          {outcome?.flashed
            ? t.problem.flashed
            : outcome?.attemptsToSend
              ? fmt(t.problem.sentIn, { n: outcome.attemptsToSend })
              : t.problem.notSent}
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        {project ? (
          <LinkButton href={`/projects/${project.id}`} variant="secondary">
            ★ {t.problem.openProject} ({t.projects.status[project.status]})
          </LinkButton>
        ) : (
          <form action={createProject.bind(null, id)}>
            <Button type="submit" variant="secondary">
              ★ {t.problem.makeProject}
            </Button>
          </form>
        )}
      </div>

      <Card>
        <SectionTitle>{t.problem.attemptsHistory}</SectionTitle>
        <AttemptHistory attempts={attempts ?? []} />
      </Card>

      <Card>
        <SectionTitle>{t.problem.media}</SectionTitle>
        <div className="mt-3 space-y-4">
          <MediaUploader userId={viewer.userId} problemId={id} sessionId={lastSessionId} />
          <MediaGallery
            items={(media ?? []).map((m) => ({
              id: m.id,
              type: m.media_type,
              mime: m.mime_type,
              url: urlByPath.get(m.storage_path) ?? null,
            }))}
          />
        </div>
      </Card>

      <ProblemEditor
        problem={{
          id: problem.id,
          system: problem.native_grade_system,
          name: problem.name ?? "",
          wallAngle: problem.wall_angle,
          wallZone: problem.wall_zone ?? "",
          setter: problem.setter ?? "",
          notes: problem.notes ?? "",
          tags: tagSlugs(problem) as StyleTag[],
          estimate:
            problem.normalized_grade && problem.normalization_confidence != null
              ? { grade: problem.normalized_grade, confidence: problem.normalization_confidence }
              : null,
        }}
      />

      {lastSessionId ? (
        <Link href={`/session/${lastSessionId}`} className="block text-sm text-accent underline-offset-2 hover:underline">
          ← {t.session.title}
        </Link>
      ) : null}
    </div>
  );
}
