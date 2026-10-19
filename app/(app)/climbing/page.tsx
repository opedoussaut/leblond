import Link from "next/link";
import { AreaCard } from "@/components/layout/area-card";
import { ProgressIcon, SessionIcon } from "@/components/layout/nav-icons";
import { PageHeader } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth/viewer";
import { getI18n } from "@/lib/i18n/server";

export const metadata = { title: "LEBLOND — Grimper" };
export default async function ClimbingHome() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const fr = locale === "fr";
  return <div className="space-y-7">
    <PageHeader
      title={fr ? "Grimper" : "Climb"}
      subtitle={fr
        ? "Ton carnet de grimpe. Séances, essais et projets, sans programme obligatoire."
        : "Your climbing log. Sessions, attempts and projects, with no training plan required."}/>
    <Link href="/session/new"
      className="flex min-h-14 items-center justify-center rounded-2xl bg-accent px-6 text-base font-extrabold text-accent-ink hover:opacity-90 sm:inline-flex">
      {fr ? "Commencer une séance de grimpe" : "Start a climbing session"} →
    </Link>
    <div className="grid gap-4 sm:grid-cols-2">
      <AreaCard href="/session" icon={<SessionIcon />}
        title={fr ? "Mes séances" : "My climbing sessions"}
        description={fr ? "Consulte tes sorties, note tes essais et retrouve tes blocs réussis." : "Review past climbs, log attempts and revisit completed boulders."}
        emphasis/>
      <AreaCard href="/projects" icon={<ProgressIcon />}
        title={fr ? "Mes projets" : "My projects"}
        description={fr ? "Garde une trace des blocs que tu travailles et de leur progression." : "Keep track of boulder projects you are working on."}/>
    </div>
    <div className="rounded-2xl border border-line bg-surface p-4 text-sm text-ink-2">
      {fr
        ? "Le journal détaillé actuel suit le bloc. L’enregistrement des voies (cotation, essais et enchaînements) sera développé dans un module séparé pour éviter de mélanger les deux disciplines."
        : "The detailed activity logger currently tracks bouldering. Route logging (grade, attempts, sends) will have its own format so the two disciplines never get mixed."}
    </div>
  </div>;
}
