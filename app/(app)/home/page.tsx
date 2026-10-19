import Link from "next/link";
import Image from "next/image";
import { requireViewer } from "@/lib/auth/viewer";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n";

/**
 * Two independent entry points. Tracking is the default experience;
 * opting into a structured training journey is never a prerequisite.
 * Both can share the same underlying recorded sessions.
 */
export const metadata = { title: "LEBLOND — Your climbing, your way" };

export default async function HomePage() {
  const viewer = await requireViewer();
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  const fr = locale === "fr";
  const { data: live } = await viewer.supabase.from("sessions")
    .select("id, gyms(name)").is("ended_at", null).limit(1).maybeSingle();

  return <div className="space-y-8">
    <header>
      <p className="leblond-eyebrow text-accent">LEBLOND · CLIMBING INTELLIGENCE</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
        {fmt(t.home.hello, { name: viewer.profile.display_name })}
      </h1>
      <p className="mt-2 max-w-3xl text-base leading-relaxed text-ink-2">
        {fr ? "Deux façons de progresser. Choisis celle qui te ressemble aujourd’hui — tu peux changer à tout moment."
            : "Two ways to make progress. Choose what suits you today — switch whenever you want."}
      </p>
    </header>

    <section className="leblond-hero-panel grid gap-5 p-5 sm:grid-cols-[minmax(0,1fr)_200px] sm:items-center sm:p-7">
      <div className="space-y-3">
        <p className="leblond-eyebrow text-blue-200">LEBLOND · ROAD TO 7A</p>
        <h2 className="max-w-lg text-2xl font-extrabold tracking-tight sm:text-3xl">
          {fr ? "Ton escalade. Ton rythme." : "Your climbing. Your pace."}
        </h2>
        <p className="max-w-lg text-sm leading-relaxed text-blue-100">
          {fr ? "Un carnet de grimpe autonome. Et, si tu le souhaites, un parcours d’entraînement structuré."
              : "A complete climbing diary. And, if you want it, a structured training journey."}
        </p>
      </div>
      <Image src="/brand/leblond-approved-hero.svg" width={480} height={480}
        alt={fr ? "LeBlond, grimpeur suspendu au-dessus d’un paysage bleu" : "LeBlond climber above a blue landscape"}
        unoptimized priority className="leblond-hero-art mx-auto aspect-square h-auto w-full max-w-[200px]" />
    </section>

    <section aria-labelledby="choose-path" className="space-y-4">
      <div>
        <h2 id="choose-path" className="text-xl font-extrabold tracking-tight">
          {fr ? "Que veux-tu faire ?" : "What would you like to do?"}
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          {fr ? "Deux parcours autonomes, complémentaires, sans obligation de passer de l’un à l’autre."
              : "Two independent, complementary journeys. Neither requires the other."}
        </p>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">
        <article className="leblond-premium-surface flex flex-col p-6 sm:p-7">
          <span className="text-xs font-extrabold uppercase tracking-[0.13em] text-accent">
            {fr ? "01 · UTILISATION LIBRE" : "01 · FREE TRACKING"}
          </span>
          <h3 className="mt-4 text-2xl font-extrabold tracking-tight">
            {fr ? "Je veux juste enregistrer mes séances" : "I just want to log my climbing"}
          </h3>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-2">
            {fr ? "Grimpe, note tes essais, tes réussites et tes projets. Consulte tes statistiques quand tu veux. Aucun test, objectif ou programme exigé."
                : "Climb, log attempts, sends and projects. Check your results whenever you like. No assessment, goal or plan required."}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/session/new" className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-extrabold text-accent-ink hover:opacity-90">
              {fr ? "Enregistrer une séance" : "Log a session"} →
            </Link>
            <Link href="/climbing" className="inline-flex min-h-11 items-center justify-center rounded-full border border-line px-5 py-3 text-sm font-bold text-accent hover:bg-accent-soft">
              {fr ? "Mon carnet" : "My climbing diary"}
            </Link>
          </div>
        </article>
        <article className="leblond-premium-surface flex flex-col p-6 sm:p-7">
          <span className="text-xs font-extrabold uppercase tracking-[0.13em] text-accent">
            {fr ? "02 · PARCOURS GUIDÉ" : "02 · GUIDED JOURNEY"}
          </span>
          <h3 className="mt-4 text-2xl font-extrabold tracking-tight">
            {fr ? "Je veux atteindre un objectif avec un plan" : "I want a training plan toward a goal"}
          </h3>
          <p className="mt-3 flex-1 text-sm leading-relaxed text-ink-2">
            {fr ? "Définis ton objectif, suis un protocole de bilan initial, choisis une méthode, construis ton calendrier et réévalue tes progrès."
                : "Set a goal, follow a baseline-assessment protocol, select a method, build your calendar and review progress."}
          </p>
          <div className="mt-6">
            <Link href="/train" className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-5 py-3 text-sm font-extrabold text-accent-ink hover:opacity-90">
              {fr ? "Construire mon parcours" : "Build my training journey"} →
            </Link>
          </div>
        </article>
      </div>
      <p className="text-sm text-ink-2">
        {fr ? "Les séances enregistrées dans le carnet alimentent automatiquement le suivi, que tu aies un programme ou non."
            : "Sessions logged in your diary contribute to your progress tracking whether or not you use a training plan."}
        {" "}
        <Link href="/follow-up" className="font-bold text-accent underline underline-offset-4">
          {fr ? "Voir mon suivi" : "View my progress"} →
        </Link>
      </p>
    </section>
    {live ? <Link href={`/session/${live.id}`}
      className="block rounded-2xl border border-accent/30 bg-accent-soft p-4 text-sm font-bold text-accent hover:border-accent">
      ● {t.home.liveSession}{live.gyms?.name ? " · "+live.gyms.name : ""} ↗
    </Link> : null}
  </div>;
}
