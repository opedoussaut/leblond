import { AreaCard } from "@/components/layout/area-card";
import { ProgressIcon, SessionIcon } from "@/components/layout/nav-icons";
import { PageHeader } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth/viewer";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "LEBLOND — Suivi" };
export default async function FollowUpHome() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const fr = locale === "fr";
  return <div className="space-y-7">
    <PageHeader
      title={fr ? "Suivi & progression" : "Follow-up & progress"}
      subtitle={fr
        ? "Ici, on mesure ce qui s’est réellement passé. Les évaluations déclaratives et les scénarios restent identifiés séparément."
        : "Measure what actually happened here. Self-assessments and illustrative scenarios stay clearly distinguished."}/>
    <div className="grid gap-4 sm:grid-cols-2">
      <AreaCard href="/progress" icon={<ProgressIcon />}
        title={fr ? "Mes résultats" : "My results"}
        description={fr ? "Séances enregistrées, tentatives, réussites, tendances et niveau de travail observé." : "Logged sessions, attempts, sends, trends and observed working level."}
        emphasis/>
      <AreaCard href="/training-assessment" icon={<SessionIcon />}
        title={fr ? "Bilans & évaluations" : "Assessments & check-ins"}
        description={fr ? "Bilan des compétences, évaluations successives et scénarios d’évolution : valeurs déclarées versus observations." : "Skill baseline, follow-up check-ins and progress scenarios: reported ratings versus observations."}/>
    </div>
    <div className="rounded-2xl border border-line bg-surface p-4 text-sm text-ink-2">
      {fr
        ? "Actuellement, les statistiques de cotation mesurées concernent le bloc. Les scénarios de l’évaluateur ne sont pas des prédictions scientifiques de cotation."
        : "Measured grade statistics currently cover bouldering. Assessment scenarios are not scientifically calibrated grade predictions."}
    </div>
  </div>;
}
