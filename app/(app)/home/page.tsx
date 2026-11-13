import Link from "next/link";
import Image from "next/image";
import { AreaCard } from "@/components/layout/area-card";
import { AREA_ICONS, PAGE_ICONS } from "@/components/layout/nav-icons";
import { buttonClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth/viewer";
import { formatDate } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n";
import { journeyDictionary } from "@/lib/i18n/training-journey";
import { localDate_ } from "@/lib/training/sessions";
import { IconNext, LiveDot } from "@/components/ui/icons";

/**
 * Aujourd'hui (Today) overview: today's form and agenda first, then
 * "What do I want to do today?" — two balanced, independent journeys.
 * Logging never requires a plan; training is opt-in. Both share one history.
 */
export const metadata = { title: "LEBLOND — Your climbing, your way" };


export default async function HomePage() {
  const viewer = await requireViewer();
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  const fr = locale === "fr";
  const j = journeyDictionary(locale);
  const today = localDate_(new Date());
  const dateLabel = formatDate(today + "T12:00:00", locale, { weekday: "long", day: "numeric", month: "long" });
  const [{ data: live }, { data: training }, { count: plans }, { data: dayCheck }] = await Promise.all([
    viewer.supabase.from("sessions").select("id, gyms(name)").is("ended_at", null).limit(1).maybeSingle(),
    viewer.supabase.from("training_sessions").select("id, title").eq("status", "IN_PROGRESS").limit(1).maybeSingle(),
    viewer.supabase.from("training_plans").select("id", { count: "exact", head: true }),
    viewer.supabase.from("training_day_checks").select("outcome").eq("check_date", today).limit(1).maybeSingle(),
  ]);
  const outcome = dayCheck?.outcome;

  return <div className="space-y-8">
    <div>
      <p className="leblond-eyebrow mb-3 text-accent">LEBLOND · ROAD TO 7A</p>
      <PageHeader icon={<AREA_ICONS.today />} title={fmt(t.home.hello, { name: viewer.profile.display_name })}
        subtitle={dateLabel.charAt(0).toUpperCase() + dateLabel.slice(1)} />
    </div>

    {live || training ? <section aria-label={fr ? "Activité en cours" : "Activity in progress"} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {live ? <Link href={`/session/${live.id}`}
        className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-4 text-accent hover:border-accent">
        <span><span className="block text-xs font-bold uppercase tracking-[0.12em]"><LiveDot /> {t.home.liveSession}</span>
          <strong className="block text-base text-ink">{live.gyms?.name ?? (fr ? "Séance de grimpe" : "Climbing session")}</strong></span>
        <span className="text-sm font-extrabold">{fr ? "Reprendre" : "Resume"} <IconNext /></span>
      </Link> : null}
      {training ? <Link href={`/train/sessions/${training.id}`}
        className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-4 text-accent hover:border-accent">
        <span><span className="block text-xs font-bold uppercase tracking-[0.12em]"><LiveDot /> {fr ? "Entraînement en cours" : "Training in progress"}</span>
          <strong className="block text-base text-ink">{training.title}</strong></span>
        <span className="text-sm font-extrabold">{fr ? "Reprendre" : "Resume"} <IconNext /></span>
      </Link> : null}
    </section> : null}

    <section aria-labelledby="your-day" className="space-y-4">
      <h2 id="your-day" className="text-lg font-bold tracking-tight text-ink-2">{t.home.yourDay}</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <AreaCard href="/train/today" icon={<PAGE_ICONS.dayCheck />} title={t.nav.dayCheck}
          description={t.home.dayCheckText} emphasis={!outcome}
          note={outcome ? fmt(j.hub.dayDone, { outcome: j.outcomes[outcome].toLowerCase() }) : j.hub.dayBadge} />
        <AreaCard href="/calendar" icon={<PAGE_ICONS.calendar />} title={t.nav.calendar}
          description={t.home.agendaText} />
      </div>
    </section>

    <section aria-labelledby="choose-path" className="space-y-4">
      <h2 id="choose-path" className="text-lg font-bold tracking-tight text-ink-2">
        {fr ? "Que veux-tu faire aujourd’hui ?" : "What do you want to do today?"}
      </h2>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <article className="leblond-premium-surface flex flex-col p-6 sm:p-7" aria-labelledby="journey-log">
          <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-accent">{fr ? "Grimper librement" : "Just climb"}</span>
          <h3 id="journey-log" className="mt-3 text-2xl font-bold tracking-tight">
            {fr ? "Enregistrer ma grimpe" : "Log my climbing"}
          </h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-2">
            {fr ? "Note tes séances, essais, réussites et projets. Aucun programme nécessaire."
                : "Record sessions, attempts, sends and projects. No structured program required."}
          </p>
          <div className="leblond-actions mt-6">
            <Link href="/session/new" className={buttonClass("primary")}>{fr ? "Commencer une séance de grimpe" : "Start a climbing session"} <IconNext /></Link>
            <Link href="/session" className={buttonClass("secondary")}>{fr ? "Mon carnet de grimpe" : "View my climbing journal"}</Link>
          </div>
        </article>
        <article className="leblond-premium-surface flex flex-col p-6 sm:p-7" aria-labelledby="journey-train">
          <span className="text-xs font-extrabold uppercase tracking-[0.12em] text-accent">{fr ? "S’entraîner vers un objectif" : "Train toward a goal"}</span>
          <h3 id="journey-train" className="mt-3 text-2xl font-bold tracking-tight">
            {fr ? "Suivre un programme" : "Follow a training plan"}
          </h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-2">
            {fr ? "Évalue ton niveau, identifie tes priorités, prépare un programme et suis ta progression."
                : "Assess your current level, identify development priorities, prepare a plan and track progression."}
          </p>
          <div className="leblond-actions mt-6">
            <Link href="/train" className={buttonClass("primary")}>{fr ? "Commencer mon parcours d’entraînement" : "Start my training journey"} <IconNext /></Link>
            <Link href={(plans ?? 0) > 0 ? "/training-plans" : "/train/sessions"} className={buttonClass("secondary")}>
              {(plans ?? 0) > 0 ? (fr ? "Voir mon programme" : "View my current plan") : (fr ? "Mes séances d’entraînement" : "My training sessions")}
            </Link>
          </div>
        </article>
      </div>
    </section>

    <section className="leblond-hero-panel grid grid-cols-1 gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center sm:p-7">
      <div className="space-y-3">
        <p className="leblond-eyebrow text-blue-200">LEBLOND</p>
        <p className="max-w-lg text-2xl font-extrabold tracking-tight sm:text-3xl">
          {fr ? "Ton escalade. Ton rythme." : "Your climbing. Your pace."}
        </p>
        <p className="max-w-lg text-sm leading-relaxed text-blue-100">
          {fr ? "Tes séances de grimpe alimentent tes progrès, avec ou sans programme. Tu peux passer d’un parcours à l’autre à tout moment."
              : "Your climbing sessions feed your progress, with or without a plan. Switch between journeys whenever you like."}
        </p>
        <Link href="/follow-up" className="inline-block text-sm font-bold text-white underline underline-offset-4">
          {t.home.progressLink} <IconNext />
        </Link>
      </div>
      <Image src="/brand/leblond-approved-hero.svg" width={480} height={480}
        alt={fr ? "LeBlond, grimpeur suspendu au-dessus d’un paysage bleu" : "LeBlond climber above a blue landscape"}
        unoptimized priority className="leblond-hero-art mx-auto aspect-square h-auto w-full max-w-[200px]" />
    </section>
  </div>;
}
