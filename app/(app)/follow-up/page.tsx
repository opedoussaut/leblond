import Link from "next/link";
import { RouteStats } from "@/components/climbing/route-stats";
import { GradePyramid } from "@/components/charts/grade-pyramid";
import { LevelCurve } from "@/components/charts/level-curve";
import { MobilityTests } from "@/components/charts/mobility-tests";
import { WeeklyBars } from "@/components/charts/weekly-bars";
import { PageHeader } from "@/components/ui/card";
import { AREA_ICONS } from "@/components/layout/nav-icons";
import { computeSnapshot } from "@/lib/analytics";
import { gradePyramid, mainSystem, weeklyHardest, weeklyTotals, type WeekTotal } from "@/lib/analytics/charts";
import { calculateWeeklyActivity } from "@/lib/analytics/progress";
import { requireViewer } from "@/lib/auth/viewer";
import { GRADE_SYSTEMS } from "@/lib/climbing/types";
import { loadClimbingDataset } from "@/lib/data/climbing";
import { listTrainingSessions } from "@/lib/data/training-sessions";
import { loadRouteAscents } from "@/lib/data/routes";
import { isOrderedSystem } from "@/lib/grading/systems";
import { MAX_ASSESSMENTS } from "@/lib/training/assessment";
import { formatDate, formatRatio } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { adherence, localDate_ } from "@/lib/training/sessions";
import { mobilityOverview } from "@/lib/analytics/mobility";
import { loadMobility } from "@/lib/data/mobility";
import { fmt, type Locale } from "@/lib/i18n";
import { chartsDictionary } from "@/lib/i18n/charts";
import { mobilityDictionary } from "@/lib/i18n/mobility";
import { HIP_METHOD_ID, LEVEL_LABELS, contentLevel } from "@/lib/training/hip-mobility/content";
import { IconNext } from "@/components/ui/icons";
import { linkClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

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
  const days = weeks * 7;
  const now = new Date();
  const mob = mobilityDictionary(locale);
  const [dataset, routes, training, { data: assessments }, mobility] = await Promise.all([
    loadClimbingDataset(viewer.supabase),
    loadRouteAscents(viewer.supabase),
    listTrainingSessions(viewer.supabase, 400),
    viewer.supabase.from("training_assessments").select("id, kind, created_at").order("created_at", { ascending: false }).limit(MAX_ASSESSMENTS),
    loadMobility(viewer.supabase),
  ]);
  const mobilityUsed = !!mobility.enrollment || mobility.records.length > 0 || mobility.assessments.length > 0;
  const mobOverview = mobilityOverview(mobility.records, mobility.assessments, mobility.today);
  const snap = computeSnapshot(dataset, { grade: viewer.profile.target_grade, system: viewer.profile.target_grade_system }, now, days);
  const today = localDate_(now);
  const since = localDate_(new Date(now.getTime() - days * 86_400_000));
  const recent = (training ?? []).filter((s) => (s.scheduledDate ?? s.createdAt.slice(0, 10)) >= since && s.methodId !== HIP_METHOD_ID);
  const adh = adherence(recent, today);
  const working = snap.workingGrade;

  // Diagrams on the grade system most of the period's boulders were tried on (native grades only).
  const sinceMs = now.getTime() - days * 86_400_000;
  const chartSystem = mainSystem(dataset.problems, dataset.attempts.filter((x) => x.createdAt.getTime() >= sinceMs),
    GRADE_SYSTEMS.filter(isOrderedSystem));
  const climbWeeks = calculateWeeklyActivity(dataset.sessions, dataset.attempts, now, weeks);
  const done = (training ?? []).filter((x) => x.status === "COMPLETED" && x.methodId !== HIP_METHOD_ID);
  const trainWeeks = weeklyTotals(done.map((x) => ({ date: x.scheduledDate ?? (x.completedAt ?? x.createdAt).slice(0, 10), minutes: x.actualMinutes })), today, weeks);
  const mobWeeks = weeklyTotals(mobility.records.filter((r) => r.status === "COMPLETED").map((r) => ({ date: r.date, minutes: r.minutes })), today, weeks);

  return <div className="space-y-8">
    <PageHeader icon={<AREA_ICONS.progress />} title={c.ptitle} subtitle={c.psubtitle} />

    <nav aria-label={c.period} className="flex gap-2">
      {PERIODS.map((n) => <Link key={n} href={`/follow-up?weeks=${n}`} aria-current={n === weeks ? "page" : undefined}
        className={cn("min-h-11 rounded-full border px-4 py-2.5 text-sm font-semibold",
          n === weeks ? "border-accent bg-accent-soft" : "border-line text-ink-2")}>
        {n === 52 ? c.yearOpt : fmt(c.weeksOpt, { n })}
      </Link>)}
    </nav>

    <section aria-labelledby="climb-heading" className="leblond-premium-surface space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="climb-heading" className="text-lg font-bold">{c.climbTitle}</h2>
        <Evidence kind="observed" fr={fr} />
      </div>
      {snap.counts.sessions === 0 ? <p className="text-sm text-ink-2">
        {fr ? "Aucune séance de grimpe enregistrée sur cette période." : "No climbing sessions logged in this period."}{" "}
        <Link href="/session/new" className={linkClass}>{fr ? "Commencer une séance" : "Start a session"}</Link>
      </p> : <>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label={fr ? "Séances" : "Sessions"} value={String(snap.counts.sessions)} />
          <Tile label={fr ? "Essais" : "Attempts"} value={String(snap.counts.attempts)} />
          <Tile label={fr ? "Blocs réussis" : "Sends"} value={String(snap.counts.tops)} hint={`${snap.counts.flashes} flash`} />
          <Tile label={fr ? "Taux de réussite" : "Send rate"} value={formatRatio(snap.sendRate)} hint={fr ? `${snap.counts.problems} blocs essayés` : `${snap.counts.problems} problems tried`} />
        </div>
        {chartSystem ? <div className="grid grid-cols-1 gap-6 border-t border-line pt-4 lg:grid-cols-2">
          <LevelCurve plain t={t} locale={locale} system={chartSystem} now={now}
            points={weeklyHardest(dataset.problems, dataset.attempts, chartSystem, now, days)} />
          <GradePyramid plain t={t} locale={locale} system={chartSystem}
            rows={gradePyramid(dataset.problems, dataset.attempts, chartSystem, now, days)} />
        </div> : null}
        <div className="border-t border-line pt-4">
          <h3 className="text-base font-bold">{c.climbTops}</h3>
          <div className="mt-2">
            <WeeklyBars weeks={climbWeeks} locale={locale}
              labels={{ tops: c.topsLabel, sessions: c.sessionsLabel, caption: c.climbTops, range: c.rangeLabel, help: t.progress.weeklyHelp, weekOf: c.weekOfLabel }} />
          </div>
        </div>
      </>}
      <p className="text-sm text-ink-2">
        <strong>{fr ? "Niveau de travail observé" : "Observed working grade"} :</strong>{" "}
        {working.level ? `${working.level} (${working.sampleSize} ${fr ? "blocs, 60 j" : "problems, 60 d"})` : (fr ? "données insuffisantes" : "insufficient data")}
      </p>
      <Link href="/progress" className={cn(linkClass, "text-sm")}>{fr ? "Tous mes résultats de grimpe" : "All my climbing results"} <IconNext /></Link>
    </section>

    {routes ? <RouteStats locale={locale} ascents={routes} now={now} /> : null}

    <section aria-labelledby="train-heading" className="leblond-premium-surface space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="train-heading" className="text-lg font-bold">{c.trainTitle}</h2>
        <Evidence kind="recorded" fr={fr} />
      </div>
      {training === null ? <p role="alert" className="text-sm text-danger">{fr ? "Données d’entraînement indisponibles." : "Training data unavailable."}</p>
        : recent.length === 0 ? <p className="text-sm text-ink-2">
          {fr ? "Pas d’entraînement sur cette période. Tes progrès en grimpe ci-dessus restent complets sans programme."
              : "No training in this period. Your climbing progress above is complete without a plan."}{" "}
          <Link href="/programmes" className={linkClass}>{fr ? "Découvrir les programmes" : "Explore programmes"}</Link>
        </p> : <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Tile label={fr ? "Réalisées / prévues" : "Completed / due"} value={`${adh.completed} / ${adh.planned}`}
            hint={adh.completionRate === null ? undefined : `${Math.round(adh.completionRate * 100)} %`} />
          <Tile label={fr ? "Temps actif" : "Active time"} value={`${adh.activeMinutes} min`} />
          <Tile label={fr ? "Effort perçu moyen" : "Average RPE"} value={adh.averageRpe === null ? "—" : `${adh.averageRpe} / 10`} />
          <Tile label={fr ? "À venir" : "Upcoming"} value={String(adh.upcoming)} hint={adh.painReports ? (fr ? `${adh.painReports} douleur(s) ≥ 3 signalée(s)` : `${adh.painReports} pain report(s) ≥ 3`) : undefined} />
        </div>}
      {done.length ? <div className="border-t border-line pt-4">
        <MinutesBars locale={locale} weeks={trainWeeks} caption={c.trainMinutes} help={c.trainHelp} />
      </div> : null}
      <Link href="/follow-up/training" className={cn(linkClass, "text-sm")}>{fr ? "Historique d’entraînement" : "Training history"} <IconNext /></Link>
    </section>

    {mobilityUsed ? <section aria-labelledby="mobility-heading" className="leblond-premium-surface space-y-4 p-5 sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 id="mobility-heading" className="text-lg font-bold">{c.mobTitle}</h2>
        <Evidence kind="recorded" fr={fr} />
      </div>
      <p className="text-sm text-ink-2">{fmt(mob.fuCardText, {
        sessions: mobOverview.sessionsLast28,
        level: LEVEL_LABELS[contentLevel(mobility.enrollment?.workingLevel ?? 0)].name[locale],
      })}</p>
      <div className="border-t border-line pt-4">
        <MinutesBars locale={locale} weeks={mobWeeks} caption={c.mobMinutes} help={c.mobHelp} />
      </div>
      <div className="space-y-2 border-t border-line pt-4">
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
  </div>;
}
