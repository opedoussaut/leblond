import { Notice } from "@/components/ui/card";
import { getI18n } from "@/lib/i18n/server";
import { publicSupabaseEnv } from "@/lib/supabase/public-env";
import { safeNext } from "@/lib/validation/common";
import { LoginForm } from "./login-form";

export const metadata = { title: "LEBLOND — Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const { t } = await getI18n();
  const next = safeNext(params.next);
  const googleEnabled = process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === "true";
  return (
    <main className="leblond-login-glow pt-safe flex min-h-dvh flex-col items-center justify-center px-5 py-12">
      <header className="pb-8 text-center">
        <span className="leblond-eyebrow text-accent">THE CLIMBING INTELLIGENCE STUDIO</span>
        <p className="mt-4 text-3xl font-extrabold tracking-[0.06em] text-ink">LeBlond</p>
      </header>
      <h1 className="text-center text-3xl font-extrabold tracking-tight">{t.auth.title}</h1>
      <p className="mt-3 max-w-md text-center text-sm leading-relaxed text-ink-2">{t.auth.subtitle}</p>
      <section className="leblond-premium-surface mt-8 w-full max-w-md p-6 sm:p-8">
        {params.error === "link" ? <Notice tone="error">{t.auth.linkError}</Notice> : null}
        {publicSupabaseEnv()
          ? <LoginForm next={next} googleEnabled={googleEnabled} />
          : <Notice tone="warn">{t.auth.notConfigured}</Notice>}
      </section>
    </main>
  );
}
