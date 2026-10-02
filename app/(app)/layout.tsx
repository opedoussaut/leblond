import { Wordmark } from "@/components/brand/wordmark";
import { AppNav } from "@/components/layout/app-nav";
import { requireViewer } from "@/lib/auth/viewer";

/** Authenticated shell. Onboarding has its own layout without navigation. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const { count } = await viewer.supabase
    .from("sessions")
    .select("id", { count: "exact", head: true })
    .is("ended_at", null);
  return (
    <div className="min-h-dvh md:pl-56">
      <div className="pt-safe hidden md:fixed md:left-0 md:top-0 md:z-40 md:block md:w-56 md:px-5 md:py-6">
        <Wordmark size={28} />
      </div>
      <main className="mx-auto max-w-2xl px-4 pb-32 pt-5 md:px-8 md:pb-12 md:pt-8">{children}</main>
      <AppNav hasLiveSession={(count ?? 0) > 0} />
    </div>
  );
}
