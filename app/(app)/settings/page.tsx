import { PageHeader } from "@/components/ui/card";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { requireViewer } from "@/lib/auth/viewer";
import { getI18n } from "@/lib/i18n/server";
import { CoachKeys } from "@/components/settings/coach-keys";
import { listCoachKeys } from "@/lib/data/coach-sessions";
import { ProfilePhotoEditor } from "@/components/settings/profile-photo-editor";
import { viewerPicture } from "@/lib/data/profile-picture";
import Link from "next/link";
import { gradeHarmoniseDictionary } from "@/lib/i18n/grade-harmonise";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Réglages" };

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  const [coachKeys, picture] = await Promise.all([listCoachKeys(viewer.supabase), viewerPicture()]);
  const p = viewer.profile;
  return (
    <div>
      <PageHeader icon={<PAGE_ICONS.settings />} title={t.settings.title} />
      <ProfilePhotoEditor locale={locale} userId={viewer.userId} photoUrl={picture.photoUrl} level={picture.level} />
      <ProfileForm
        initial={{
          displayName: p.display_name,
          language: p.preferred_language === "en" ? "en" : "fr",
          targetSystem: p.target_grade_system,
          targetGrade: p.target_grade,
          targetDiscipline: p.target_discipline,
          targetRouteGrade: p.target_route_grade ?? "",
          boulderGrade: p.self_reported_level ?? "",
          boulderSystem: p.self_reported_level_system ?? "FONT",
          routeGrade: p.self_reported_route_grade ?? "",
          heightCm: p.height_cm?.toString() ?? "",
          weightKg: p.weight_kg?.toString() ?? "",
          climbingSince: p.climbing_since ?? "",
          bio: p.bio ?? "",
        }}
      />
      <Link href="/settings/grades" data-testid="settings-grades-link"
        className="leblond-premium-surface mt-4 flex min-h-12 items-center justify-between gap-3 px-5 py-4 hover:border-accent">
        <span className="min-w-0">
          <span className="block text-lg font-bold">{gradeHarmoniseDictionary(locale).settings.cardTitle}</span>
          <span className="mt-0.5 block text-sm text-ink-2">{gradeHarmoniseDictionary(locale).settings.cardHint}</span>
        </span>
        <span aria-hidden="true" className="text-ink-3">→</span>
      </Link>
      <CoachKeys locale={locale} keys={coachKeys} />
    </div>
  );
}
