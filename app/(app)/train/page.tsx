import { AreaCard } from "@/components/layout/area-card";
import { AtlasIcon, CalendarIcon, PatrickIcon, ProgressIcon } from "@/components/layout/nav-icons";
import { PageHeader } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth/viewer";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "LEBLOND — S’entraîner" };
export default async function TrainingHome() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const fr = locale === "fr";
  return <div className="space-y-7">
    <PageHeader
      title={fr ? "S’entraîner" : "Train"}
      subtitle={fr
        ? "Choisis une méthode, organise tes dates et utilise Patrick si tu le souhaites. Aucun programme n’est imposé."
        : "Explore a method, plan your dates and work with Patrick if you choose. No plan is mandatory."}/>
    <div className="grid gap-4 sm:grid-cols-2">
      <AreaCard href="/atlas" icon={<AtlasIcon />}
        title="Training Atlas"
        description={fr ? "Comparer les méthodes, ouvrir leurs fiches, croquis et vidéos, et comprendre leurs différences." : "Compare methods, read guides, diagrams and videos, and understand how they differ."}
        emphasis/>
      <AreaCard href="/calendar" icon={<CalendarIcon />}
        title={fr ? "Mon calendrier" : "My training calendar"}
        description={fr ? "Choisis les jours, les horaires et les activités prévues. Retrouve aussi tes séances enregistrées." : "Choose dates, times and planned activities; see recorded sessions alongside them."}/>
      <AreaCard href="/training-plans" icon={<ProgressIcon />}
        title={fr ? "Mes programmes" : "My training plans"}
        description={fr ? "Retrouve et modifie tes programmes. Tu peux aussi t’entraîner sans programme." : "Review and edit training plans, or choose to train without one."}/>
      <AreaCard href="/patrick" icon={<PatrickIcon />}
        title={fr ? "Patrick · Conseils" : "Patrick · Guidance"}
        description={fr ? "Discute de tes objectifs et des méthodes. Le coaching est facultatif." : "Discuss goals and methods. Coaching is entirely optional."}/>
    </div>
  </div>;
}
