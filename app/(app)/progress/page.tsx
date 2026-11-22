import Link from "next/link";
import { BoardProgress } from "@/components/climbing/board-progress";
import { boardPyramids } from "@/lib/analytics/boards";
import { loadBoardAscents, toBoardFact } from "@/lib/data/boards";
import { RatioBars } from "@/components/charts/ratio-bars";
import { GradePyramid } from "@/components/charts/grade-pyramid";
import { LevelCurve } from "@/components/charts/level-curve";
import { gradePyramid, mainSystem, weeklyHardest } from "@/lib/analytics/charts";
import { WeeklyBars } from "@/components/charts/weekly-bars";
import { GradeChip } from "@/components/climbing/grade-chip";
import { Card, EmptyState, PageHeader, SectionTitle } from "@/components/ui/card";
import { AvatarCard } from "@/components/training/avatar-card";
import { loadAvatar } from "@/lib/data/avatar";
import { PAGE_ICONS, PROGRESS_SECTION_ICONS as SECTION } from "@/components/layout/nav-icons";
import { linkClass, segmentClass, segmentGroupClass } from "@/components/ui/button";
import { IconBack } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { Fold } from "@/components/ui/fold";
import { HeroFigure, SectionRows, type SectionRow } from "@/components/ui/hero-figure";
import { progressAreaDictionary } from "@/lib/i18n/progress-area";
import { avatarDictionary } from "@/lib/i18n/avatar";
import { routeDictionary } from "@/lib/i18n/routes";
import { routeAscentsInLastDays, routePyramid, routeWeeklyHardest, routeWorkingGrade, summarizeRoutes, type RouteAscentFact } from "@/lib/analytics/routes";
import { attemptsInLastDays, computeSnapshot } from "@/lib/analytics";
import { conversionSummary, fontTarget, gradedOnly } from "@/lib/analytics/font-view";
import { loadFontView } from "@/lib/data/font-view";
import { FontNote } from "@/components/climbing/font-note";
import { requireViewer } from "@/lib/auth/viewer";
import type { GradeSystem } from "@/lib/climbing/types";
import { loadClimbingDataset } from "@/lib/data/climbing";
import { loadRouteAscents } from "@/lib/data/routes";
import { RouteStats } from "@/components/climbing/route-stats";
import { ScaleLevels } from "@/components/climbing/scale-levels";
import { headlineRow, scaleRows } from "@/lib/analytics/scale-rows";
import { formatDate, formatNumber, formatCounts, formatPercent, formatRatio } from "@/lib/format";
import { fmt, plural, type Dictionary } from "@/lib/i18n";
import { getI18n } from "@/lib/i18n/server";
import { gradeLabel } from "@/lib/grading/labels";
import { FRENCH_ROUTE_GRADES } from "@/lib/grading/route-grades";
import { datasetAt, routeAscentsAt, type Place } from "@/lib/analytics/place";
import type { ClimbingDataset } from "@/lib/analytics/types";
import { areasDictionary } from "@/lib/i18n/areas";
import { PROGRESS_SCOPES, parseProgressTab, progressHref } from "@/lib/navigation/progress-tabs";

export const metadata = { title: "Progrès" };

const PERIODS = { "30": 30, "90": 90, all: null } as const;

/**
 * Progrès › Grimpe. The summary (no ?tab=) is one hero figure and one list of
 * the sections, each with a single figure; every detail lives in exactly one
 * section: one discipline in one kind of place, boards, gyms, styles, avatar.
 * Each section leads with one figure, one diagram, and folds the rest away.
 */
export default async function ProgressPage({ searchParams }: PageProps<"/progress">) {
  const viewer = await requireViewer();
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  const sp = await searchParams;
  const periodKey = (typeof sp.period === "string" && sp.period in PERIODS ? sp.period : "90") as keyof typeof PERIODS;
  const tab = parseProgressTab(sp.tab);
  const scope = tab === "overview" ? null : PROGRESS_SCOPES[tab];
  const sections = areasDictionary(locale).climbing;
  const pa = progressAreaDictionary(locale).climbing;
  const rd = routeDictionary(locale);
  const keepPeriod = sp.period === undefined ? undefined : periodKey;
  const [dataset, allRoutes, boardRows] = await Promise.all([
    loadClimbingDataset(viewer.supabase), loadRouteAscents(viewer.supabase), loadBoardAscents(viewer.supabase),
  ]);
  // Every boulder on Font (the climber's own lines, then the default table); native grades stay stored as logged.
  const fv = await loadFontView(viewer.supabase, dataset);
  const now = new Date();
  const days = PERIODS[periodKey];
  const since = days === null ? 0 : now.getTime() - days * 86_400_000;
  const periodLabel = periodKey === "30" ? t.progress.last30 : periodKey === "90" ? t.progress.last90 : t.progress.all;
  const target = fontTarget({ grade: viewer.profile.target_grade, system: viewer.profile.target_grade_system }, fv.table);
  const snapOf = (d: ClimbingDataset) => computeSnapshot(d, target, now, days);
  const fontData = fv.dataset;
  const routesIn = (place: Place | null) => (allRoutes ? (place ? routeAscentsAt(allRoutes, place) : allRoutes) : []);
  const inPeriod = (list: RouteAscentFact[]) => (days === null ? list : routeAscentsInLastDays(list, days, now));
  const pyramids = boardPyramids(boardRows.map(toBoardFact).filter((f) => f.climbedAt.getTime() >= since));
  const boardClimbs = pyramids.reduce((n, p) => n + p.climbs, 0);
  const avatar = !scope || scope.view === "avatar" ? await loadAvatar(viewer.supabase, { dataset, boardRows }) : null;
  // The level a set of boulders leads with: the working grade on Font.
  const boulderLead = (snap: ReturnType<typeof snapOf>) => {
    const row = headlineRow(scaleRows(snap));
    return row ? { value: gradeLabel(t, row.system, row.working!), scale: t.grades.systems[row.system], system: row.system } : null;
  };

  const periodNav = <nav aria-label={pa.period}>
    <ul className={cn(segmentGroupClass, "inline-grid grid-cols-3")}>
      {(Object.keys(PERIODS) as Array<keyof typeof PERIODS>).map((k) => <li key={k} className="flex">
        <Link href={progressHref(tab, k)} aria-current={k === periodKey ? "page" : undefined} scroll={false}
          className={segmentClass(k === periodKey, "inline-flex w-full items-center justify-center px-4")}>
          {k === "30" ? t.progress.last30 : k === "90" ? t.progress.last90 : t.progress.all}
        </Link>
      </li>)}
    </ul>
  </nav>;

  const header = <>
    {/* Phones drill down like the sidebar does on wider screens: the summary lists the sections, each section links back. */}
    {scope ? <p className="md:hidden">
      <Link href={progressHref("overview", keepPeriod)} className={cn(linkClass, "inline-flex min-h-11 items-center text-sm")}>
        <IconBack /> {sections.tabs.overview}
      </Link>
    </p> : null}
    <PageHeader icon={<PAGE_ICONS.climbingProgress />} title={t.progress.title} subtitle={scope ? sections.tabs[tab] : undefined} />
  </>;

  // ── Summary: one hero figure, then the sections, one figure each. ──
  if (!scope) {
    const all = snapOf(fontData);
    const boulderRow = (place: Place): SectionRow => {
      const snap = snapOf(datasetAt(fontData, place));
      const lead = boulderLead(snap);
      const id = place === "indoor" ? "boulder-indoor" : "boulder-outdoor";
      return {
        href: progressHref(id, keepPeriod), title: sections.tabs[id],
        value: lead?.value ?? (snap.counts.attempts ? snap.counts.tops : "—"),
        detail: lead ? fmt(pa.rowLevel, { scale: lead.scale }) : snap.counts.attempts ? fmt(pa.rowSends, { n: snap.counts.tops }) : pa.rowEmpty,
        muted: snap.counts.attempts === 0, ...SECTION[id],
      };
    };
    const routeRow = (place: Place): SectionRow => {
      const list = routesIn(place);
      const recent = inPeriod(list);
      const working = routeWorkingGrade(list, now);
      const id = place === "indoor" ? "route-indoor" : "route-outdoor";
      return {
        href: progressHref(id, keepPeriod), title: sections.tabs[id],
        value: working.grade ?? (recent.length || "—"),
        detail: working.grade ? fmt(pa.rowRouteLevel, { n: recent.length }) : recent.length ? fmt(pa.rowRoutes, { n: recent.length }) : pa.rowEmpty,
        muted: recent.length === 0 && !working.grade, ...SECTION[id],
      };
    };
    const best = all.focus.styles.strongest;
    const angle = all.focus.wallAngles.strongest;
    const av = avatarDictionary(locale);
    const rows: SectionRow[] = [
      boulderRow("indoor"), boulderRow("outdoor"), routeRow("indoor"), routeRow("outdoor"),
      {
        href: progressHref("boards", keepPeriod), title: sections.tabs.boards, value: boardClimbs || "—",
        detail: boardClimbs ? fmt(pa.rowBoards, { n: boardClimbs, b: new Set(pyramids.map((p) => p.board)).size }) : pa.rowEmpty,
        muted: boardClimbs === 0, ...SECTION.boards,
      },
      {
        href: progressHref("gyms", keepPeriod), title: sections.tabs.gyms, value: all.gymBreakdown.length || "—",
        detail: all.gymBreakdown.length ? pa.rowGymsDetail : pa.rowEmpty, muted: all.gymBreakdown.length === 0,
        ...SECTION.gyms,
      },
      {
        href: progressHref("styles", keepPeriod), title: sections.tabs.styles,
        value: best ? t.styles[best.key] : angle ? t.wallAngles[angle.key] : "—",
        detail: best ? pa.rowStyle : angle ? pa.rowAngle : pa.stylesNone, muted: !best && !angle,
        ...SECTION.styles,
      },
      ...(avatar ? [{
        href: progressHref("avatar", keepPeriod), title: sections.tabs.avatar,
        value: av.colour[avatar.colour], detail: fmt(pa.rowAvatar, { n: avatar.level + 1 }),
        ...SECTION.avatar,
      }] : []),
    ];
    return <div className="space-y-8">
      {header}
      {periodNav}
      <section aria-label={t.progress.summaryTitle}>
        <HeroFigure size="page" variant="panel" art={PAGE_ICONS.climbingProgress}
          eyebrow={fmt(pa.summaryEyebrow, { period: periodLabel })} value={all.counts.tops}
          label={all.counts.tops ? pa.summaryLabel : pa.summaryNone}
          stats={[
            { label: pa.statBoulderSessions, value: all.counts.sessions, ...SECTION["boulder-indoor"] },
            { label: pa.statRoutesClean, value: summarizeRoutes(inPeriod(routesIn(null))).clean, ...SECTION["route-indoor"] },
            { label: pa.statBoardClimbs, value: boardClimbs, ...SECTION.boards },
          ]} />
      </section>
      <SectionRows label={pa.sectionsTitle} title={pa.sectionsTitle} rows={rows} />
    </div>;
  }

  const eyebrow = `${sections.tabs[tab]} · ${periodLabel}`;

  // ── Avatar: the card in full, the six pillars open. ──
  if (scope.view === "avatar") {
    return <div className="space-y-8">{header}{avatar ? <AvatarCard locale={locale} progress={avatar} /> : null}</div>;
  }

  // ── Boards: how many climbs, then one pyramid per board. ──
  if (scope.discipline === "board") {
    return <div className="space-y-8">
      {header}
      {periodNav}
      {pyramids.length === 0 ? <EmptyState body={sections.emptySection} /> : <>
        <section aria-label={pa.boardHeroLabel} className="px-1">
          <HeroFigure size="page" eyebrow={eyebrow} value={boardClimbs} label={pa.boardHeroLabel} />
        </section>
        <BoardProgress locale={locale} pyramids={pyramids} title={"Board · " + periodLabel} />
      </>}
    </div>;
  }

  // ── Routes in one kind of place: the hardest clean lead, the level curve, the rest folded. ──
  if (scope.discipline === "route") {
    const list = routesIn(scope.place);
    const s = summarizeRoutes(inPeriod(list));
    return <div className="space-y-8">
      {header}
      {periodNav}
      {list.length === 0 ? <EmptyState body={sections.emptySection} /> : <>
        <section aria-label={pa.routeHeroLabel} className="px-1">
          <HeroFigure size="page" eyebrow={eyebrow}
            value={s.highestLeadClean ?? formatPercent(s.cleanRate)} label={s.highestLeadClean ? pa.routeHeroLabel : pa.routeHeroNone}
            stats={[
              { label: pa.statRoutes, value: s.ascents },
              { label: pa.statClean, value: s.clean, hint: `${s.onsights} ${rd.onsights} · ${s.flashes} flash` },
              { label: rd.cleanRate, value: formatPercent(s.cleanRate), hint: formatCounts(s.cleanRate) },
            ]} />
        </section>
        <LevelCurve t={t} locale={locale} now={now} id="route-level-curve" title={rd.chartLevelTitle} hint={rd.chartLevelHint}
          scale={{ label: (g) => g, gradeAt: (i) => FRENCH_ROUTE_GRADES[i] ?? null }}
          texts={{ levelEmpty: rd.chartLevelEmpty, levelPoint: rd.chartLevelPoint, levelCaption: rd.chartLevelCaption, sendsCol: rd.chartSendsCol }}
          points={routeWeeklyHardest(list, now, days)} />
        <Fold variant="card" title={pa.routeDetailFold} hint={pa.routeDetailHint}>
          <RouteStats locale={locale} ascents={list} now={now} days={days} tiles={false} title={eyebrow}>
            <GradePyramid plain t={t} locale={locale} id="route-pyramid" title={rd.chartPyramidTitle} hint={rd.chartPyramidHint} label={(g) => g}
              legend={{ flashed: rd.chartFirstGo, sent: rd.chartClean, tried: rd.chartTried }} rows={routePyramid(list, now, days)} />
          </RouteStats>
        </Fold>
      </>}
    </div>;
  }

  // ── Boulders: one kind of place (bloc sections), or every place (gyms, styles). ──
  const data = scope.place ? datasetAt(fontData, scope.place) : fontData;
  const snap = snapOf(data);
  const fontSummary = conversionSummary(fv, days === null ? data.attempts : attemptsInLastDays(data.attempts, days, now));
  if (snap.counts.attempts === 0) return <div className="space-y-8">{header}{periodNav}<EmptyState body={sections.emptySection} /></div>;
  const gymName = new Map(data.gyms.map((g) => [g.id, g.name]));
  const chartSystem = mainSystem(data.problems, data.attempts.filter((x) => x.createdAt.getTime() >= since), ["FONT"]);
  const lead = boulderLead(snap);
  // The styles section leads with the best-sent style, or the best-sent wall angle when no style is tagged.
  const bestStyle = snap.focus.styles.strongest;
  const bestAngle = snap.focus.wallAngles.strongest;

  return (
    <div className="space-y-8">
      {header}
      {periodNav}
      {scope.view === "levels" ? (
        <>
          <section aria-label={t.progress.summaryTitle} className="px-1">
            <HeroFigure size="page" eyebrow={eyebrow}
              value={lead?.value ?? formatPercent(snap.sendRate)}
              label={lead ? fmt(pa.boulderHeroLabel, { scale: lead.scale }) : pa.boulderHeroNone}
              stats={[
                { label: t.progress.sessions, value: snap.counts.sessions },
                { label: t.progress.sendRate, value: formatPercent(snap.sendRate), hint: formatCounts(snap.sendRate) },
                { label: t.progress.flashRate, value: formatPercent(snap.flashRate), hint: formatCounts(snap.flashRate) },
              ]} />
          </section>
          {chartSystem ? <LevelCurve t={t} locale={locale} system={chartSystem} now={now}
            points={weeklyHardest(data.problems, data.attempts, chartSystem, now, days)} /> : null}
          <Fold variant="card" title={pa.detailFold} hint={pa.detailHint}>
            {chartSystem ? <GradePyramid t={t} locale={locale} system={chartSystem}
              rows={gradePyramid(data.problems, data.attempts, chartSystem, now, days)} /> : null}
            <ScaleLevels t={t} rows={scaleRows(snap)} />
          </Fold>
          <FontNote t={t} locale={locale} summary={fontSummary} className="px-1" />
          <Fold variant="card" title={pa.weeklyFold} hint={pa.weeklyHint}>
            <Card className="space-y-4">
              <p className="text-sm text-ink-2 tabular-nums">
                {snap.counts.problems} {t.progress.problems.toLowerCase()}
                {" · "}{snap.counts.attempts} {t.progress.attempts.toLowerCase()}
                {" · "}{t.progress.attemptsPerSend} {snap.attemptsPerSend.value === null ? "—" : formatNumber(snap.attemptsPerSend.value)}
                {" · "}{t.progress.topsPerSession} {formatNumber(snap.topsPerSession.mean)}
              </p>
              <WeeklyBars weeks={snap.weekly} locale={locale} labels={{
                tops: t.progress.weeklyTops, sessions: t.progress.weeklySessions, caption: t.progress.weekly,
                range: t.progress.weeklyRange, help: t.progress.weeklyHelp, weekOf: t.progress.weeklyWeekOf,
              }} />
            </Card>
          </Fold>
        </>
      ) : scope.view === "gyms" ? (
        <>
          <section aria-label={sections.tabs.gyms} className="px-1">
            <HeroFigure size="page" eyebrow={fmt(pa.gymsEyebrow, { period: periodLabel })} value={snap.gymBreakdown.length} label={pa.gymsLabel}
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
                  {gradedOnly(n.distributions).map((d) => (
                    <div key={d.system}>
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
            <FontNote t={t} locale={locale} summary={fontSummary} className="mt-4" />
          </Card>

          <Fold variant="card" title={pa.byGymFold} hint={pa.byGymHint}>
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
                    {gradedOnly(g.distributions).map((d) => (
                      <GradeCounts
                        key={d.system}
                        t={t}
                        system={d.system}
                        rows={d.buckets.map((b) => ({ grade: b.grade, sent: b.sent, attempted: b.attempted }))}
                      />
                    ))}
                  </li>
                ))}
              </ul>
            </Card>
          </Fold>
        </>
      ) : (
        <>
          <section aria-label={sections.tabs.styles} className="px-1">
            <HeroFigure size="page" eyebrow={fmt(pa.stylesEyebrow, { period: periodLabel })}
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
