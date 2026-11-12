import Link from "next/link";
import { MobilityAssessmentForm } from "@/components/training/mobility-assessment-form";
import { PageHeader } from "@/components/ui/card";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { requireViewer } from "@/lib/auth/viewer";
import { mobilityDictionary } from "@/lib/i18n/mobility";
import { getI18n } from "@/lib/i18n/server";
import { HIP_PROGRAMME } from "@/lib/training/hip-mobility/content";
import { parseStoredConditions } from "@/lib/training/hip-mobility/assessment";
import { localDate_ } from "@/lib/training/sessions";

export const metadata = { title: "LEBLOND — Hip mobility assessment" };

export default async function HipMobilityAssessPage() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const m = mobilityDictionary(locale);
  // The previous set-up is offered again so results stay comparable.
  const { data: last } = await viewer.supabase.from("mobility_assessments").select("conditions")
    .eq("programme", HIP_PROGRAMME).order("assessed_on", { ascending: false }).order("created_at", { ascending: false }).limit(1).maybeSingle();
  return <div className="space-y-5">
    <p className="text-sm"><Link href="/train/mobility" className="font-bold text-accent underline underline-offset-4">← {m.title}</Link></p>
    <PageHeader icon={<PAGE_ICONS.mobility />} title={m.assessTitle} subtitle={m.assessSubtitle} />
    <MobilityAssessmentForm locale={locale} today={localDate_(new Date())} previous={last ? parseStoredConditions(last.conditions) : null} />
  </div>;
}
