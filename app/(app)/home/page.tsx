import Link from "next/link";
import { PatrickAvatar } from "@/components/brand/wordmark";
import { WorkingLevelLine } from "@/components/climbing/working-level";
import { LinkButton } from "@/components/ui/button";
import { Card, EmptyState, SectionTitle } from "@/components/ui/card";
import { Explain, Stat } from "@/components/ui/stat";
import { computeSnapshot } from "@/lib/analytics";
import { requireViewer } from "@/lib/auth/viewer";
import { loadClimbingDataset } from "@/lib/data/climbing";
import { gradeLabel } from "@/lib/grading/labels";
import { fmt } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "Accueil" };

export default async function HomePage() {
  const viewer = await requireViewer();
  const { t } = await getI18n(viewer.profile.preferred_language);
  const now = new Date();
  const data = await loadClimbingDataset(viewer.supabase);
  const target = { grade: viewer.profile.target_grade, system: viewer.profile.target_grade_system };
  const snap = computeSnapshot(data, target, now, 30);
  const live = data.sessions.find((s) => s.endedAt === null);
  const gymName = (id: string) => data.gyms.find((g) => g.id === id)?.name ?? "";
  const { data: projects } = await viewer.supabase
    .from("projects")
    .select("id, problems(name, native_grade, native_grade_system)")
    .eq("status", "ACTIVE")
    .limit(3);

  const targetLabel = gradeLabel(t, target.system, target.grade).toUpperCase();
  const hasData = data.attempts.length > 0;
  const weakest = snap.focus.styles.weakest;
  const suggestion = !hasData
    ? t.home.suggestFirst
    : weakest
      ? fmt(t.home.suggestFocus, { style: t.styles[weakest.key], sent: weakest.sent, problems: weakest.problems })
      : t.home.suggestTags;
  const trendScale = target.system === "FONT" ? "FONT_NORMALIZED" : target.system;
  const trend = snap.trends.find((tr) => tr.scale === trendScale) ?? snap.trends.find((tr) => tr.direction !== "insufficient_data");

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-black">{fmt(t.home.hello, { name: viewer.profile.display_name })}</h1>

      {live ? (
        <LinkButton href={`/session/${live.id}`} size="lg" className="w-full">
          ● {t.home.liveSession} — {gymName(live.gymId)}
        </LinkButton>
      ) : null}

      <Card>
        <p className="text-sm font-black tracking-[0.18em] text-accent">{fmt(t.home.roadTo, { target: targetLabel })}</p>
        <div className="mt-4 space-y-3">
          <div>
            <SectionTitle>{t.home.workingLevel}</SectionTitle>
            {snap.workingLevels.length ? (
              <ul className="mt-1 space-y-1">
                {snap.workingLevels.map((w) => (
                  <li key={w.system} className="flex flex-wrap items-center gap-2">
                    <span className="text-sm text-ink-2">{t.grades.systems[w.system as keyof typeof t.grades.systems]} :</span>
                    <WorkingLevelLine t={t} result={w} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-ink-3">{t.home.notEnough}</p>
            )}
          </div>
          <div>
            <SectionTitle>{t.home.workingGradeFont}</SectionTitle>
            <p className="mt-1 font-bold">
              {snap.workingGrade.level ? `${snap.workingGrade.level} (${t.common.estimate})` : <span className="text-sm font-normal text-ink-3">{t.home.notEnough}</span>}
            </p>
          </div>
          <div>
            <SectionTitle>{t.home.trend}</SectionTitle>
            <p className="mt-1 font-bold">{t.trend[trend?.direction ?? "insufficient_data"]}</p>
          </div>
          <dl className="divide-y divide-line border-t border-line pt-1 text-sm">
            {snap.roadToTarget.dimensions.map((d) => (
              <div key={d.key} className="flex justify-between gap-2 py-1.5">
                <dt className="text-ink-2">{t.dimensions[d.key]}</dt>
                <dd className="font-semibold">{t.dimensions.status[d.status]}</dd>
              </div>
            ))}
          </dl>
          <Explain summary={t.common.howCalculated}>
            <p>{t.progress.workingRule}</p>
            <p className="mt-2">{t.progress.trendExplain}</p>
            <p className="mt-2">{t.dimensions.explain}</p>
          </Explain>
        </div>
      </Card>

      {hasData ? (
        <Card>
          <SectionTitle>{t.home.last30}</SectionTitle>
          <div className="mt-3 grid grid-cols-4 gap-3">
            <Stat value={snap.counts.sessions} label={t.home.sessions} />
            <Stat value={snap.counts.problems} label={t.home.problems} />
            <Stat value={snap.counts.tops} label={t.home.tops} />
            <Stat value={snap.counts.flashes} label={t.home.flashes} />
          </div>
          {weakest ? (
            <p className="mt-4 text-sm">
              <span className="font-semibold">{t.home.currentFocus} :</span> {t.styles[weakest.key]}
            </p>
          ) : null}
        </Card>
      ) : (
        <EmptyState
          title={t.home.emptyTitle}
          body={t.home.emptyBody}
          action={!live ? <LinkButton href="/session/new" size="lg">{t.session.start}</LinkButton> : undefined}
        />
      )}

      {projects?.length ? (
        <Card>
          <SectionTitle>{t.home.activeProjects}</SectionTitle>
          <ul className="mt-2 space-y-1">
            {projects.map((p) => (
              <li key={p.id}>
                <Link href={`/projects/${p.id}`} className="text-sm text-accent underline-offset-2 hover:underline">
                  ★ {p.problems?.name || t.problem.unnamed}
                  {p.problems ? ` · ${gradeLabel(t, p.problems.native_grade_system, p.problems.native_grade)}` : ""}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      ) : null}

      <Card className="flex gap-3">
        <PatrickAvatar />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">{t.home.patrickSays}</p>
          <p className="mt-1 text-ink">“{suggestion}”</p>
          <p className="mt-1 text-xs text-ink-3">{t.home.suggestNote}</p>
          <LinkButton href="/patrick" variant="secondary" className="mt-3">
            {t.home.askPatrick}
          </LinkButton>
        </div>
      </Card>
    </div>
  );
}
