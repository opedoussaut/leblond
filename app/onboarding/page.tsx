import { redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth/viewer";
import { listGymsWithFavourites } from "@/lib/data/gyms";
import { OnboardingWizard } from "./wizard";

export const metadata = { title: "Bienvenue" };

export default async function OnboardingPage() {
  const viewer = await requireViewer({ allowIncompleteOnboarding: true });
  if (viewer.profile.onboarding_completed_at) redirect("/home");
  const { gyms, favouriteIds } = await listGymsWithFavourites(viewer.supabase, viewer.userId);
  return (
    <main className="pt-safe mx-auto min-h-dvh max-w-md px-5 pb-10 pt-6">
      <OnboardingWizard
        profile={{
          displayName: viewer.profile.display_name,
          language: viewer.profile.preferred_language === "en" ? "en" : "fr",
          targetGrade: viewer.profile.target_grade,
          targetSystem: viewer.profile.target_grade_system,
        }}
        gyms={gyms}
        favouriteIds={favouriteIds}
      />
    </main>
  );
}
