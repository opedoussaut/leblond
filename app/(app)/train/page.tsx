import Link from "next/link";
import { AreaCard } from "@/components/layout/area-card";
import { AtlasIcon, CalendarIcon, PatrickIcon } from "@/components/layout/nav-icons";
import { PageHeader } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth/viewer";
import { listTrainingSessions } from "@/lib/data/training-sessions";
import { formatDate } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { localDate_ } from "@/lib/training/sessions";

export const metadata = { title: "LEBLOND — Training journey" };

export default async function TrainingHome() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const fr = locale === "fr";
  const [sessions, { count: assessments }, { count: plans }] = await Promise.all([
    listTrainingSessions(viewer.supabase, 100),
    viewer.supabase.from("training_assessments").select("id", { count: "exact", head: true }),
    viewer.supabase.from("training_plans").select("id", { count: "exact", head: true }),
  ]);
  const today = localDate_(new Date());
  const live = sessions?.find((s) => s.status === "IN_PROGRESS");
  const next = sessions?.filter((s) => s.status === "PLANNED" && (s.scheduledDate ?? today) >= today)
    .sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? ""))[0];
  const featured = live ?? next;

  const steps = [
    { no: "01", href: "/profile", done: !!viewer.profile.target_grade,
      title: fr ? "Définir mon objectif" : "Set my goal",
      detail: fr ? "Discipline, niveau actuel et niveau visé — sans date de réussite garantie." : "Discipline, current and target level — no guaranteed deadline." },
    { no: "02", href: "/train/assess", done: (assessments ?? 0) > 0,
      title: fr ? "Faire mon bilan de départ" : "Complete a baseline assessment",
      detail: fr ? "Protocole guidé : tests sûrs mesurés, observations de ton carnet et auto-évaluation, clairement séparés." : "Guided protocol: safe measured tests, journal observations and self-ratings, kept separate." },
    { no: "03", href: "/training-plans", done: (plans ?? 0) > 0,
      title: fr ? "Choisir mon programme" : "Choose my training plan",
      detail: fr ? "Sélectionne des méthodes de l’Atlas selon tes priorités et ton temps." : "Pick Atlas methods for your priorities and available time." },
    { no: "04", href: "/calendar", done: (sessions ?? []).some((s) => s.scheduledDate),
      title: fr ? "Planifier mes séances" : "Schedule my sessions",
      detail: fr ? "Place les séances du programme dans ton calendrier." : "Place plan sessions in your calendar." },
    { no: "05", href: "/train/sessions", done: (sessions ?? []).some((s) => s.status === "COMPLETED"),
      title: fr ? "Réaliser et enregistrer mes séances" : "Run and record my sessions",
      detail: fr ? "Lecteur de séance : exercices, séries, repos, effort et bilan." : "Session player: exercises, sets, rest, effort and summary." },
    { no: "06", href: "/follow-up/training", done: false,
      title: fr ? "Observer et réévaluer" : "Review and reassess",
      detail: fr ? "Prévu vs réalisé, puis nouveau bilan pour comparer." : "Planned vs completed, then reassess to compare." },
  ];

  return <div className="space-y-8">
    <PageHeader
      title={fr ? "S’entraîner" : "Training"}
      subtitle={fr ? "Évaluer, préparer, réaliser et planifier ton entraînement." : "Assess, prepare, execute and schedule your training."}/>

    <section aria-labelledby="today-heading" className="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <div className="rounded-[1.5rem] border border-accent/30 bg-accent-soft p-5 sm:p-6">
        <h2 id="today-heading" className="text-xs font-extrabold uppercase tracking-[0.13em] text-accent">
          {live ? (fr ? "Séance en cours" : "Session in progress") : (fr ? "Prochaine séance" : "Next session")}
        </h2>
        {featured ? <>
          <p className="mt-2 text-2xl font-extrabold tracking-tight text-ink">{featured.title}</p>
          <p className="mt-1 text-sm text-ink-2">
            {featured.scheduledDate ? formatDate(featured.scheduledDate + "T12:00:00", locale, { weekday: "long", day: "numeric", month: "long" }) : ""}
            {featured.plannedMinutes ? ` · ${featured.plannedMinutes} min` : ""}
          </p>
          <Link href={"/train/sessions/" + featured.id}
            className="mt-4 inline-flex min-h-12 items-center rounded-full bg-accent px-6 text-sm font-extrabold text-accent-ink">
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
        <Link href="/train/sessions" className="inline-flex min-h-12 items-center justify-center rounded-full border border-line bg-surface px-5 text-sm font-bold text-accent hover:bg-accent-soft">
          {fr ? "Nouvelle séance d’entraînement" : "New training session"} +
        </Link>
      </div>
    </section>

    <section aria-labelledby="journey-heading" className="space-y-4">
      <h2 id="journey-heading" className="text-lg font-extrabold">{fr ? "Mon parcours, étape par étape" : "My journey, step by step"}</h2>
      <ol className="grid gap-3 sm:grid-cols-2">
        {steps.map((step) => <li key={step.no}>
          <Link href={step.href}
            className="group flex h-full gap-4 rounded-[1.5rem] border border-line bg-surface p-5 transition-colors hover:border-accent">
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

    <section className="grid gap-4 sm:grid-cols-3" aria-label={fr ? "Ressources" : "Resources"}>
      <AreaCard href="/atlas" icon={<AtlasIcon />} title="Training Atlas"
        description={fr ? "Fiches de méthodes, comparaisons et sources." : "Method sheets, comparisons and sources."}/>
      <AreaCard href="/calendar" icon={<CalendarIcon />} title={fr ? "Calendrier" : "Calendar"}
        description={fr ? "Séances prévues, réalisées et repos." : "Planned and completed sessions, rest days."}/>
      <AreaCard href="/patrick" icon={<PatrickIcon />} title="Patrick"
        description={fr ? "Conseils facultatifs, sans obligation." : "Optional guidance, no commitment."}/>
    </section>
    <p className="text-sm text-ink-2">
      {fr ? "Tu veux simplement grimper ? " : "Just want to climb? "}
      <Link href="/climbing" className="font-bold text-accent underline underline-offset-4">{fr ? "Ouvrir le carnet de grimpe" : "Open your climbing journal"} →</Link>
    </p>
  </div>;
}
