import { Wordmark } from "@/components/brand/wordmark";
import { AppNav, AreaSubNav } from "@/components/layout/app-nav";
import { RouteFocus } from "@/components/layout/route-focus";
import { requireViewer } from "@/lib/auth/viewer";

/** Authenticated shell. Onboarding has its own layout without navigation. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const [{ count }, { count: training }] = await Promise.all([
    viewer.supabase.from("sessions").select("id", { count: "exact", head: true }).is("ended_at", null),
    viewer.supabase.from("training_sessions").select("id", { count: "exact", head: true }).eq("status", "IN_PROGRESS"),
  ]);
  return (
    <div className="min-h-dvh md:pl-64">
      <div className="hidden md:fixed md:left-0 md:top-0 md:z-40 md:block md:w-64 md:border-r md:border-line md:bg-surface md:px-5 md:py-6">
        <Wordmark size={28} />
      </div>
      <a href="#app-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-3 focus:text-accent">Skip to content</a>
      <main id="app-main" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-6 sm:px-6 md:px-10 md:pb-16 md:pt-9 lg:px-12">
        <RouteFocus />
        <AreaSubNav />
        {children}
      </main>
      <AppNav hasLiveSession={(count ?? 0) > 0} hasLiveTraining={(training ?? 0) > 0} />
    </div>
  );
}
