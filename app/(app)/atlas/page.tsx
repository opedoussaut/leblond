import Link from "next/link";
import { PageHeader } from "@/components/ui/card";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { TrainingExplorer } from "@/components/training/training-explorer";
import { requireViewer } from "@/lib/auth/viewer";
import { getI18n } from "@/lib/i18n/server";
import { trainingDictionary } from "@/lib/i18n/training";
import { buttonClass } from "@/components/ui/button";
import { IconBack, IconExternal } from "@/components/ui/icons";

export const metadata={title:"LEBLOND — Training Atlas"};
export default async function AtlasPage(){
  const viewer=await requireViewer();
  const {locale}=await getI18n(viewer.profile.preferred_language);
  const t=trainingDictionary(locale);
  return <div className="space-y-6">
    <PageHeader icon={<PAGE_ICONS.atlas />} title="Training Atlas" subtitle={locale==="fr"
      ?"Méthodes, outils et coachings : explorations détaillées, comparaisons et ressources vérifiables."
      :"Methods, tools and coaching systems: detailed guides, comparisons and verifiable sources."}/>
    <div className="flex flex-wrap gap-3 text-sm">
      <Link href="/train" className={buttonClass("secondary", "md")}>
        <IconBack /> {locale==="fr"?"S’entraîner":"Train"}
      </Link>
      <Link href="/calendar" className={buttonClass("secondary", "md")}>
        {locale==="fr"?"Mon agenda":"My calendar"} <IconExternal />
      </Link>
      <Link href="/training-plans" className={buttonClass("secondary", "md")}>
        {t.myPlans} <IconExternal />
      </Link>
    </div>
    <TrainingExplorer locale={locale}/>
  </div>;
}
