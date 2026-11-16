import Link from "next/link";
import { BoardProgress } from "@/components/climbing/board-progress";
import { boardPyramids } from "@/lib/analytics/boards";
import { loadBoardAscents, toBoardFact } from "@/lib/data/boards";
import { RatioBars } from "@/components/charts/ratio-bars";
import { GradePyramid } from "@/components/charts/grade-pyramid";
import { LevelCurve } from "@/components/charts/level-curve";
import { gradePyramid, mainSystem, weeklyHardest } from "@/lib/analytics/charts";
import { GRADE_SYSTEMS } from "@/lib/climbing/types";
import { isOrderedSystem } from "@/lib/grading/systems";
import { WeeklyBars } from "@/components/charts/weekly-bars";
import { GradeChip } from "@/components/climbing/grade-chip";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui/card";
import { AvatarCard } from "@/components/training/avatar-card";
import { loadAvatar } from "@/lib/data/avatar";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { cn } from "@/components/ui/cn";
import { Fold } from "@/components/ui/fold";
import { HeroFigure } from "@/components/ui/hero-figure";
import { linkClass } from "@/components/ui/button";
import { IconNext } from "@/components/ui/icons";
import { progressAreaDictionary } from "@/lib/i18n/progress-area";
import { routeAscentsInLastDays } from "@/lib/analytics/routes";
import { computeSnapshot, MIN_RELIABLE_FOR_NORMALIZED_VIEW } from "@/lib/analytics";
import { requireViewer } from "@/lib/auth/viewer";
import type { GradeSystem } from "@/lib/climbing/types";
import { loadClimbingDataset } from "@/lib/data/climbing";
import { loadRouteAscents } from "@/lib/data/routes";
import { RouteStats } from "@/components/climbing/route-stats";
import { ScaleLevels } from "@/components/climbing/scale-levels";
import { fontTrend, scaleRows } from "@/lib/analytics/scale-rows";
import { formatDate, formatNumber, formatCounts, formatPercent, formatRatio } from "@/lib/format";
import { fmt, plural, type Dictionary } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { boulderGrade } from "@/lib/grading/display";
import { SectionTabs } from "@/components/layout/section-tabs";
import { datasetAt, routeAscentsAt } from "@/lib/analytics/place";
import { areasDictionary } from "@/lib/i18n/areas";
import { PROGRESS_SCOPES, PROGRESS_TABS, parseProgressTab, progressHref } from "@/lib/navigation/progress-tabs";

export const metadata = { title: "Progrès" };

const PERIODS = { "30": 30, "90": 90, all: null } as const;

export default async function ProgressPage({ searchParams }: PageProps<"/progress">) {
  const viewer = await requireViewer();
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  const sp = await searchParams;
  const periodKey = (typeof sp.period === "string" && sp.period in PERIODS ? sp.period : "90") as keyof typeof PERIODS;
  // One section (a discipline in a kind of place), or everything on the overview.
  const tab = parseProgressTab(sp.tab);
  const scope = tab === "overview" ? null : PROGRESS_SCOPES[tab];
  const show = (discipline: "boulder" | "route" | "board") => !scope || scope.discipline === discipline;
  // Which boulder blocks: the levels (overview and bloc sections), the gym comparison, or styles.
  const view = scope?.view ?? "levels";
  const sections = areasDictionary(locale).climbing;
  const pa = progressAreaDictionary(locale).climbing;
  const keepPeriod = sp.period === undefined ? undefined : periodKey;
  const [dataset, allRoutes, boardRows] = await Promise.all([
    loadClimbingDataset(viewer.supabase), loadRouteAscents(viewer.supabase), loadBoardAscents(viewer.supabase),
  ]);
  // The avatar always reads the whole history; the diagrams below read the section's.
  const avatar = scope ? null : await loadAvatar(viewer.supabase, { dataset, boardRows });
  const data = scope?.discipline === "boulder" && scope.place ? datasetAt(dataset, scope.place) : dataset;
  const routes = allRoutes && scope?.discipline === "route" && scope.place ? routeAscentsAt(allRoutes, scope.place) : allRoutes;
  const now = new Date();
  const days = PERIODS[periodKey];
  const boardSince = days === null ? 0 : now.getTime() - days * 86_400_000;
  const pyramids = boardPyramids(boardRows.map(toBoardFact).filter((f) => f.climbedAt.getTime() >= boardSince));
  const periodLabel = periodKey === "30" ? t.progress.last30 : periodKey === "90" ? t.progress.last90 : t.progress.all;
  const snap = computeSnapshot(
    data,
    { grade: viewer.profile.target_grade, system: viewer.profile.target_grade_system },
    new Date(),
    PERIODS[periodKey],
  );
  const gymName = new Map(data.gyms.map((g) => [g.id, g.name]));
  // Diagrams on the grading system most of the period's boulders were tried on (native grades only).
  const since = days === null ? 0 : now.getTime() - days * 86_400_000;
  const chartSystem = mainSystem(data.problems, data.attempts.filter((x) => x.createdAt.getTime() >= since),
    GRADE_SYSTEMS.filter(isOrderedSystem));

  const routeStats = routes && routes.length ? <RouteStats locale={locale} ascents={routes} now={now} days={days}
    title={(locale === "fr" ? "Voie" : "Routes") + " · " + periodLabel} /> : null;
  // The styles section leads with the best-sent style, or the best-sent wall angle when no style is tagged.
  const bestStyle = snap.focus.styles.strongest;
  const bestAngle = snap.focus.wallAngles.strongest;
  const routesInPeriod = routes ? (days === null ? routes : routeAscentsInLastDays(routes, days, now)).length : 0;
  const boardStats = <BoardProgress locale={locale} pyramids={pyramids} title={"Board · " + periodLabel} />;

  return (
    <div className="space-y-5">
      <PageHeader icon={<PAGE_ICONS.climbingProgress />} title={t.progress.title} subtitle={scope ? sections.tabs[tab] : undefined} />
      <SectionTabs label={sections.sections} current={tab}
        tabs={PROGRESS_TABS.map((id) => ({ id, href: progressHref(id, keepPeriod), label: sections.tabs[id] }))} />
      {avatar ? <AvatarCard locale={locale} progress={avatar} foldPillars={pa.avatarPillars} /> : null}
      <nav aria-label={t.progress.period} className="flex gap-2">
        {(Object.keys(PERIODS) as Array<keyof typeof PERIODS>).map((k) => (
          <Link
            key={k}
            href={progressHref(tab, k)}
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

      {!show("boulder") ? null : snap.counts.attempts === 0 ? (
        <EmptyState body={scope ? sections.emptySection : t.progress.empty} />
      ) : view === "levels" ? (
        <>
          <section aria-label={t.progress.summaryTitle} className="leblond-premium-surface space-y-4 p-5 sm:p-6">
            <HeroFigure eyebrow={fmt(pa.heroEyebrow, { period: periodLabel })} value={formatPercent(snap.sendRate)} label={pa.heroLabel}
              note={formatCounts(snap.sendRate)}
              stats={[
                { label: t.progress.sessions, value: snap.counts.sessions },
                { label: t.progress.problems, value: snap.counts.problems },
                { label: t.progress.flashRate, value: formatPercent(snap.flashRate), hint: formatCounts(snap.flashRate) },
              ]} />
            <p className="border-t border-line pt-3 text-sm text-ink-2 tabular-nums">
              {snap.counts.attempts} {t.progress.attempts.toLowerCase()}
              {" · "}{t.progress.attemptsPerSend} {snap.attemptsPerSend.value === null ? "—" : formatNumber(snap.attemptsPerSend.value)}
              {" · "}{t.progress.topsPerSession} {formatNumber(snap.topsPerSession.mean)}
            </p>
          </section>
          {chartSystem ? <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <LevelCurve t={t} locale={locale} system={chartSystem} now={now}
              points={weeklyHardest(data.problems, data.attempts, chartSystem, now, days)} />
            <GradePyramid t={t} locale={locale} system={chartSystem}
              rows={gradePyramid(data.problems, data.attempts, chartSystem, now, days)} />
          </div> : null}
          <ScaleLevels t={t} rows={scaleRows(snap)} font={{ level: snap.workingGrade.level, trend: fontTrend(snap) }} />
          <Card className="py-2">
            <Fold variant="flush" title={t.progress.weekly} hint={pa.weeklyHint}>
              <WeeklyBars weeks={snap.weekly} locale={locale} labels={{
                tops: t.progress.weeklyTops, sessions: t.progress.weeklySessions, caption: t.progress.weekly,
                range: t.progress.weeklyRange, help: t.progress.weeklyHelp, weekOf: t.progress.weeklyWeekOf,
              }} />
            </Fold>
          </Card>
          {!scope ? <p className="text-sm text-ink-2">
            {pa.sectionsMore}{" "}
            <Link href={progressHref("gyms", keepPeriod)} className={linkClass}>{pa.gymsLink}</Link>{" · "}
            <Link href={progressHref("styles", keepPeriod)} className={linkClass}>{pa.stylesLink} <IconNext /></Link>
          </p> : null}
        </>
      ) : view === "gyms" ? (
        <>
          <section aria-label={sections.tabs.gyms} className="leblond-premium-surface p-5 sm:p-6">
            <HeroFigure eyebrow={fmt(pa.gymsEyebrow, { period: periodLabel })} value={snap.gymBreakdown.length} label={pa.gymsLabel}
              stats={[
                { label: t.progress.sessions, value: snap.counts.sessions },
                { label: t.progress.problems, value: snap.counts.problems },
                { label: t.progress.sendRate, value: formatPercent(snap.sendRate), hint: formatCounts(snap.sendRate) },
              ]} />
          </section>
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
                    label: `${boulderGrade(b.grade)} (${t.common.estimate})`,
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
        </>
      ) : (
        <>
          <section aria-label={sections.tabs.styles} className="leblond-premium-surface p-5 sm:p-6">
            <HeroFigure eyebrow={fmt(pa.stylesEyebrow, { period: periodLabel })}
              value={bestStyle ? t.styles[bestStyle.key] : bestAngle ? t.wallAngles[bestAngle.key] : "—"}
              label={bestStyle ? `${pa.stylesLabel} · ${t.progress.sendRate} ${formatRatio(bestStyle.sendRate)}`
                : bestAngle ? `${pa.anglesLabel} · ${t.progress.sendRate} ${formatRatio(bestAngle.sendRate)}` : pa.stylesNone}
              stats={[
                { label: t.progress.problems, value: snap.counts.problems },
                { label: t.progress.sendRate, value: formatPercent(snap.sendRate), hint: formatCounts(snap.sendRate) },
                { label: t.progress.flashRate, value: formatPercent(snap.flashRate), hint: formatCounts(snap.flashRate) },
              ]} />
          </section>
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
            <Card className="py-2">
              <Fold variant="flush" title={t.progress.wearableOverlay}>
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
              </Fold>
            </Card>
          ) : null}
        </>
      )}
      {show("route") && routes && routes.length ? (scope ? routeStats : <Fold variant="card" title={fmt(pa.routesFold, { period: periodLabel })}
        hint={fmt(pa.routesHint, { n: routesInPeriod })}>{routeStats}</Fold>) : null}
      {show("board") && pyramids.length ? (scope ? boardStats : <Fold variant="card" title={fmt(pa.boardsFold, { period: periodLabel })}
        hint={fmt(pa.boardsHint, { n: pyramids.length })}>{boardStats}</Fold>) : null}
      {(scope?.discipline === "route" && !(routes && routes.length)) || (scope?.discipline === "board" && pyramids.length === 0)
        ? <EmptyState body={sections.emptySection} /> : null}
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
