import Link from "next/link";
import { AREA_ICONS, PAGE_ICONS } from "@/components/layout/nav-icons";
import { AlterEgoScore } from "@/components/training/alter-ego-score";
import { FollowProgramme } from "@/components/training/follow-programme";
import { PlanEditor } from "@/components/training/plan-editor";
import { ProgrammeCard, ReplanBanner } from "@/components/training/programme-card";
import { PageHeader } from "@/components/ui/card";
import { buttonClass, linkClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { IconCheck, IconNext } from "@/components/ui/icons";
import { pactProgress } from "@/lib/analytics/alter-ego";
import { requireViewer } from "@/lib/auth/viewer";
import { loadClimberWork, loadOpenRival } from "@/lib/data/alter-ego";
import { rivalStanding } from "@/lib/analytics/rival";
import { loadProgramme } from "@/lib/data/programme";
import { listTrainingSessions } from "@/lib/data/training-sessions";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { alterEgoDictionary } from "@/lib/i18n/alter-ego";
import { areasDictionary } from "@/lib/i18n/areas";
import { mobilityDictionary } from "@/lib/i18n/mobility";
import { getI18n } from "@/lib/i18n/server";
import { trainingDictionary } from "@/lib/i18n/training";
import { journeyDictionary } from "@/lib/i18n/training-journey";
import { parseContext } from "@/lib/training/assessment-protocol";
import { METHODS_FOR_PLANS } from "@/lib/training/catalogue";
import { healthFromContext } from "@/lib/training/health";
import { HIP_PROGRAMME, LEVEL_LABELS, contentLevel } from "@/lib/training/hip-mobility/content";
import { PLAN_COLUMNS, planFromRow, type SavedTrainingPlan } from "@/lib/training/plans";
import { localDate_, mondayOf } from "@/lib/training/sessions";

export const metadata = { title: "Programmes" };

/**
 * Programmes: what the climber follows. The main programme and its rival first,
 * hip mobility alongside, the full assessment that builds or re-adjusts a
 * programme, then the programme editor and how it all fits together.
 */
export default async function ProgrammesPage({ searchParams }: PageProps<"/programmes">) {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const fr = locale === "fr";
  const a = areasDictionary(locale).programmes;
  const ego = alterEgoDictionary(locale);
  const mob = mobilityDictionary(locale);
  const tp = trainingDictionary(locale);
  const h = journeyDictionary(locale).hub;
  const sp = await searchParams;
  const addMethod = typeof sp.add === "string" && METHODS_FOR_PLANS.some((m) => m.id === sp.add) ? sp.add : "";
  const today = localDate_(new Date());

  const [sessions, { count: assessments }, rival, work, programme, { data: mobility }, { data: assessment }, plansResult] = await Promise.all([
    listTrainingSessions(viewer.supabase, 100),
    viewer.supabase.from("training_assessments").select("id", { count: "exact", head: true }),
    loadOpenRival(viewer.supabase),
    loadClimberWork(viewer.supabase),
    loadProgramme(viewer.supabase, today),
    viewer.supabase.from("mobility_enrollments").select("working_level,status").eq("programme", HIP_PROGRAMME).maybeSingle(),
    // Declared health (latest full assessment) feeds the editor's assisted mode.
    viewer.supabase.from("training_assessments").select("context").order("created_at", { ascending: false }).limit(1).maybeSingle(),
    viewer.supabase.from("training_plans").select(`${PLAN_COLUMNS}, updated_at`).order("updated_at", { ascending: false }).limit(20),
  ]);
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
  const dateLabel = (date: string) => formatDate(date + "T12:00:00", locale, { day: "numeric", month: "long" });
  const methodTitle = view ? METHODS_FOR_PLANS.find((m) => m.id === view.methodId)?.title ?? view.methodId : "";

  const steps = [
    { no: "01", href: "/profile", done: !!viewer.profile.target_grade,
      title: fr ? "Définir mon objectif" : "Set my goal",
      detail: fr ? "Discipline, niveau actuel et niveau visé — sans date de réussite garantie." : "Discipline, current and target level — no guaranteed deadline." },
    { no: "02", href: "/train/assess", done: (assessments ?? 0) > 0,
      title: h.stepFullTitle, detail: h.stepFullDetail },
    { no: "03", href: "#plans-heading", done: !!view?.plan || plans.length > 0,
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

  return <div className="space-y-8">
    <PageHeader icon={<AREA_ICONS.programmes />} title={a.title} subtitle={a.subtitle} />

    {programme.replan.suggested ? <ReplanBanner locale={locale} replan={programme.replan} /> : null}

    <ProgrammeCard locale={locale} view={view} today={today} />
    <FollowProgramme locale={locale} plans={plans.map((p) => ({ id: p.id, name: p.name }))} followed={followed} today={today} />

    {rival ? <AlterEgoScore locale={locale} pact={rival.pact} portrait={rival.settings.portrait} href="/train/alter-ego"
      progress={{ ...pactProgress(rival.pact, work, today), standing: rivalStanding(rival.pact, rival.settings, work, today) }} />
      : <section aria-labelledby="ego-empty-heading" className="leblond-premium-surface flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 id="ego-empty-heading" className="text-lg font-bold">{ego.title}</h2>
          <p className="mt-1 text-sm text-ink-2">{ego.cardEmpty}</p>
        </div>
        <Link href="/train/alter-ego" className={buttonClass("secondary", "md", "shrink-0")}>{ego.cardSign}</Link>
      </section>}

    <section aria-labelledby="mobility-heading" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="mobility-heading" className="flex items-center gap-2 text-lg font-bold text-ink"><PAGE_ICONS.mobility aria-hidden="true" className="h-5 w-5 shrink-0 text-accent" />{mob.hubTitle}</h2>
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold text-ink-2">{mob.hubBadge}</span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{mob.hubText}</p>
        {mobility ? <p className="mt-2 text-sm font-bold text-ink">
          {fmt(mob.hubLevel, { level: LEVEL_LABELS[contentLevel(mobility.working_level)].name[locale] })}{mobility.status === "PAUSED" ? " · " + mob.paused : ""}
        </p> : null}
      </div>
      <Link href="/train/mobility" className={buttonClass(mobility ? "primary" : "secondary", "md", "shrink-0")}>{mobility ? mob.hubOpen : mob.hubCta} <IconNext /></Link>
    </section>

    {/* The full assessment builds or re-adjusts a programme. */}
    <section aria-labelledby="assessment-heading" className="flex flex-col justify-between gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="assessment-heading" className="flex items-center gap-2 text-lg font-bold text-ink"><PAGE_ICONS.assessment aria-hidden="true" className="h-5 w-5 shrink-0 text-accent" />{h.fullTitle}</h2>
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold text-ink-2">{h.fullBadge}</span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{h.fullText}</p>
        {view ? <p className={"mt-2 text-sm font-bold " + (view.reassessmentDue ? "text-warn" : "text-ink")}>
          {fmt(view.reassessmentDue ? h.fullDue : h.fullNext, { date: dateLabel(view.nextReassessment) })}
        </p> : null}
      </div>
      <Link href="/train/assess" className={buttonClass(view && !view.reassessmentDue ? "secondary" : "primary", "md", "self-start")}>
        {view ? h.fullAgain : h.fullCta} <IconNext />
      </Link>
    </section>

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

    <details className="rounded-2xl border border-line bg-surface p-4 text-sm sm:p-5">
      <summary className="min-h-11 cursor-pointer py-2 font-bold">{h.howTitle}</summary>
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
    </details>

    <p className="text-sm"><Link href="/atlas" className={cn(linkClass)}>{a.library} <IconNext /></Link></p>
  </div>;
}
