import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { AccountMenu } from "@/components/layout/account-menu";
import { AppNav, AreaSubNav } from "@/components/layout/app-nav";
import { RouteFocus } from "@/components/layout/route-focus";
import { PendingSync } from "@/components/offline/pending-sync";
import { requireViewer } from "@/lib/auth/viewer";

/** Authenticated shell. Onboarding has its own layout without navigation. */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await requireViewer();
  const [{ count }, { count: training }] = await Promise.all([
    viewer.supabase.from("sessions").select("id", { count: "exact", head: true }).is("ended_at", null),
    viewer.supabase.from("training_sessions").select("id", { count: "exact", head: true }).eq("status", "IN_PROGRESS"),
  ]);
  const displayName = viewer.profile.display_name || viewer.email.split("@")[0];
  const isAdmin = viewer.role === "admin";
  return (
    <div className="min-h-dvh md:pl-64">
      <div className="hidden md:fixed md:left-0 md:top-0 md:z-40 md:block md:w-64 md:border-r md:border-line md:bg-surface md:px-5 md:py-6">
        <Link href="/home" aria-label="LeBlond" className="inline-flex rounded-lg"><Wordmark size={28} /></Link>
      </div>
      <a href="#app-main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-surface focus:px-4 focus:py-3 focus:text-accent">Skip to content</a>
      {/* Mobile header: brand on the left, account (avatar) menu on the right. */}
      <header className="pt-safe sticky top-0 z-30 border-b border-line bg-surface/95 backdrop-blur md:hidden">
        <div className="flex h-14 items-center justify-between px-4 sm:px-6">
          <Link href="/home" aria-label="LeBlond" className="inline-flex rounded-lg"><Wordmark size={26} /></Link>
          <AccountMenu displayName={displayName} isAdmin={isAdmin} placement="header" />
        </div>
      </header>
      <main id="app-main" className="mx-auto w-full max-w-6xl px-4 pb-28 pt-5 sm:px-6 md:px-10 md:pb-16 md:pt-9 lg:px-12">
        <RouteFocus />
        <AreaSubNav />
        {children}
      </main>
      <PendingSync userId={viewer.userId} />
      <AppNav hasLiveSession={(count ?? 0) > 0} hasLiveTraining={(training ?? 0) > 0}
        displayName={displayName} isAdmin={isAdmin} />
    </div>
  );
}
