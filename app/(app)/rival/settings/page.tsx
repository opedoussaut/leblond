import { redirect } from "next/navigation";
import { AREA_ICONS } from "@/components/layout/nav-icons";
import { PactControls } from "@/components/training/alter-ego-forms";
import { RivalPhotoEditor } from "@/components/training/rival-photo-editor";
import { RivalSettingsForm } from "@/components/training/rival-settings";
import { PageHeader } from "@/components/ui/card";
import { pactProgress } from "@/lib/analytics/alter-ego";
import { requireViewer } from "@/lib/auth/viewer";
import { loadClimberWork, loadOpenRival, rivalPhotoUrl } from "@/lib/data/alter-ego";
import { fmt } from "@/lib/i18n";
import { alterEgoDictionary } from "@/lib/i18n/alter-ego";
import { getI18n } from "@/lib/i18n/server";
import { localDate_ } from "@/lib/training/sessions";

export const metadata = { title: "LEBLOND — Rival settings" };

/** The rival's name, photo and settings, and the pact's controls (pause, resume, finish, abandon). Without a pact: sign one first. */
export default async function RivalSettingsPage() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const t = alterEgoDictionary(locale);
  const rival = await loadOpenRival(viewer.supabase);
  if (!rival) redirect("/rival");
  const { pact, settings } = rival;
  const today = localDate_(new Date());
  const [work, photoUrl] = await Promise.all([loadClimberWork(viewer.supabase), rivalPhotoUrl(viewer.supabase, rival)]);
  const progress = pactProgress(pact, work, today);
  return <div className="space-y-5">
    <PageHeader icon={<AREA_ICONS.rival />} title={t.settingsLink} subtitle={fmt(t.planLabel, { plan: pact.planName }) + " · " + fmt(t.weekOf, { week: progress.week + 1, total: pact.horizonWeeks })
      + (pact.status === "PAUSED" ? ` · ${t.paused}` : "")} />
    <RivalPhotoEditor locale={locale} pactId={pact.id} userId={viewer.userId} photoUrl={photoUrl} portrait={settings.portrait} name={pact.displayName} />
    <RivalSettingsForm locale={locale} pactId={pact.id} initialName={pact.displayName} initial={settings} today={today} open
      hasBoulderGrades={!!pact.startBoulderGrade && !!pact.targetBoulderGrade} hasPhoto={!!photoUrl} />
    <PactControls locale={locale} id={pact.id} status={pact.status} over={progress.over} />
    <p className="text-xs leading-relaxed text-ink-3">{t.fiction}</p>
  </div>;
}
