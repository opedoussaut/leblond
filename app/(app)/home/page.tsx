import Link from "next/link";
import Image from "next/image";
import { requireViewer } from "@/lib/auth/viewer";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n";

/**
 * "What do I want to do today?" — two balanced, independent journeys.
 * Logging never requires a plan; training is opt-in. Both share one history.
 */
export const metadata = { title: "LEBLOND — Your climbing, your way" };

const primary = "inline-flex min-h-12 items-center justify-center rounded-full bg-accent px-6 text-sm font-extrabold text-accent-ink transition-opacity hover:opacity-90";
const secondary = "inline-flex min-h-12 items-center justify-center rounded-full border border-line bg-surface px-5 text-sm font-bold text-accent transition-colors hover:bg-accent-soft";

export default async function HomePage() {
  const viewer = await requireViewer();
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  const fr = locale === "fr";
  const [{ data: live }, { data: training }, { count: plans }] = await Promise.all([
    viewer.supabase.from("sessions").select("id, gyms(name)").is("ended_at", null).limit(1).maybeSingle(),
    viewer.supabase.from("training_sessions").select("id, title").eq("status", "IN_PROGRESS").limit(1).maybeSingle(),
    viewer.supabase.from("training_plans").select("id", { count: "exact", head: true }),
  ]);

  return <div className="space-y-8">
    <header>
      <p className="leblond-eyebrow text-accent">LEBLOND · ROAD TO 7A</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
        {fmt(t.home.hello, { name: viewer.profile.display_name })}
      </h1>

    </header>

    {live || training ? <section aria-label={fr ? "Activité en cours" : "Activity in progress"} className="grid gap-3 sm:grid-cols-2">
      {live ? <Link href={`/session/${live.id}`}
        className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-4 text-accent hover:border-accent">
        <span><span className="block text-xs font-bold uppercase tracking-[0.12em]">● {t.home.liveSession}</span>
          <strong className="block text-base text-ink">{live.gyms?.name ?? (fr ? "Séance de grimpe" : "Climbing session")}</strong></span>
        <span className="text-sm font-extrabold">{fr ? "Reprendre" : "Resume"} →</span>
      </Link> : null}
      {training ? <Link href={`/train/sessions/${training.id}`}
        className="flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent-soft p-4 text-accent hover:border-accent">
        <span><span className="block text-xs font-bold uppercase tracking-[0.12em]">● {fr ? "Entraînement en cours" : "Training in progress"}</span>
          <strong className="block text-base text-ink">{training.title}</strong></span>
        <span className="text-sm font-extrabold">{fr ? "Reprendre" : "Resume"} →</span>
      </Link> : null}
    </section> : null}

    <section aria-labelledby="choose-path" className="space-y-4">
      <h2 id="choose-path" className="text-xl font-extrabold tracking-tight text-ink-2">
        {fr ? "Que veux-tu faire aujourd’hui ?" : "What do you want to do today?"}
      </h2>
      <div className="grid gap-5 lg:grid-cols-2">
        <article className="leblond-premium-surface flex flex-col p-6 sm:p-7" aria-labelledby="journey-log">
          <span className="text-xs font-extrabold uppercase tracking-[0.13em] text-accent">{fr ? "Grimper librement" : "Just climb"}</span>
          <h3 id="journey-log" className="mt-3 text-2xl font-extrabold tracking-tight">
            {fr ? "Enregistrer ma grimpe" : "Log my climbing"}
          </h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-2">
            {fr ? "Note tes séances, essais, réussites et projets. Aucun programme nécessaire."
                : "Record sessions, attempts, sends and projects. No structured program required."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/session/new" className={primary}>{fr ? "Commencer une séance de grimpe" : "Start a climbing session"} →</Link>
            <Link href="/session" className={secondary}>{fr ? "Mon carnet de grimpe" : "View my climbing journal"}</Link>
          </div>
        </article>
        <article className="leblond-premium-surface flex flex-col p-6 sm:p-7" aria-labelledby="journey-train">
          <span className="text-xs font-extrabold uppercase tracking-[0.13em] text-accent">{fr ? "S’entraîner vers un objectif" : "Train toward a goal"}</span>
          <h3 id="journey-train" className="mt-3 text-2xl font-extrabold tracking-tight">
            {fr ? "Suivre un programme" : "Follow a training plan"}
          </h3>
          <p className="mt-2 flex-1 text-sm leading-relaxed text-ink-2">
            {fr ? "Évalue ton niveau, identifie tes priorités, prépare un programme et suis ta progression."
                : "Assess your current level, identify development priorities, prepare a plan and track progression."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/train" className={primary}>{fr ? "Commencer mon parcours d’entraînement" : "Start my training journey"} →</Link>
            <Link href={(plans ?? 0) > 0 ? "/training-plans" : "/train/sessions"} className={secondary}>
              {(plans ?? 0) > 0 ? (fr ? "Voir mon programme" : "View my current plan") : (fr ? "Mes séances d’entraînement" : "My training sessions")}
            </Link>
          </div>
        </article>
      </div>
    </section>

    <section className="leblond-hero-panel grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center sm:p-7">
      <div className="space-y-3">
        <p className="leblond-eyebrow text-blue-200">LEBLOND</p>
        <p className="max-w-lg text-2xl font-extrabold tracking-tight sm:text-3xl">
          {fr ? "Ton escalade. Ton rythme." : "Your climbing. Your pace."}
        </p>
        <p className="max-w-lg text-sm leading-relaxed text-blue-100">
          {fr ? "Tes séances de grimpe alimentent ton suivi, avec ou sans programme. Tu peux passer d’un parcours à l’autre à tout moment."
              : "Your climbing sessions feed your follow-up, with or without a plan. Switch between journeys whenever you like."}
        </p>
        <Link href="/follow-up" className="inline-block text-sm font-bold text-white underline underline-offset-4">
          {fr ? "Voir mon suivi" : "View my follow-up"} →
        </Link>
      </div>
      <Image src="/brand/leblond-approved-hero.svg" width={480} height={480}
        alt={fr ? "LeBlond, grimpeur suspendu au-dessus d’un paysage bleu" : "LeBlond climber above a blue landscape"}
        unoptimized priority className="leblond-hero-art mx-auto aspect-square h-auto w-full max-w-[200px]" />
    </section>
  </div>;
}
