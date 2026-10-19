import Link from "next/link";
import { PageHeader } from "@/components/ui/card";
import { TrainingExplorer } from "@/components/training/training-explorer";
import { requireViewer } from "@/lib/auth/viewer";
import { getI18n } from "@/lib/i18n/server";
import { trainingDictionary } from "@/lib/i18n/training";

export const metadata={title:"LEBLOND — Training Atlas"};
export default async function AtlasPage(){
  const viewer=await requireViewer();
  const {locale}=await getI18n(viewer.profile.preferred_language);
  const t=trainingDictionary(locale);
  return <div className="space-y-6">
    <PageHeader title="Training Atlas" subtitle={locale==="fr"
      ?"Méthodes, outils et coachings : explorations détaillées, comparaisons et ressources vérifiables."
      :"Methods, tools and coaching systems: detailed guides, comparisons and verifiable sources."}/>
    <div className="flex flex-wrap gap-3 text-sm">
      <Link href="/training-assessment" className="rounded-full border border-line bg-surface px-4 py-2.5 font-semibold text-accent">
        {locale==="fr"?"Évaluer mon profil":"Assess my profile"} ↗
      </Link>
      <Link href="/calendar" className="rounded-full border border-line bg-surface px-4 py-2.5 font-semibold text-accent">
        {locale==="fr"?"Mon calendrier":"My calendar"} ↗
      </Link>
      <Link href="/training-plans" className="rounded-full border border-line bg-surface px-4 py-2.5 font-semibold text-accent">
        {t.myPlans} ↗
      </Link>
    </div>
    <TrainingExplorer locale={locale}/>
  </div>;
}
