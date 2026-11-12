import Link from "next/link";
import { AreaCard } from "@/components/layout/area-card";
import { AREA_ICONS, PAGE_ICONS } from "@/components/layout/nav-icons";
import { AlterEgoScore } from "@/components/training/alter-ego-score";
import { ProgrammeCard, ReplanBanner } from "@/components/training/programme-card";
import { PageHeader } from "@/components/ui/card";
import { pactProgress } from "@/lib/analytics/alter-ego";
import { requireViewer } from "@/lib/auth/viewer";
import { loadClimberWork, loadOpenPact } from "@/lib/data/alter-ego";
import { loadProgramme } from "@/lib/data/programme";
import { listTrainingSessions } from "@/lib/data/training-sessions";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { alterEgoDictionary } from "@/lib/i18n/alter-ego";
import { getI18n } from "@/lib/i18n/server";
import { journeyDictionary } from "@/lib/i18n/training-journey";
import { mobilityDictionary } from "@/lib/i18n/mobility";
import { HIP_PROGRAMME, LEVEL_LABELS, contentLevel } from "@/lib/training/hip-mobility/content";
import { METHODS_FOR_PLANS } from "@/lib/training/catalogue";
import { localDate_ } from "@/lib/training/sessions";
import { buttonClass } from "@/components/ui/button";

export const metadata = { title: "LEBLOND — Training journey" };

export default async function TrainingHome() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const fr = locale === "fr";
  const ego = alterEgoDictionary(locale);
  const j = journeyDictionary(locale);
  const h = j.hub;
  const today = localDate_(new Date());
  const mob = mobilityDictionary(locale);
  const [sessions, { count: assessments }, { count: plans }, pact, work, programme, { data: mobility }] = await Promise.all([
    listTrainingSessions(viewer.supabase, 100),
    viewer.supabase.from("training_assessments").select("id", { count: "exact", head: true }),
    viewer.supabase.from("training_plans").select("id", { count: "exact", head: true }),
    loadOpenPact(viewer.supabase),
    loadClimberWork(viewer.supabase),
    loadProgramme(viewer.supabase, today),
    viewer.supabase.from("mobility_enrollments").select("working_level,status").eq("programme", HIP_PROGRAMME).maybeSingle(),
  ]);
  const view = programme.view;
  const live = sessions?.find((s) => s.status === "IN_PROGRESS");
  const next = sessions?.filter((s) => s.status === "PLANNED" && (s.scheduledDate ?? today) >= today)
    .sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? ""))[0];
  const featured = live ?? next;
  const dateLabel = (date: string) => formatDate(date + "T12:00:00", locale, { day: "numeric", month: "long" });
  const methodTitle = view ? METHODS_FOR_PLANS.find((m) => m.id === view.methodId)?.title ?? view.methodId : "";

  const steps = [
    { no: "01", href: "/profile", done: !!viewer.profile.target_grade,
      title: fr ? "Définir mon objectif" : "Set my goal",
      detail: fr ? "Discipline, niveau actuel et niveau visé — sans date de réussite garantie." : "Discipline, current and target level — no guaranteed deadline." },
    { no: "02", href: "/train/assess", done: (assessments ?? 0) > 0,
      title: h.stepFullTitle, detail: h.stepFullDetail },
    { no: "03", href: "/training-plans", done: !!view?.plan || (plans ?? 0) > 0,
      title: h.stepProgrammeTitle,
      detail: view ? fmt(h.stepProgrammeDone, { method: methodTitle }) + " " + h.stepProgrammeDetail : h.stepProgrammeDetail },
    { no: "04", href: "/calendar", done: (sessions ?? []).some((s) => s.scheduledDate),
      title: fr ? "Planifier mes séances" : "Schedule my sessions",
      detail: fr ? "Place les séances de ta semaine type dans ton agenda." : "Place your weekly template's sessions in your calendar." },
    { no: "05", href: "/train/sessions", done: (sessions ?? []).some((s) => s.status === "COMPLETED"),
      title: fr ? "Réaliser et enregistrer mes séances" : "Run and record my sessions",
      detail: fr ? "Lecteur de séance : exercices, séries, repos, effort et résumé." : "Session player: exercises, sets, rest, effort and summary." },
    { no: "06", href: "/follow-up/training", done: false,
      title: fr ? "Observer et réévaluer" : "Review and reassess",
      detail: fr ? "Prévu vs réalisé, puis nouvelle évaluation complète pour comparer." : "Planned vs completed, then a new full assessment to compare." },
  ];

  return <div className="space-y-8">
    <PageHeader icon={<AREA_ICONS.training />}
      title={fr ? "S’entraîner" : "Training"}
      subtitle={fr ? "Évaluer, préparer, réaliser et planifier ton entraînement." : "Assess, prepare, execute and schedule your training."}/>

    {programme.replan.suggested ? <ReplanBanner locale={locale} replan={programme.replan} /> : null}

    <section aria-label={h.entriesTitle} className="space-y-3">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-accent/30 bg-accent-soft p-5 sm:p-6">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="flex items-center gap-2 text-lg font-extrabold text-ink"><PAGE_ICONS.dayCheck aria-hidden="true" className="h-5 w-5 shrink-0 text-accent" />{h.dayTitle}</h3>
              <span className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-bold text-accent">{h.dayBadge}</span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">{h.dayText}</p>
            {programme.todayCheck ? <p className="mt-2 text-sm font-bold text-ink">{fmt(h.dayDone, { outcome: j.outcomes[programme.todayCheck.outcome].toLowerCase() })}</p> : null}
          </div>
          <Link href="/train/today" className={buttonClass(programme.todayCheck ? "secondary" : "primary", "md")}>
            {programme.todayCheck ? h.dayRedo : h.dayCta} →
          </Link>
        </div>
        <div className="flex flex-col justify-between gap-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
          <div>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="flex items-center gap-2 text-lg font-extrabold text-ink"><PAGE_ICONS.assessment aria-hidden="true" className="h-5 w-5 shrink-0 text-accent" />{h.fullTitle}</h3>
              <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold text-ink-2">{h.fullBadge}</span>
            </div>
            <p className="mt-1 text-sm leading-relaxed text-ink-2">{h.fullText}</p>
            {view ? <p className={"mt-2 text-sm font-bold " + (view.reassessmentDue ? "text-warn" : "text-ink")}>
              {fmt(view.reassessmentDue ? h.fullDue : h.fullNext, { date: dateLabel(view.nextReassessment) })}
            </p> : null}
          </div>
          <Link href="/train/assess" className={buttonClass(view && !view.reassessmentDue ? "secondary" : "primary", "md")}>
            {view ? h.fullAgain : h.fullCta} →
          </Link>
        </div>
      </div>
    </section>

    <section aria-labelledby="mobility-heading" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h2 id="mobility-heading" className="flex items-center gap-2 text-lg font-extrabold text-ink"><PAGE_ICONS.mobility aria-hidden="true" className="h-5 w-5 shrink-0 text-accent" />{mob.hubTitle}</h2>
          <span className="rounded-full bg-surface-2 px-2.5 py-0.5 text-xs font-bold text-ink-2">{mob.hubBadge}</span>
        </div>
        <p className="mt-1 text-sm leading-relaxed text-ink-2">{mob.hubText}</p>
        {mobility ? <p className="mt-2 text-sm font-bold text-ink">
          {fmt(mob.hubLevel, { level: LEVEL_LABELS[contentLevel(mobility.working_level)].name[locale] })}{mobility.status === "PAUSED" ? " · " + mob.paused : ""}
        </p> : null}
      </div>
      <Link href="/train/mobility" className={buttonClass(mobility ? "primary" : "secondary", "md", "shrink-0")}>{mobility ? mob.hubOpen : mob.hubCta} →</Link>
    </section>

    <ProgrammeCard locale={locale} view={view} today={today} />

    <section aria-labelledby="today-heading" className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 id="today-heading" className="text-xs font-extrabold uppercase tracking-[0.12em] text-accent">
          {live ? (fr ? "Séance en cours" : "Session in progress") : (fr ? "Prochaine séance au calendrier" : "Next session in the calendar")}
        </h2>
        {featured ? <>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-ink">{featured.title}</p>
          <p className="mt-1 text-sm text-ink-2">
            {featured.scheduledDate ? formatDate(featured.scheduledDate + "T12:00:00", locale, { weekday: "long", day: "numeric", month: "long" }) : ""}
            {featured.plannedMinutes ? ` · ${featured.plannedMinutes} min` : ""}
          </p>
          <Link href={"/train/sessions/" + featured.id}
            className={buttonClass("primary", "md", "mt-4")}>
            {live ? (fr ? "Reprendre" : "Resume") : (fr ? "Ouvrir et démarrer" : "Open and start")} →
          </Link>
        </> : <>
          <p className="mt-2 text-lg font-bold text-ink">{fr ? "Aucune séance planifiée." : "No session planned."}</p>
          <p className="mt-1 text-sm text-ink-2">{fr ? "Lance une séance ponctuelle ou planifie ton programme." : "Start a one-off session or schedule your plan."}</p>
        </>}
      </div>
      <div className="leblond-premium-surface flex flex-col justify-between gap-4 p-5 sm:p-6">
        <div>
          <h2 className="text-lg font-extrabold">{fr ? "Séance ponctuelle" : "One-off session"}</h2>
          <p className="mt-1 text-sm text-ink-2">{fr ? "Pas besoin de programme : choisis une méthode et commence." : "No plan needed: pick a method and go."}</p>
        </div>
        <Link href="/train/sessions" className={buttonClass("secondary", "md")}>
          {fr ? "Nouvelle séance d’entraînement" : "New training session"} +
        </Link>
      </div>
    </section>

    <details className="rounded-2xl border border-line bg-surface p-4 text-sm">
      <summary className="cursor-pointer font-bold">{h.howTitle}</summary>
      <p className="mt-2 leading-relaxed text-ink-2">{h.howText}</p>
    </details>

    {pact ? <AlterEgoScore locale={locale} pact={pact} progress={pactProgress(pact, work, today)} href="/train/alter-ego" />
      : <section aria-labelledby="ego-empty-heading" className="leblond-premium-surface flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div>
          <h2 id="ego-empty-heading" className="text-lg font-bold">{ego.title}</h2>
          <p className="mt-1 text-sm text-ink-2">{ego.cardEmpty}</p>
        </div>
        <Link href="/train/alter-ego" className={buttonClass("secondary", "md", "shrink-0")}>{ego.cardSign}</Link>
      </section>}

    <section aria-labelledby="journey-heading" className="space-y-4">
      <h2 id="journey-heading" className="text-lg font-extrabold">{fr ? "Mon parcours, étape par étape" : "My journey, step by step"}</h2>
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {steps.map((step) => <li key={step.no}>
          <Link href={step.href}
            className="group flex h-full gap-4 rounded-2xl border border-line bg-surface p-5 transition-colors hover:border-accent">
            <span className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black tabular-nums " +
              (step.done ? "bg-accent text-accent-ink" : "bg-accent-soft text-accent")} aria-hidden="true">{step.done ? "✓" : step.no}</span>
            <span className="block">
              <strong className="block text-base font-extrabold text-ink">{step.title}{step.done ? <span className="sr-only"> ({fr ? "fait" : "done"})</span> : null}</strong>
              <span className="mt-1 block text-sm leading-relaxed text-ink-2">{step.detail}</span>
            </span>
          </Link>
        </li>)}
      </ol>
    </section>

    <section className="grid grid-cols-1 gap-4 sm:grid-cols-3" aria-label={fr ? "Ressources" : "Resources"}>
      <AreaCard href="/atlas" icon={<PAGE_ICONS.atlas />} title="Training Atlas"
        description={fr ? "Fiches de méthodes, comparaisons et sources." : "Method sheets, comparisons and sources."}/>
      <AreaCard href="/calendar" icon={<PAGE_ICONS.calendar />} title={fr ? "Agenda" : "Calendar"}
        description={fr ? "Séances prévues, réalisées et repos." : "Planned and completed sessions, rest days."}/>
      <AreaCard href="/patrick" icon={<AREA_ICONS.patrick />} title="Patrick"
        description={fr ? "Conseils facultatifs, sans obligation." : "Optional guidance, no commitment."}/>
    </section>
    <p className="text-sm text-ink-2">
      {fr ? "Tu veux simplement grimper ? " : "Just want to climb? "}
      <Link href="/climbing" className="font-bold text-accent underline underline-offset-4">{fr ? "Ouvrir le carnet de grimpe" : "Open your climbing journal"} →</Link>
    </p>
  </div>;
}
