import { PageHeader } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth/viewer";
import { getI18n } from "@/lib/i18n/server";
import { ProfileForm } from "./profile-form";

export const metadata = { title: "Réglages" };

export default async function SettingsPage() {
  const viewer = await requireViewer();
  const { t } = await getI18n(viewer.profile.preferred_language);
  const p = viewer.profile;
  return (
    <div>
      <PageHeader title={t.settings.title} />
      <ProfileForm
        initial={{
          displayName: p.display_name,
          language: p.preferred_language === "en" ? "en" : "fr",
          targetSystem: p.target_grade_system,
          targetGrade: p.target_grade,
          heightCm: p.height_cm?.toString() ?? "",
          weightKg: p.weight_kg?.toString() ?? "",
          climbingSince: p.climbing_since ?? "",
          bio: p.bio ?? "",
        }}
      />
    </div>
  );
}
