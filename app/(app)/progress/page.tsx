import Link from "next/link";
import { RatioBars } from "@/components/charts/ratio-bars";
import { WeeklyBars } from "@/components/charts/weekly-bars";
import { GradeChip } from "@/components/climbing/grade-chip";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui/card";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { cn } from "@/components/ui/cn";
import { Explain, Stat } from "@/components/ui/stat";
import { computeSnapshot, MIN_RELIABLE_FOR_NORMALIZED_VIEW } from "@/lib/analytics";
import { requireViewer } from "@/lib/auth/viewer";
import type { GradeSystem } from "@/lib/climbing/types";
import { loadClimbingDataset } from "@/lib/data/climbing";
import { loadRouteAscents } from "@/lib/data/routes";
import { RouteStats } from "@/components/climbing/route-stats";
import { formatDate, formatNumber, formatRatio } from "@/lib/format";
import { fmt, plural, type Dictionary } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "Progrès" };

const PERIODS = { "30": 30, "90": 90, all: null } as const;

export default async function ProgressPage({ searchParams }: PageProps<"/progress">) {
  const viewer = await requireViewer();
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  const sp = await searchParams;
  const periodKey = (typeof sp.period === "string" && sp.period in PERIODS ? sp.period : "90") as keyof typeof PERIODS;
  const [data, routes] = await Promise.all([loadClimbingDataset(viewer.supabase), loadRouteAscents(viewer.supabase)]);
  const now = new Date();
  const snap = computeSnapshot(
    data,
    { grade: viewer.profile.target_grade, system: viewer.profile.target_grade_system },
    new Date(),
    PERIODS[periodKey],
  );
  const gymName = new Map(data.gyms.map((g) => [g.id, g.name]));

  return (
    <div className="space-y-5">
      <PageHeader icon={<PAGE_ICONS.climbingProgress />} title={t.progress.title} />
      <nav aria-label={t.progress.period} className="flex gap-2">
        {(Object.keys(PERIODS) as Array<keyof typeof PERIODS>).map((k) => (
          <Link
            key={k}
            href={`/progress?period=${k}`}
            aria-current={k === periodKey ? "page" : undefined}
            className={cn(
              "min-h-11 rounded-full border px-4 py-2.5 text-sm font-semibold",
              k === periodKey ? "border-accent bg-accent-soft" : "border-line text-ink-2",
            )}
          >
            {k === "30" ? t.progress.last30 : k === "90" ? t.progress.last90 : t.progress.all}
          </Link>
        ))}
      </nav>

      {snap.counts.attempts === 0 ? (
        <EmptyState body={t.progress.empty} />
      ) : (
        <>
          <Card>
            <SectionTitle>{t.progress.overview}</SectionTitle>
            <div className="mt-3 grid grid-cols-3 gap-4">
              <Stat value={snap.counts.sessions} label={t.progress.sessions} />
              <Stat value={snap.counts.problems} label={t.progress.problems} />
              <Stat value={snap.counts.attempts} label={t.progress.attempts} />
            </div>
            <dl className="mt-4 divide-y divide-line text-sm">
              {(
                [
                  [t.progress.sendRate, formatRatio(snap.sendRate)],
                  [t.progress.flashRate, formatRatio(snap.flashRate)],
                  [
                    t.progress.attemptsPerSend,
                    snap.attemptsPerSend.value === null
                      ? "—"
                      : `${formatNumber(snap.attemptsPerSend.value)} (${snap.attemptsPerSend.attempts}/${snap.attemptsPerSend.sends})`,
                  ],
                  [t.progress.topsPerSession, formatNumber(snap.topsPerSession.mean)],
                ] as const
              ).map(([k, v]) => (
                <div key={k} className="flex justify-between py-2">
                  <dt className="text-ink-2">{k}</dt>
                  <dd className="font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </Card>

          <Card>
            <SectionTitle>{t.progress.weekly}</SectionTitle>
            <div className="mt-3">
              <WeeklyBars
                weeks={snap.weekly}
                locale={locale}
                labels={{
                  tops: t.progress.weeklyTops,
                  sessions: t.progress.weeklySessions,
                  caption: t.progress.weekly,
                  range: t.progress.weeklyRange,
                  help: t.progress.weeklyHelp,
                  weekOf: t.progress.weeklyWeekOf,
                }}
              />
            </div>
          </Card>

          <Card>
            <SectionTitle>{t.progress.workingLevel}</SectionTitle>
            <ul className="mt-2 space-y-3">
              {snap.workingLevels.map((w) => (
                <li key={w.system}>
                  <p className="text-sm text-ink-2">{t.grades.systems[w.system as GradeSystem]}</p>
                  <p className="mt-0.5 font-bold">
                    {w.level ? <GradeChip t={t} system={w.system as GradeSystem} grade={w.level} showFont /> : t.home.notEnough}
                  </p>
                  <GradeCounts
                    t={t}
                    system={w.system as GradeSystem}
                    rows={w.levels.map((l) => ({ grade: l.grade, sent: l.sends, attempted: l.problems }))}
                  />
                </li>
              ))}
              <li>
                <p className="text-sm text-ink-2">{t.home.workingGradeFont}</p>
                <p className="font-bold">
                  {snap.workingGrade.level ? `${snap.workingGrade.level} (${t.common.estimate})` : t.home.notEnough}
                </p>
              </li>
            </ul>
            <div className="mt-4 grid grid-cols-2 gap-4 border-t border-line pt-3">
              {(
                [
                  [t.progress.highestSent, snap.highestSent],
                  [t.progress.highestFlashed, snap.highestFlashed],
                  [t.progress.highestUnsent, snap.highestUnsent],
                ] as const
              ).map(([title, best]) => (
                <div key={title}>
                  <p className="text-xs uppercase tracking-[0.12em] text-ink-3">{title}</p>
                  {best.length === 0 ? <p className="mt-2 text-sm text-ink-3">—</p> : null}
                  <ul className="mt-2 space-y-2">
                    {best.map((h) => (
                      <li key={h.system}>
                        <span className="block text-xs text-ink-3">{t.grades.systems[h.system]}</span>
                        <GradeChip t={t} system={h.system} grade={h.grade} className="mt-0.5" />
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <Explain summary={t.common.howCalculated}>{t.progress.workingRule}</Explain>
          </Card>

          <Card>
            <SectionTitle>{t.progress.trend}</SectionTitle>
            <ul className="mt-2 space-y-1 text-sm">
              {snap.trends.map((tr) => (
                <li key={tr.scale} className="flex justify-between gap-2">
                  <span className="text-ink-2">
                    {tr.scale === "FONT_NORMALIZED" ? t.home.workingGradeFont : t.grades.systems[tr.scale]}
                  </span>
                  <span className="font-semibold">{t.trend[tr.direction]}</span>
                </li>
              ))}
            </ul>
            <Explain summary={t.common.howCalculated}>{t.progress.trendExplain}</Explain>
          </Card>

          <Card>
            <SectionTitle>{t.progress.crossGym}</SectionTitle>
            <h3 className="mt-3 font-bold">{t.progress.nativeView}</h3>
            <p className="text-xs text-ink-3">{t.progress.nativeViewHelp}</p>
            <div className="mt-3 space-y-4">
              {snap.crossGym.native.map((n) => (
                <div key={n.brand}>
                  <p className="mb-2 text-sm font-semibold">{t.brands[n.brand]}</p>
                  {n.distributions.map((d) => (
                    <div key={d.system}>
                      {/* A network with two scales (Climbing District colours / levels): one block each, never merged. */}
                      {n.distributions.length > 1 ? <p className="mb-1 mt-2 text-xs text-ink-3">{t.grades.systems[d.system]}</p> : null}
                      <RatioBars
                        rows={d.buckets.map((b) => ({
                          key: `${d.system}-${b.grade}`,
                          label: <GradeChip t={t} system={d.system} grade={b.grade} size="sm" />,
                          sent: b.sent,
                          attempted: b.attempted,
                        }))}
                      />
                    </div>
                  ))}
                </div>
              ))}
            </div>
            <h3 className="mt-5 font-bold">{t.progress.normalizedView}</h3>
            <p className="text-xs text-ink-3">
              {fmt(t.progress.normalizedHelp, snap.crossGym.normalized.coverage)}
            </p>
            <div className="mt-3">
              {snap.crossGym.normalized.sufficient ? (
                <RatioBars
                  rows={snap.crossGym.normalized.buckets.map((b) => ({
                    key: b.grade,
                    label: `${b.grade} (${t.common.estimate})`,
                    sent: b.sent,
                    attempted: b.attempted,
                  }))}
                />
              ) : (
                <p className="text-sm text-ink-2">
                  {fmt(t.progress.normalizedInsufficient, {
                    reliable: snap.crossGym.normalized.coverage.reliable,
                    min: MIN_RELIABLE_FOR_NORMALIZED_VIEW,
                  })}
                </p>
              )}
            </div>
          </Card>

          <Card>
            <SectionTitle>{t.progress.byGym}</SectionTitle>
            <ul className="mt-2 divide-y divide-line text-sm">
              {snap.gymBreakdown.map((g) => (
                <li key={g.gym.id} className="space-y-1.5 py-3">
                  <div className="flex justify-between gap-2">
                    <span className="font-semibold">{gymName.get(g.gym.id)}</span>
                    <span className="text-ink-3">{t.brands[g.gym.brand]}</span>
                  </div>
                  <p className="tabular-nums text-ink-2">
                    {plural(locale, g.sessions, t.progress.sessionCount)} · {plural(locale, g.problems, t.progress.problemCount)}
                    {" · "}
                    {t.progress.sendRate} {formatRatio(g.sendRate)}
                  </p>
                  {g.distributions.map((d) => (
                    <GradeCounts
                      key={d.system}
                      t={t}
                      system={d.system}
                      label={g.distributions.length > 1 ? t.grades.systems[d.system] : undefined}
                      rows={d.buckets.map((b) => ({ grade: b.grade, sent: b.sent, attempted: b.attempted }))}
                    />
                  ))}
                </li>
              ))}
            </ul>
          </Card>

          <Card>
            <SectionTitle>{t.progress.byStyle}</SectionTitle>
            <div className="mt-3">
              {snap.styleStats.length ? (
                <RatioBars
                  rows={snap.styleStats.map((s) => ({ key: s.key, label: t.styles[s.key], sent: s.sent, attempted: s.problems }))}
                />
              ) : (
                <p className="text-sm text-ink-2">{t.progress.noTags}</p>
              )}
            </div>
            <h3 className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{t.progress.byAngle}</h3>
            <div className="mt-3">
              <RatioBars
                rows={snap.wallAngleStats.map((s) => ({
                  key: s.key,
                  label: t.wallAngles[s.key],
                  sent: s.sent,
                  attempted: s.problems,
                }))}
              />
            </div>
          </Card>

          {snap.wearable.sessions.length ? (
            <Card>
              <details>
                <summary className="cursor-pointer text-xs font-bold uppercase tracking-[0.12em] text-ink-3">
                  {t.progress.wearableOverlay}
                </summary>
                <ul className="mt-3 divide-y divide-line text-sm">
                  {snap.wearable.sessions.map((w) => (
                    <li key={w.sessionId} className="flex justify-between gap-2 py-2">
                      <Link href={`/session/${w.sessionId}`} className="text-accent">
                        {formatDate(w.startedAt, locale)}
                      </Link>
                      <span className="tabular-nums text-ink-2">
                        {w.avgHeartRate != null ? `${t.session.avgHr} ${w.avgHeartRate}` : ""}
                        {w.maxHeartRate != null ? ` · ${t.session.maxHr} ${w.maxHeartRate}` : ""}
                        {w.trainingLoad != null ? ` · ${t.session.trainingLoad} ${w.trainingLoad}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-xs text-ink-3">{t.connections.medicalNote}</p>
              </details>
            </Card>
          ) : null}
        </>
      )}
      {routes && routes.length ? <RouteStats locale={locale} ascents={routes} now={now} days={PERIODS[periodKey]}
        title={(locale === "fr" ? "Voie" : "Routes") + " · " + (periodKey === "30" ? t.progress.last30 : periodKey === "90" ? t.progress.last90 : t.progress.all)} /> : null}
    </div>
  );
}

/** "jaune 6/6 · bleu 7/7 · rouge 1/6" as aligned chips: sent / attempted per grade, easiest first. */
function GradeCounts({
  t,
  system,
  rows,
  label,
}: {
  t: Dictionary;
  system: GradeSystem;
  rows: Array<{ grade: string; sent: number; attempted: number }>;
  /** Names the scale when the gym has figures in more than one. */
  label?: string;
}) {
  if (rows.length === 0) return null;
  return (
    <>
    {label ? <p className="mt-1.5 text-xs text-ink-3">{label}</p> : null}
    <ul className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5" aria-label={label ? `${t.progress.sentPerGrade} · ${label}` : t.progress.sentPerGrade}>
      {rows.map((r) => (
        <li key={r.grade} className="flex items-center gap-1.5">
          <GradeChip t={t} system={system} grade={r.grade} size="sm" />
          <span className="text-xs tabular-nums text-ink-2">{fmt(t.progress.sentOfShort, { sent: r.sent, attempted: r.attempted })}</span>
        </li>
      ))}
    </ul>
    </>
  );
}
