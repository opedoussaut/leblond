import Link from "next/link";
import { AREA_ICONS, PAGE_ICONS } from "@/components/layout/nav-icons";
import { SectionTabs } from "@/components/layout/section-tabs";
import { FollowProgramme } from "@/components/training/follow-programme";
import { PlanEditor } from "@/components/training/plan-editor";
import { ProgrammeCard, ReplanBanner } from "@/components/training/programme-card";
import { PageHeader } from "@/components/ui/card";
import { buttonClass, linkClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { IconCheck, IconNext } from "@/components/ui/icons";
import { requireViewer } from "@/lib/auth/viewer";
import { redirect } from "next/navigation";
import { loadProgramme } from "@/lib/data/programme";
import { listTrainingSessions } from "@/lib/data/training-sessions";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { areasDictionary } from "@/lib/i18n/areas";
import { planLabel } from "@/lib/training/plan-label";
import { catalogueChoices } from "@/lib/training/programme-catalogue";
import { mobilityDictionary } from "@/lib/i18n/mobility";
import { getI18n } from "@/lib/i18n/server";
import { trainingDictionary } from "@/lib/i18n/training";
import { journeyDictionary } from "@/lib/i18n/training-journey";
import { PROGRAMME_TABS, parseProgrammeTab, programmeHref } from "@/lib/navigation/programme-tabs";
import { parseContext } from "@/lib/training/assessment-protocol";
import { assessmentOverview } from "@/lib/training/assessment-overview";
import { assessmentDictionary } from "@/lib/i18n/assessment";
import { AssessmentHero, heroButton } from "@/components/training/assessment-overview";
import { HeadingMark, ToneIcon } from "@/components/ui/hero-figure";
import { METHODS_FOR_PLANS } from "@/lib/training/catalogue";
import { healthFromContext } from "@/lib/training/health";
import { HIP_PROGRAMME, LEVEL_LABELS, contentLevel } from "@/lib/training/hip-mobility/content";
import { loadRebuild } from "@/lib/data/mobility-rebuild";
import { RebuildEntryCard } from "@/components/training/rebuild-view";
import { PLAN_COLUMNS, planFromRow, type SavedTrainingPlan } from "@/lib/training/plans";
import { localDate_, mondayOf } from "@/lib/training/sessions";

export const metadata = { title: "Programmes" };

/**
 * Mes programmes, in sections (?tab=…, listed in the sidebar under the page):
 * the programme in progress (overview), the editor, the full
 * assessment with hip mobility, and how it all fits together.
 */
export default async function ProgrammesPage({ searchParams }: PageProps<"/programmes">) {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const fr = locale === "fr";
  const a = areasDictionary(locale).programmes;
  const mob = mobilityDictionary(locale);
  const rebuild = await loadRebuild(viewer.supabase);
  const tp = trainingDictionary(locale);
  const h = journeyDictionary(locale).hub;
  const sp = await searchParams;
  const addMethod = typeof sp.add === "string" && METHODS_FOR_PLANS.some((m) => m.id === sp.add) ? sp.add : "";
  const today = localDate_(new Date());
  // The rival moved to its own area.
  if (sp.tab === "rival") redirect("/rival");
  const tab = parseProgrammeTab(sp.tab, sp.add);

  const [sessions, { count: assessments }, programme, { data: mobility }, { data: assessment }, plansResult] = await Promise.all([
    listTrainingSessions(viewer.supabase, 100),
    viewer.supabase.from("training_assessments").select("id", { count: "exact", head: true }),
    loadProgramme(viewer.supabase, today),
    viewer.supabase.from("mobility_enrollments").select("working_level,status").eq("programme", HIP_PROGRAMME).maybeSingle(),
    // Declared health (latest full assessment) feeds the editor's assisted mode.
    viewer.supabase.from("training_assessments").select("context").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    viewer.supabase.from("training_plans").select(`${PLAN_COLUMNS}, updated_at`).order("updated_at", { ascending: false }).limit(20),
  ]);
  // The latest full assessment and its weekly check-ins, for its status on the checks section.
  const { data: current } = tab === "checks"
    ? await viewer.supabase.from("training_assessments").select("id, method_id, horizon_weeks, sessions_per_week, goal, created_at")
      .order("created_at", { ascending: false }).limit(1).maybeSingle()
    : { data: null };
  const { data: currentCheckins } = current
    ? await viewer.supabase.from("training_checkins").select("week").eq("assessment_id", current.id).limit(100)
    : { data: [] };
  const overview = current ? assessmentOverview({ createdAt: current.created_at, horizonWeeks: current.horizon_weeks },
    (currentCheckins ?? []).map((c) => c.week), new Date(), today) : null;
  const ov = assessmentDictionary(locale).overview;
  // Kept apart so the page still works before the followed-programme migration.
  const { data: followedRow } = await viewer.supabase.from("training_plans").select("id, followed_since")
    .not("followed_since", "is", null).limit(1).maybeSingle();
  const followed = followedRow?.followed_since ? { id: followedRow.id, since: followedRow.followed_since } : null;
  const health = healthFromContext(parseContext(assessment?.context ?? null));
  const plans: SavedTrainingPlan[] = (plansResult.data ?? []).flatMap((row) => {
    const parsed = planFromRow(row);
    return parsed ? [{ ...parsed, id: row.id, updatedAt: row.updated_at }] : [];
  });
  const view = programme.view;
  const methodTitle = view ? METHODS_FOR_PLANS.find((m) => m.id === view.methodId)?.title ?? view.methodId : "";

  const steps = [
    { no: "01", href: "/profile", done: !!viewer.profile.target_grade,
      title: fr ? "Définir mon objectif" : "Set my goal",
      detail: fr ? "Discipline, niveau actuel et niveau visé — sans date de réussite garantie." : "Discipline, current and target level — no guaranteed deadline." },
    { no: "02", href: "/train/assess", done: (assessments ?? 0) > 0,
      title: h.stepFullTitle, detail: h.stepFullDetail },
    { no: "03", href: programmeHref("editor"), done: !!view?.plan || plans.length > 0,
      title: h.stepProgrammeTitle,
      detail: view ? fmt(h.stepProgrammeDone, { method: methodTitle }) + " " + h.stepProgrammeDetail : h.stepProgrammeDetail },
    { no: "04", href: "/calendar", done: (sessions ?? []).some((s) => s.scheduledDate),
      title: fr ? "Planifier mes séances" : "Schedule my sessions",
      detail: fr ? "Place les séances de ta semaine type dans ton agenda." : "Place your weekly template's sessions in your calendar." },
    { no: "05", href: "/session?type=training", done: (sessions ?? []).some((s) => s.status === "COMPLETED"),
      title: fr ? "Réaliser et enregistrer mes séances" : "Run and record my sessions",
      detail: fr ? "Lecteur de séance : exercices, séries, repos, effort et résumé." : "Session player: exercises, sets, rest, effort and summary." },
    { no: "06", href: "/follow-up/training", done: false,
      title: fr ? "Observer et réévaluer" : "Review and reassess",
      detail: fr ? "Prévu vs réalisé, puis nouvelle évaluation complète pour comparer." : "Planned vs completed, then a new full assessment to compare." },
  ];

  const tabs = PROGRAMME_TABS.map((id) => ({ id, href: programmeHref(id), label: a.tabs[id] }));

  return <div className="space-y-8">
    <PageHeader icon={<AREA_ICONS.programmes />} title={a.title} subtitle={a.subtitle} />
    <SectionTabs label={a.sections} tabs={tabs} current={tab} />

    {programme.replan.suggested ? <ReplanBanner locale={locale} replan={programme.replan} /> : null}

    {tab === "overview" ? <>
      <ProgrammeCard locale={locale} view={view} today={today} />
      <FollowProgramme locale={locale} plans={plans.map((p) => ({ id: p.id, name: planLabel(p, { withGoal: a.planWithGoal, plain: a.planPlain }) }))} catalogue={catalogueChoices(locale, a)} followed={followed} today={today} />
      <p className="text-sm"><Link href="/atlas" className={cn(linkClass)}>{a.library} <IconNext /></Link></p>
    </> : null}

    {tab === "editor" ? <>
      <section aria-labelledby="plans-heading" className="space-y-3">
        <div>
          <h2 id="plans-heading" className="text-lg font-bold">{a.mine}</h2>
          <p className="mt-1 text-sm text-ink-2">{a.mineHint}</p>
        </div>
        {plansResult.error ? (
          <p role="alert" className="rounded-xl border border-warn bg-surface p-4 text-sm text-ink-2">{tp.unavailable}</p>
        ) : (
          <PlanEditor initialPlans={plans} locale={locale} addMethod={addMethod} today={today} monday={mondayOf(today)} health={health} />
        )}
      </section>
    </> : null}

    {tab === "checks" ? <div className="space-y-8">
      {/* The current full assessment first: its status, its week and the one thing to do now. */}
      {current && overview ? <AssessmentHero locale={locale} overview={overview} testId="assessment-status"
        method={METHODS_FOR_PLANS.find((m) => m.id === current.method_id)?.title ?? current.method_id}
        actions={<>
          {overview.next.kind === "reassess"
            ? <Link href="/train/assess?new=1" className={heroButton(true)}>{h.fullAgain} <IconNext /></Link>
            : overview.next.kind === "checkin"
              ? <Link href="/train/assess#checkin" className={heroButton(true)}>{fmt(ov.checkinCta, { week: overview.next.week })} <IconNext /></Link>
              : null}
          <Link href="/train/assess" className={heroButton(overview.next.kind === "wait" || overview.next.kind === "done")}>{ov.resultsCta} <IconNext /></Link>
        </>} />
        : <section aria-labelledby="assessment-heading" className="leblond-hero-panel relative isolate p-5 sm:p-7">
          <PAGE_ICONS.assessment aria-hidden="true" strokeWidth={1.25}
            className="pointer-events-none absolute -right-6 -top-8 -z-10 size-44 text-white/[0.07] sm:size-56" />
          <p className="leblond-eyebrow text-blue-200">{h.fullTitle} · {h.fullBadge}</p>
          <h2 id="assessment-heading" className="mt-3 text-2xl font-bold text-white sm:text-3xl">{ov.emptyTitle}</h2>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-blue-100">{ov.emptyText}</p>
          <div className="leblond-actions mt-5">
            <Link href="/train/assess?new=1" className={heroButton(true)}>{h.fullCta} <IconNext /></Link>
          </div>
        </section>}

      <section aria-labelledby="checks-list-heading" className="space-y-3">
        <h2 id="checks-list-heading" className="flex items-center gap-2 px-1 text-xs font-bold uppercase tracking-[0.12em] text-ink-3">
          <HeadingMark />{a.tabs.checks}
        </h2>
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {current ? <li>
            <section aria-labelledby="assessment-heading" className="leblond-premium-surface leblond-elevated flex h-full flex-col gap-4 p-5">
              <div className="flex items-start gap-3">
                <ToneIcon icon={PAGE_ICONS.assessment} tone="blue" />
                <div className="min-w-0 flex-1">
                  <h3 id="assessment-heading" className="text-base font-bold text-ink">{h.fullTitle}</h3>
                  <p className="mt-0.5 text-xs font-semibold text-ink-3">{h.fullBadge}</p>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-ink-2">{h.fullText}</p>
              <div className="mt-auto flex flex-wrap gap-2">
                <Link href="/train/assess" className={buttonClass("secondary", "md")}>{h.fullOpen} <IconNext /></Link>
                {overview?.next.kind !== "reassess" ? <Link href="/train/assess?new=1" className={buttonClass("ghost", "md")}>{h.fullAgain}</Link> : null}
              </div>
            </section>
          </li> : null}
          <li>
            <section aria-labelledby="mobility-heading" className="leblond-premium-surface leblond-elevated flex h-full flex-col gap-4 p-5">
              <div className="flex items-start gap-3">
                <ToneIcon icon={PAGE_ICONS.mobility} tone="teal" />
                <div className="min-w-0 flex-1">
                  <h3 id="mobility-heading" className="text-base font-bold text-ink">{mob.hubTitle}</h3>
                  <p className="mt-0.5 text-xs font-semibold text-ink-3">{mob.hubBadge}</p>
                </div>
</div>
              <p className="text-sm leading-relaxed text-ink-2">{mob.hubText}</p>
              {mobility ? <p className="text-sm font-bold text-ink">
                {fmt(mob.hubLevel, { level: LEVEL_LABELS[contentLevel(mobility.working_level)].name[locale] })}{mobility.status === "PAUSED" ? " · " + mob.paused : ""}
              </p> : null}
              <div className="mt-auto">
                <Link href="/train/mobility" className={buttonClass(mobility ? "primary" : "secondary", "md")}>{mobility ? mob.hubOpen : mob.hubCta} <IconNext /></Link>
              </div>
            </section>
          </li>
        </ul>
        {rebuild ? <RebuildEntryCard locale={locale} state={rebuild} /> : null}
      </section>
    </div> : null}

    {tab === "guide" ? <>
      <section aria-labelledby="how-heading" className="rounded-2xl border border-line bg-surface p-4 text-sm sm:p-5">
        <h2 id="how-heading" className="text-lg font-bold">{h.howTitle}</h2>
        <p className="mt-2 leading-relaxed text-ink-2">{h.howText}</p>
        <h3 className="mt-5 text-base font-bold">{a.journeyTitle}</h3>
        <ol className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {steps.map((step) => <li key={step.no}>
            <Link href={step.href}
              className="group flex h-full gap-4 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent">
              <span className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black tabular-nums " +
                (step.done ? "bg-accent text-accent-ink" : "bg-accent-soft text-accent")} aria-hidden="true">{step.done ? <IconCheck /> : step.no}</span>
              <span className="block">
                <strong className="block text-base font-bold text-ink">{step.title}{step.done ? <span className="sr-only"> ({fr ? "fait" : "done"})</span> : null}</strong>
                <span className="mt-1 block text-sm leading-relaxed text-ink-2">{step.detail}</span>
              </span>
            </Link>
          </li>)}
        </ol>
      </section>
    </> : null}
  </div>;
}
