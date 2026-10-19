import Link from "next/link";
import Image from "next/image";
import { AreaCard } from "@/components/layout/area-card";
import { AtlasIcon, ProgressIcon, SessionIcon } from "@/components/layout/nav-icons";
import { requireViewer } from "@/lib/auth/viewer";
import { getI18n } from "@/lib/i18n/server";
import { fmt } from "@/lib/i18n";

export const metadata = { title: "LEBLOND — Accueil" };

/** The home screen is a navigator, not a place to mix data collection,
 * coaching simulation and retrospective statistics in one endless feed. */
export default async function HomePage() {
  const viewer = await requireViewer();
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  const fr = locale === "fr";
  const { data: live } = await viewer.supabase.from("sessions")
    .select("id, gyms(name)").is("ended_at", null).limit(1).maybeSingle();

  return <div className="space-y-7">
    <header>
      <p className="leblond-eyebrow text-accent">LEBLOND · CLIMBING INTELLIGENCE</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
        {fmt(t.home.hello, { name: viewer.profile.display_name })}
      </h1>
      <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-2 sm:text-base">
        {fr
          ? "Un espace pour chaque besoin : grimper, préparer tes entraînements ou analyser ta progression. Choisis où tu veux aller."
          : "A dedicated space for each goal: log your climbing, plan training, or review progress. Choose where to begin."}
      </p>
    </header>

    <section className="leblond-hero-panel grid gap-6 p-5 sm:grid-cols-[minmax(0,1fr)_220px] sm:items-center sm:p-7">
      <div className="space-y-3">
        <p className="leblond-eyebrow text-blue-200">
          {fr ? "TON ESCALADE, À TON RYTHME" : "YOUR CLIMBING, YOUR PACE"}
        </p>
        <h2 className="max-w-lg text-2xl font-extrabold tracking-tight sm:text-3xl">
          {fr ? "Libre de grimper. Libre de progresser." : "Climb freely. Progress on your terms."}
        </h2>
        <p className="max-w-lg text-sm leading-relaxed text-blue-100">
          {fr
            ? "Un carnet utile sans programme obligatoire. Un entraînement plus structuré si tu en as envie."
            : "A useful training diary without a required plan. Structured guidance only if you choose it."}
        </p>
      </div>
      <Image src="/brand/leblond-approved-hero.svg"
        alt={fr ? "LEBLOND : grimpeur suspendu par une main" : "LEBLOND: a climber hanging by one hand"}
        width={480} height={480} unoptimized priority
        className="leblond-hero-art mx-auto aspect-square h-auto w-full max-w-[220px]" />
    </section>

    <section aria-labelledby="home-areas" className="space-y-4">
      <h2 id="home-areas" className="text-lg font-extrabold">
        {fr ? "Mes espaces" : "My spaces"}
      </h2>
      <div className="grid gap-4 md:grid-cols-3">
        <AreaCard href="/climbing" icon={<SessionIcon />}
          title={t.nav.climbing}
          description={fr
            ? "Séances, essais et projets. Enregistre ce que tu grimpes, sans méthode imposée."
            : "Sessions, attempts and projects. Log climbs, no method required."}
          emphasis/>
        <AreaCard href="/train" icon={<AtlasIcon />}
          title={t.nav.training}
          description={fr
            ? "Training Atlas, calendrier, programmes et Patrick. Prépare tes prochaines séances."
            : "Training Atlas, calendar, programs and Patrick. Plan your next sessions."}/>
        <AreaCard href="/follow-up" icon={<ProgressIcon />}
          title={t.nav.followUp}
          description={fr
            ? "Statistiques, évaluations et historique. Compare les résultats réels aux scénarios."
            : "Statistics, assessments and history. Compare observations with scenarios."}/>
      </div>
    </section>
    {live ? <Link href={`/session/${live.id}`}
      className="block rounded-2xl border border-accent/30 bg-accent-soft p-4 text-sm font-bold text-accent hover:border-accent">
      ● {t.home.liveSession}{live.gyms?.name ? " · "+live.gyms.name : ""} ↗
    </Link> : null}
  </div>;
}
