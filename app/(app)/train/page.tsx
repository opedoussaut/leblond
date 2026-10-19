import Link from "next/link";
import { AreaCard } from "@/components/layout/area-card";
import { AtlasIcon, CalendarIcon, PatrickIcon } from "@/components/layout/nav-icons";
import { PageHeader } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth/viewer";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "LEBLOND — Training journey" };

export default async function TrainingHome() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const fr = locale === "fr";
  const steps = [
    {
      no: "01", href: "/profile",
      title: fr ? "Définir mon objectif" : "Set my goal",
      detail: fr ? "Discipline, niveau actuel et niveau visé. Sans date de réussite garantie."
                 : "Discipline, current level and target level. No guaranteed deadline.",
      cta: fr ? "Mon profil et mes objectifs" : "My profile and goals",
    },
    {
      no: "02", href: "/train/assess",
      title: fr ? "Faire mon bilan de départ" : "Complete a baseline assessment",
      detail: fr ? "Protocole explicite, conditions comparables, compétences déclarées séparées des données mesurées."
                 : "An explicit protocol, repeatable conditions, self-ratings separate from measured performance.",
      cta: fr ? "Ouvrir le protocole" : "Open assessment protocol",
    },
    {
      no: "03", href: "/training-plans",
      title: fr ? "Choisir et adapter mon programme" : "Choose and adapt my training plan",
      detail: fr ? "Sélectionne les méthodes adaptées à tes objectifs et à ton temps disponible ; aucune prescription automatique."
                 : "Select methods based on your goal and available time; no automatic prescription.",
      cta: fr ? "Mes programmes" : "My training plans",
    },
    {
      no: "04", href: "/calendar",
      title: fr ? "Planifier mes séances" : "Schedule my sessions",
      detail: fr ? "Inscris tes dates, tes séances prévues et les périodes de repos. Le carnet de grimpe reste indépendant."
                 : "Add dates, planned sessions and rest periods. Your climbing diary remains independent.",
      cta: fr ? "Ouvrir le calendrier" : "Open calendar",
    },
    {
      no: "05", href: "/follow-up",
      title: fr ? "Observer et réévaluer" : "Review and reassess",
      detail: fr ? "Compare tes séances réellement enregistrées et tes bilans successifs, sans confondre scénarios et résultats."
                 : "Compare actual logged sessions and follow-up assessments without mistaking scenarios for outcomes.",
      cta: fr ? "Voir mon suivi" : "View my follow-up",
    },
  ];

  return <div className="space-y-8">
    <PageHeader
      title={fr ? "Mon parcours d’entraînement" : "My training journey"}
      subtitle={fr
        ? "Tu as choisi de structurer ta progression. Voici les étapes à suivre, dans l’ordre. Tu peux à tout moment revenir à la grimpe libre."
        : "You have chosen to structure your progress. Follow these steps in order. You can return to free climbing at any time."}/>
    <section aria-labelledby="journey-heading" className="space-y-4">
      <div>
        <h2 id="journey-heading" className="text-lg font-extrabold">
          {fr ? "Les 5 étapes de mon parcours" : "My five-step journey"}
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          {fr ? "Le bilan sert à comprendre ton point de départ ; il ne prédit pas automatiquement une cotation."
              : "The assessment establishes a baseline; it does not automatically predict a climbing grade."}
        </p>
      </div>
      <ol className="space-y-3">
        {steps.map((step) => <li key={step.no}>
          <Link href={step.href}
            className="group grid gap-3 rounded-[1.5rem] border border-line bg-surface p-5 transition-colors hover:border-accent sm:grid-cols-[50px_minmax(0,1fr)_auto] sm:items-center">
            <span className="text-2xl font-black tabular-nums text-accent">{step.no}</span>
            <span className="block">
              <strong className="block text-base font-extrabold text-ink">{step.title}</strong>
              <span className="mt-1 block text-sm leading-relaxed text-ink-2">{step.detail}</span>
            </span>
            <span className="text-sm font-bold text-accent sm:text-right">
              {step.cta} →
            </span>
          </Link>
        </li>)}
      </ol>
    </section>

    <section className="space-y-3" aria-labelledby="training-library-heading">
      <h2 id="training-library-heading" className="text-lg font-extrabold">
        {fr ? "Ressources à consulter librement" : "Explore training resources"}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <AreaCard href="/atlas" icon={<AtlasIcon />} title="Training Atlas"
          description={fr ? "Fiches de méthodes, exercices, comparaisons, ressources, vidéos et croquis disponibles."
                          : "Method details, exercises, comparisons, references, videos and diagrams where available."}/>
        <AreaCard href="/patrick" icon={<PatrickIcon />}
          title={fr ? "Patrick · Conseils facultatifs" : "Patrick · Optional guidance"}
          description={fr ? "Échange sur les options d’entraînement sans devoir adopter un programme."
                          : "Discuss training choices without committing to any plan."}/>
      </div>
    </section>
    <p className="text-sm text-ink-2">
      {fr ? "Tu veux simplement grimper et enregistrer tes résultats ? " : "Just want to climb and log your sessions? "}
      <Link href="/climbing" className="font-bold text-accent underline underline-offset-4">
        {fr ? "Accéder au carnet de grimpe" : "Open your climbing diary"} →
      </Link>
    </p>
  </div>;
}
