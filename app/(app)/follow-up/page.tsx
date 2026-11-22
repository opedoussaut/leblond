import Link from "next/link";
import { RouteStats } from "@/components/climbing/route-stats";
import { GradePyramid } from "@/components/charts/grade-pyramid";
import { LevelCurve } from "@/components/charts/level-curve";
import { MobilityTests } from "@/components/charts/mobility-tests";
import { WeeklyBars } from "@/components/charts/weekly-bars";
import { PageHeader } from "@/components/ui/card";
import { AREA_ICONS, FOLLOW_UP_SECTION_ICONS as SECTION } from "@/components/layout/nav-icons";
import { computeSnapshot } from "@/lib/analytics";
import { gradePyramid, isMobilityWork, mainSystem, topLevelRates, weeklyHardest, weeklyTotals, type TopLevelSeries, type WeekTotal } from "@/lib/analytics/charts";
import { OverviewTiles } from "@/components/charts/overview-tiles";
import { Sparkline } from "@/components/charts/sparkline";
import { TopLevelRates } from "@/components/charts/top-level-rates";
import { calculateWeeklyActivity } from "@/lib/analytics/progress";
import { requireViewer } from "@/lib/auth/viewer";
import { GRADE_SYSTEMS } from "@/lib/climbing/types";
import { loadClimbingDataset } from "@/lib/data/climbing";
import { listTrainingSessions, loadExerciseMethods } from "@/lib/data/training-sessions";
import { loadRouteAscents } from "@/lib/data/routes";
import { isOrderedSystem } from "@/lib/grading/systems";
import { MAX_ASSESSMENTS } from "@/lib/training/assessment";
import { formatDate, formatCounts, formatPercent } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { adherence, localDate_ } from "@/lib/training/sessions";
import { mobilityOverview } from "@/lib/analytics/mobility";
import { loadMobility } from "@/lib/data/mobility";
import { fmt, intlLocale, type Locale } from "@/lib/i18n";
import { chartsDictionary } from "@/lib/i18n/charts";
import { mobilityDictionary } from "@/lib/i18n/mobility";
import { HIP_METHOD_ID, LEVEL_LABELS, contentLevel } from "@/lib/training/hip-mobility/content";
import { IconNext } from "@/components/ui/icons";
import { linkClass, segmentClass, segmentGroupClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { LimiterBars } from "@/components/charts/limiter-bars";
import { NotebookRecords } from "@/components/charts/notebook-records";
import { PairedCurves, type CurveSeries } from "@/components/charts/paired-curves";
import {
  boardBests, boulderBests, hangBest, recordProblems, latestHipLevels, limiterCounts, mainEdge, routeBest, weekIndex, weeklyHang, weeklyRouteLevel,
  type WeeklyPoint,
} from "@/lib/analytics/notebook";
import { startOfIsoWeekUtc } from "@/lib/analytics/progress";
import { loadBoardAscents, toBoardFact } from "@/lib/data/boards";
import { loadHangSets, loadSessionLimiters } from "@/lib/data/notebook";
import { FRENCH_ROUTE_GRADES } from "@/lib/grading/route-grades";
import { scoreToGrade } from "@/lib/grading/ordering";
import { gradeLabel } from "@/lib/grading/labels";
import { notebookDictionary } from "@/lib/i18n/notebook";
import { routeDictionary } from "@/lib/i18n/routes";
import { routePyramid, routeWeeklyActivity, routeWeeklyHardest } from "@/lib/analytics/routes";
import { TrainingLoad } from "@/components/charts/training-load";
import { loadChartPoints, weeklyLoadRows } from "@/lib/analytics/training-load";
import { hoursReport, roundMinutes5 } from "@/lib/analytics/weekly-load";
import { formatDuration } from "@/lib/duration";
import { loadTrainingLoadReport } from "@/lib/data/training-load";
import { SectionTabs } from "@/components/layout/section-tabs";
import { Fold } from "@/components/ui/fold";
import { HeroFigure, SectionRows } from "@/components/ui/hero-figure";
import { progressAreaDictionary } from "@/lib/i18n/progress-area";
import { trainingLoadDictionary } from "@/lib/i18n/training-load";
import { routeAscentsInLastDays } from "@/lib/analytics/routes";
import { FOLLOW_UP_TABS, followUpHref, parseFollowUpTab } from "@/lib/navigation/follow-up-tabs";

/** Series the climber can pair on the same weeks. */
const SERIES = ["boulder", "route", "hang", "sends", "train", "mobility"] as const;
type SeriesId = (typeof SERIES)[number];

/** About four evenly spaced ticks from 0 to the highest value, for counts and minutes. */
function countTicks(max: number, unit = ""): Array<{ value: number; label: string }> {
  if (max <= 0) return [{ value: 0, label: `0${unit}` }];
  const step = [1, 2, 5, 10, 15, 20, 30, 50, 60, 100, 120, 150, 200, 300, 500].find((s) => max / s <= 4) ?? Math.ceil(max / 4);
  const out = [];
  for (let v = 0; v <= max + step / 2; v += step) out.push({ value: v, label: `${v}${unit}` });
  return out;
}

export const metadata = { title: "LEBLOND — Progrès" };

/** The periods the three timelines share, in weeks. */
const PERIODS = [12, 26, 52] as const;

function Evidence({ kind, fr }: { kind: "observed" | "recorded" | "self"; fr: boolean }) {
  const label = {
    observed: fr ? "Observé · carnet de grimpe" : "Observed · climbing journal",
    recorded: fr ? "Enregistré · séances d’entraînement" : "Recorded · training sessions",
    self: fr ? "Déclaratif · évaluations" : "Self-reported · assessments",
  }[kind];
  return <span className="rounded-full border border-line bg-surface-2 px-2.5 py-1 text-xs font-bold text-ink-2">{label}</span>;
}
function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="rounded-2xl bg-surface-2 p-4">
    <p className="text-xs font-semibold text-ink-3">{label}</p>
    <p className="mt-1 leblond-number text-2xl">{value}</p>
    {hint ? <p className="mt-1 text-xs text-ink-3">{hint}</p> : null}
  </div>;
}

/** Minutes per week as bars, sessions under them (the shared weekly-bars diagram). */
function MinutesBars({ locale, weeks, caption, help }: { locale: Locale; weeks: WeekTotal[]; caption: string; help: string }) {
  const c = chartsDictionary(locale);
  return <div>
    <h3 className="text-base font-bold">{caption}</h3>
    <div className="mt-2">
      <WeeklyBars locale={locale}
        weeks={weeks.map((w) => ({ weekStart: w.weekStart, sessions: w.sessions, tops: w.minutes, attempts: 0, flashes: 0 }))}
        labels={{ tops: c.minutesLabel, sessions: c.sessionsLabel, caption, range: c.rangeLabel, help, weekOf: c.weekOfLabel }} />
    </div>
  </div>;
}

/**
 * Progrès: climbing, training and mobility over the same period, week by
 * week, each with its source. Only recorded work; native grades; mobility
 * tests are the climber's own and labelled so.
 */
export default async function FollowUpHome({ searchParams }: PageProps<"/follow-up">) {
  const viewer = await requireViewer();
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  const fr = locale === "fr";
  const c = chartsDictionary(locale);
  const sp = await searchParams;
  const weeks = PERIODS.find((n) => String(n) === sp.weeks) ?? 12;
  // One section at a time; the overview sums each one up in a figure.
  const tab = parseFollowUpTab(sp.tab);
  const pa = progressAreaDictionary(locale).followUp;
  const days = weeks * 7;
  const now = new Date();
  const mob = mobilityDictionary(locale);
  const [dataset, routes, training, { data: assessments }, mobility, { data: favourites }] = await Promise.all([
    loadClimbingDataset(viewer.supabase),
    loadRouteAscents(viewer.supabase),
    listTrainingSessions(viewer.supabase, 400),
    viewer.supabase.from("training_assessments").select("id, kind, created_at").order("created_at", { ascending: false }).limit(MAX_ASSESSMENTS),
    loadMobility(viewer.supabase),
    viewer.supabase.from("favourite_gyms").select("gym_id").eq("user_id", viewer.userId),
  ]);
  // Coach sessions carry no method of their own: their exercises say whether they are mobility work.
  const methodless = (training ?? []).filter((s) => !s.methodId).map((s) => s.id);
  const exerciseMethods = await loadExerciseMethods(viewer.supabase, methodless);
  const isMobility = (s: { id: string; methodId: string | null }) => isMobilityWork(s.methodId, exerciseMethods.get(s.id) ?? []);
  const sessionDate = (s: { scheduledDate: string | null; completedAt: string | null; createdAt: string }) =>
    s.scheduledDate ?? (s.completedAt ?? s.createdAt).slice(0, 10);
  // Mobility done outside the hip programme (the programme's own sessions are in mobility.records).
  const otherMobility = (training ?? []).filter((s) => s.status === "COMPLETED" && s.methodId !== HIP_METHOD_ID && isMobility(s));
  const mobilityUsed = !!mobility.enrollment || mobility.records.length > 0 || mobility.assessments.length > 0 || otherMobility.length > 0;
  const mobOverview = mobilityOverview(mobility.records, mobility.assessments, mobility.today);
  const mobSince28 = localDate_(new Date(now.getTime() - 27 * 86_400_000));
  const mobSessions28 = mobOverview.sessionsLast28 + otherMobility.filter((s) => sessionDate(s) >= mobSince28).length;
  const snap = computeSnapshot(dataset, { grade: viewer.profile.target_grade, system: viewer.profile.target_grade_system }, now, days);
  const today = localDate_(now);
  const since = localDate_(new Date(now.getTime() - days * 86_400_000));
  const recent = (training ?? []).filter((s) => (s.scheduledDate ?? s.createdAt.slice(0, 10)) >= since && !isMobility(s));
  const adh = adherence(recent, today);
  const working = snap.workingGrade;

  // Diagrams on the grade system most of the period's boulders were tried on (native grades only).
  const sinceMs = now.getTime() - days * 86_400_000;
  const chartSystem = mainSystem(dataset.problems, dataset.attempts.filter((x) => x.createdAt.getTime() >= sinceMs),
    GRADE_SYSTEMS.filter(isOrderedSystem));
  const climbWeeks = calculateWeeklyActivity(dataset.sessions, dataset.attempts, now, weeks);
  // Send rate at the top two grades, one series per native scale (the Grimpe tab and the overview's level tile).
  const topLevels = tab === "climbing" || tab === "overview"
    ? topLevelRates(dataset.problems, dataset.attempts, GRADE_SYSTEMS.filter(isOrderedSystem), now, weeks) : [];
  const done = (training ?? []).filter((x) => x.status === "COMPLETED" && !isMobility(x));
  const trainItems = done.map((x) => ({ date: sessionDate(x), minutes: x.actualMinutes }));
  const mobItems = [
    ...mobility.records.filter((r) => r.status === "COMPLETED").map((m) => ({ date: m.date, minutes: m.minutes })),
    ...otherMobility.map((s) => ({ date: sessionDate(s), minutes: s.actualMinutes })),
  ];
  const trainWeeks = weeklyTotals(trainItems, today, weeks);
  const mobWeeks = weeklyTotals(mobItems, today, weeks);
  // Training and mobility minutes together, for the overview's tile.
  const activeWeeks = weeklyTotals([...trainItems, ...mobItems], today, weeks);
  const [boardRows, hangSets, limiterSessions] = await Promise.all([
    loadBoardAscents(viewer.supabase), loadHangSets(viewer.supabase), loadSessionLimiters(viewer.supabase, since),
  ]);

  // The notebook: records, paired weekly curves, limiters.
  const n = notebookDictionary(locale);
  const boardFacts = boardRows.map(toBoardFact);
  const limits = limiterCounts(limiterSessions, since);

  // Training load: every recorded session as session-RPE load, fitness–fatigue model, verdict per native scale.
  // Only the overview (its verdict) and the load section read it.
  const loadReport = tab !== "overview" && tab !== "load" ? null : await loadTrainingLoadReport(viewer.supabase, { today, now, dataset, routes: routes ?? [], boardFacts, mobility, training, hangSets });
  const rd = routeDictionary(locale);
  const firstWeek = new Date(startOfIsoWeekUtc(new Date(today + "T12:00:00Z")).getTime() - (weeks - 1) * 7 * 86_400_000).toISOString().slice(0, 10);
  const hours = loadReport ? hoursReport(loadReport.loads, today, firstWeek) : null;
  const totals = (list: WeekTotal[], unit: string): WeeklyPoint[] => list.map((w, i) => ({ week: i, value: w.minutes, label: `${w.minutes} ${unit}` }));
  const buildSeries = (id: SeriesId): CurveSeries => {
    const title = n.series[id];
    if (id === "boulder") {
      const points = chartSystem ? weeklyHardest(dataset.problems, dataset.attempts, chartSystem, now, days).flatMap((p) => {
        const w = weekIndex(p.weekStart, today, weeks);
        return w === null ? [] : [{ week: w, value: p.score, label: gradeLabel(t, chartSystem, p.grade) }];
      }) : [];
      const lo = Math.min(...points.map((p) => p.value)), hi = Math.max(...points.map((p) => p.value));
      const every = hi - lo > 6 ? 2 : 1;
      const yTicks = [];
      if (chartSystem && points.length) for (let v = lo; v <= hi; v += every) {
        const g = scoreToGrade(chartSystem, v);
        if (g) yTicks.push({ value: v, label: gradeLabel(t, chartSystem, g) });
      }
      const system = chartSystem ? ((t.grades.scaleShort as Record<string, string>)[chartSystem] ?? chartSystem) : "—";
      return { id, title, help: fmt(n.seriesHelp.boulder, { system }), points, yTicks };
    }
    if (id === "route") {
      const points = routes ? weeklyRouteLevel(routes, today, weeks) : [];
      const lo = Math.min(...points.map((p) => p.value)), hi = Math.max(...points.map((p) => p.value));
      const every = hi - lo > 6 ? 2 : 1;
      const yTicks = [];
      if (points.length) for (let v = lo; v <= hi; v += every) yTicks.push({ value: v, label: FRENCH_ROUTE_GRADES[v] });
      return { id, title, help: n.seriesHelp.route, points, yTicks };
    }
    if (id === "hang") {
      const points = weeklyHang(hangSets, today, weeks);
      const max = Math.max(0, ...points.map((p) => p.value)), min = Math.min(0, ...points.map((p) => p.value));
      const yTicks = countTicks(max - min, " kg").map((tk) => ({ value: tk.value + min, label: `${tk.value + min} kg` }));
      return { id, title, help: fmt(n.seriesHelp.hang, { mm: mainEdge(hangSets) ?? "—" }), points, yTicks };
    }
    if (id === "sends") {
      const points = climbWeeks.map((w, i) => ({ week: i, value: w.tops, label: String(w.tops) }));
      return { id, title, help: n.seriesHelp.sends, points: points.some((p) => p.value) ? points : [], yTicks: countTicks(Math.max(...points.map((p) => p.value))) };
    }
    const list = id === "train" ? trainWeeks : mobWeeks;
    const points = totals(list, "min");
    return { id, title, help: n.seriesHelp[id], points: points.some((p) => p.value) ? points : [], yTicks: countTicks(Math.max(...points.map((p) => p.value)), " min") };
  };
  const pick = (v: unknown, fallback: SeriesId): SeriesId => (SERIES as readonly unknown[]).includes(v) ? v as SeriesId : fallback;
  const seriesA = pick(sp.a, "boulder");
  const seriesB = pick(sp.b, hangSets.length ? "hang" : "train");

  const periodName = weeks === 52 ? c.yearOpt : fmt(c.weeksOpt, { n: weeks });
  const ld = trainingLoadDictionary(locale);
  const routesInPeriod = routes ? routeAscentsInLastDays(routes, days, now).length : 0;
  // The overview's markers: today's load zone, the main scale's top-grade send rate.
  const hasLoad = !!loadReport?.model.length;
  const mainLevel = topLevels[0] as TopLevelSeries | undefined;
  const topGrade = mainLevel?.grades[0];
  const percentFormat = new Intl.NumberFormat(intlLocale(locale), { style: "percent", maximumFractionDigits: 0 });

  return <div className="space-y-8">
    <PageHeader icon={<AREA_ICONS.progress />} title={c.ptitle} subtitle={tab === "overview" ? c.psubtitle : pa.tabs[tab]} />
    <SectionTabs always label={pa.sections} current={tab}
      tabs={FOLLOW_UP_TABS.map((id) => ({ id, href: followUpHref(id, weeks), label: pa.tabs[id] }))} />

    {/* The same period switch as Progrès › Grimpe. */}
    <nav aria-label={c.period}>
      <ul className={cn(segmentGroupClass, "inline-grid grid-cols-3")}>
        {PERIODS.map((w) => <li key={w} className="flex">
          <Link href={followUpHref(tab, w)} aria-current={w === weeks ? "page" : undefined}
            className={segmentClass(w === weeks, "inline-flex w-full items-center justify-center px-4")}>
            {w === 52 ? c.yearOpt : fmt(c.weeksOpt, { n: w })}
          </Link>
        </li>)}
      </ul>
    </nav>

    {tab === "overview" ? <>
      <OverviewTiles title={pa.tilesTitle} hint={pa.tilesHint} tiles={[
        { href: followUpHref("load", weeks), section: pa.tabs.load, ...SECTION.load,
          title: pa.tileLoad,
          value: hours && hasLoad ? formatDuration(roundMinutes5(hours.status.last7)) : "—",
          muted: !hours?.status.zone,
          caption: !hours || !hasLoad ? pa.loadNone : hours.status.zone && hours.status.habit
            ? fmt(pa.tileLoadCaption, { zone: ld.hours.zone[hours.status.zone], habit: formatDuration(roundMinutes5(hours.status.habit.minutes)) })
            : pa.tileLoadCalibrating,
          spark: <Sparkline kind="bars" values={(hours?.weeks ?? []).map((w) => w.total)} tone={SECTION.load.tone} /> },
        { href: followUpHref("climbing", weeks), section: pa.tabs.climbing, ...SECTION.climbing,
          title: topGrade ? fmt(pa.tileLevel, { grade: gradeLabel(t, mainLevel!.system, topGrade.grade) }) : pa.tileLevelEmpty,
          value: topGrade && topGrade.recent.rate !== null ? percentFormat.format(topGrade.recent.rate) : "—",
          muted: !topGrade || topGrade.recent.rate === null,
          caption: topGrade ? fmt(pa.tileLevelCaption, {
            scale: (t.grades.systems as Record<string, string>)[mainLevel!.system] ?? mainLevel!.system,
            previous: topGrade.previous.rate === null ? "—" : percentFormat.format(topGrade.previous.rate),
            direction: c.tlDirection[topGrade.direction],
          }) : pa.tileLevelNone,
          spark: <Sparkline values={topGrade?.rolling ?? []} min={0} max={1} tone={SECTION.climbing.tone} /> },
        { href: followUpHref("climbing", weeks), section: pa.tabs.climbing, ...SECTION.climbing, title: pa.tileVolume, value: snap.counts.tops,
          caption: fmt(pa.tileVolumeCaption, { sessions: snap.counts.sessions, routes: routesInPeriod }),
          spark: <Sparkline kind="bars" values={climbWeeks.map((w) => w.tops)} tone={SECTION.climbing.tone} /> },
        { href: followUpHref("training", weeks), section: pa.tabs.training, ...SECTION.training, title: pa.tileTraining, value: `${adh.completed} / ${adh.planned}`,
          caption: fmt(pa.tileTrainingCaption, { minutes: adh.activeMinutes, mobility: mobSessions28 }),
          spark: <Sparkline kind="bars" values={activeWeeks.map((w) => w.minutes)} tone={SECTION.training.tone} /> },
      ]} />
      <SectionRows label={pa.compareCard} rows={[
        { href: followUpHref("compare", weeks), title: pa.compareCard, value: "",
          detail: fmt(pa.compareValue, { a: n.series[seriesA], b: n.series[seriesB] }), ...SECTION.compare },
      ]} />
      <NotebookRecords t={t} locale={locale} boulders={boulderBests(recordProblems(dataset.problems, dataset.gyms, (favourites ?? []).map((f) => f.gym_id)), dataset.attempts)} route={routes ? routeBest(routes) : null}
        boards={boardBests(boardFacts)} hang={hangBest(hangSets)} hips={latestHipLevels(mobility.assessments)}
        gymNames={Object.fromEntries(dataset.gyms.map((g) => [g.id, g.name]))} favouritesOnly={(favourites ?? []).length > 0} />
    </> : null}

    {tab === "load" && loadReport && hours ? <TrainingLoad t={t} locale={locale} report={loadReport} hours={hours} weeks={weeklyLoadRows(loadReport.model.filter((d) => d.date >= firstWeek))}
      points={loadChartPoints(loadReport.model, loadReport.projection.points, firstWeek)} /> : null}

    {tab === "climbing" ? <>
      <section aria-labelledby="climb-heading" className="leblond-premium-surface space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="climb-heading" className="text-lg font-bold">{c.climbTitle}</h2>
          <Evidence kind="observed" fr={fr} />
        </div>
        {snap.counts.sessions === 0 ? <p className="text-sm text-ink-2">
          {fr ? "Aucune séance de grimpe enregistrée sur cette période." : "No climbing sessions logged in this period."}{" "}
          <Link href="/session/new" className={linkClass}>{fr ? "Commencer une séance" : "Start a session"}</Link>
        </p> : <>
          <HeroFigure eyebrow={fmt(pa.climbEyebrow, { period: periodName })} value={snap.counts.tops}
            label={fr ? "Blocs réussis" : "Sends"} note={`${snap.counts.flashes} flash`}
            stats={[
              { label: fr ? "Séances" : "Sessions", value: snap.counts.sessions },
              { label: fr ? "Essais" : "Attempts", value: snap.counts.attempts },
              { label: fr ? "Taux de réussite" : "Send rate", value: formatPercent(snap.sendRate),
                hint: [formatCounts(snap.sendRate), fr ? `${snap.counts.problems} blocs essayés` : `${snap.counts.problems} problems tried`].filter(Boolean).join(" · ") },
            ]} />
          <div className="border-t border-line pt-4">
            <TopLevelRates t={t} locale={locale} series={topLevels} />
          </div>
          {chartSystem ? <div className="border-t border-line pt-4">
            <GradePyramid plain t={t} locale={locale} system={chartSystem}
              rows={gradePyramid(dataset.problems, dataset.attempts, chartSystem, now, days)} />
          </div> : null}
          {chartSystem ? <Fold title={c.levelFold} hint={c.levelFoldHint}>
            <LevelCurve plain t={t} locale={locale} system={chartSystem} now={now}
              points={weeklyHardest(dataset.problems, dataset.attempts, chartSystem, now, days)} />
          </Fold> : null}
          <Fold title={c.climbTops} hint={pa.weeklyHint}>
            <WeeklyBars weeks={climbWeeks} locale={locale}
              labels={{ tops: c.topsLabel, sessions: c.sessionsLabel, caption: c.climbTops, range: c.rangeLabel, help: t.progress.weeklyHelp, weekOf: c.weekOfLabel }} />
          </Fold>
        </>}
        <Fold title={pa.limitersTitle} hint={pa.limitersHint}>
          <LimiterBars locale={locale} rows={limits.rows} sessions={limits.sessions} />
        </Fold>
        <p className="text-sm text-ink-2">
          <strong>{fr ? "Niveau de travail observé" : "Observed working grade"} :</strong>{" "}
          {working.level ? `${working.level} (${working.sampleSize} ${fr ? "blocs, 60 j" : "problems, 60 d"})` : (fr ? "données insuffisantes" : "insufficient data")}
        </p>
        <Link href="/progress" className={cn(linkClass, "text-sm")}>{fr ? "Tous mes résultats de grimpe" : "All my climbing results"} <IconNext /></Link>
      </section>
      {routes && routes.length ? <RouteStats locale={locale} ascents={routes} now={now}>
        <p className="border-t border-line pt-4 text-xs font-semibold text-ink-3">
          {fmt(rd.chartsPeriod, { period: weeks === 52 ? c.yearOpt : fmt(c.weeksOpt, { n: weeks }) })}
        </p>
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <LevelCurve plain t={t} locale={locale} now={now} id="route-level-curve" title={rd.chartLevelTitle} hint={rd.chartLevelHint}
            scale={{ label: (g) => g, gradeAt: (i) => FRENCH_ROUTE_GRADES[i] ?? null }}
            texts={{ levelEmpty: rd.chartLevelEmpty, levelPoint: rd.chartLevelPoint, levelCaption: rd.chartLevelCaption, sendsCol: rd.chartSendsCol }}
            points={routeWeeklyHardest(routes, now, days)} />
          <GradePyramid plain t={t} locale={locale} id="route-pyramid" title={rd.chartPyramidTitle} hint={rd.chartPyramidHint} label={(g) => g}
            legend={{ flashed: rd.chartFirstGo, sent: rd.chartClean, tried: rd.chartTried }} rows={routePyramid(routes, now, days)} />
        </div>
        <Fold title={rd.chartWeekly} hint={pa.routeWeeklyHint}>
          <WeeklyBars weeks={routeWeeklyActivity(routes, now, weeks)} locale={locale}
            labels={{ tops: rd.chartWeeklyLabel, sessions: c.sessionsLabel, caption: rd.chartWeekly, range: c.rangeLabel, help: rd.chartWeeklyHelp, weekOf: c.weekOfLabel }} />
        </Fold>
      </RouteStats> : null}
    </> : null}

    {tab === "training" ? <>
      <section aria-labelledby="train-heading" className="leblond-premium-surface space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="train-heading" className="text-lg font-bold">{c.trainTitle}</h2>
          <Evidence kind="recorded" fr={fr} />
        </div>
        {training === null ? <p role="alert" className="text-sm text-danger">{fr ? "Données d’entraînement indisponibles." : "Training data unavailable."}</p>
          : recent.length === 0 ? <p className="text-sm text-ink-2">
            {(training ?? []).some((s) => !isMobility(s))
              ? (fr ? "Pas d’entraînement sur cette période." : "No training in this period.")
              : fr ? "Pas encore de séance d’entraînement. Tes progrès en grimpe ci-dessus restent complets sans programme."
                : "No training sessions yet. Your climbing progress above is complete without a plan."}{" "}
            <Link href="/programmes" className={linkClass}>{fr ? "Découvrir les programmes" : "Explore programmes"}</Link>
          </p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Tile label={fr ? "Réalisées / prévues" : "Completed / due"} value={`${adh.completed} / ${adh.planned}`}
              hint={adh.completionRate === null ? undefined : `${Math.round(adh.completionRate * 100)} %`} />
            <Tile label={fr ? "Temps actif" : "Active time"} value={`${adh.activeMinutes} min`} />
            <Tile label={fr ? "Effort perçu moyen" : "Average RPE"} value={adh.averageRpe === null ? "—" : `${adh.averageRpe} / 10`} />
            <Tile label={fr ? "À venir" : "Upcoming"} value={String(adh.upcoming)} hint={adh.painReports ? (fr ? `${adh.painReports} douleur(s) ≥ 3 signalée(s)` : `${adh.painReports} pain report(s) ≥ 3`) : undefined} />
          </div>}
        {done.length ? <Fold title={c.trainMinutes} hint={pa.trainMinutesHint}>
          <MinutesBars locale={locale} weeks={trainWeeks} caption={c.trainMinutes} help={c.trainHelp} />
        </Fold> : null}
        <Link href="/follow-up/training" className={cn(linkClass, "text-sm")}>{fr ? "Historique d’entraînement" : "Training history"} <IconNext /></Link>
      </section>
      {mobilityUsed ? <section aria-labelledby="mobility-heading" className="leblond-premium-surface space-y-4 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="mobility-heading" className="text-lg font-bold">{c.mobTitle}</h2>
          <Evidence kind="recorded" fr={fr} />
        </div>
        <p className="text-sm text-ink-2">{fmt(mob.fuCardText, {
          sessions: mobSessions28,
          level: LEVEL_LABELS[contentLevel(mobility.enrollment?.workingLevel ?? 0)].name[locale],
        })}</p>
        <Fold title={c.mobMinutes} hint={pa.mobMinutesHint}>
          <MinutesBars locale={locale} weeks={mobWeeks} caption={c.mobMinutes} help={c.mobHelp} />
        </Fold>
        <Fold title={c.mobTests} hint={pa.mobTestsHint}>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-bold">{c.mobTests}</h3>
            <Evidence kind="self" fr={fr} />
          </div>
          <p className="text-xs text-ink-3">{c.mobTestsHelp}</p>
          <ul aria-hidden="true" className="flex gap-5 text-xs font-semibold text-ink-2">
            <li className="flex items-center gap-2"><span className="w-5 border-t-2 border-accent" />{c.left}</li>
            <li className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-ink-3" />{c.right}</li>
          </ul>
          <MobilityTests locale={locale} points={mobility.assessments} />
        </div>
        </Fold>
        <Link href="/follow-up/mobility" className={cn(linkClass, "text-sm")}>{mob.fuTitle} <IconNext /></Link>
      </section> : null}
      <section aria-labelledby="assess-heading" className="leblond-premium-surface space-y-3 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="assess-heading" className="text-lg font-bold">{fr ? "Évaluations" : "Assessments"}</h2>
          <Evidence kind="self" fr={fr} />
        </div>
        {(assessments ?? []).length === 0 ? <p className="text-sm text-ink-2">{fr ? "Aucune évaluation. C’est facultatif." : "No assessments. They are optional."}</p>
          : <p className="text-sm text-ink-2">
            {fr ? `${assessments!.length} évaluation(s) · dernière le ` : `${assessments!.length} assessment(s) · latest on `}
            {formatDate(assessments![0].created_at, locale)}
          </p>}
        <Link href="/training-assessment" className={cn(linkClass, "text-sm")}>{fr ? "Comparer mes évaluations" : "Compare my assessments"} <IconNext /></Link>
        <p className="text-xs text-ink-3">{fr
          ? "Les scénarios d’évolution sont illustratifs et ne prédisent pas une cotation. Ils restent séparés des résultats observés."
          : "Progress scenarios are illustrative and do not predict a grade. They stay separate from observed results."}</p>
      </section>
    </> : null}

    {tab === "compare" ? <>
      <PairedCurves locale={locale} weeks={weeks} firstWeek={firstWeek}
        options={SERIES.map((id) => ({ id, label: n.series[id] }))} top={buildSeries(seriesA)} bottom={buildSeries(seriesB)} />
    </> : null}
  </div>;
}
