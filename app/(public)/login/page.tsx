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
    <main className="pt-safe mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10">
      <header className="pb-9 pt-9 text-center">
        <span className="text-xl font-black uppercase tracking-[0.25em]">LEBLOND</span>
      </header>
      <h1 className="text-center text-3xl font-black tracking-tight">{t.auth.title}</h1>
      <p className="mt-2 text-center text-sm leading-relaxed text-ink-2">{t.auth.subtitle}</p>
      <section className="mt-7 rounded-2xl border border-line bg-surface p-5 shadow-sm">
        {params.error === "link" ? <Notice tone="error">{t.auth.linkError}</Notice> : null}
        {publicSupabaseEnv()
          ? <LoginForm next={next} googleEnabled={googleEnabled} />
          : <Notice tone="warn">{t.auth.notConfigured}</Notice>}
      </section>
    </main>
  );
}
