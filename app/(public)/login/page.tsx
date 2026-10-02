import { Wordmark } from "@/components/brand/wordmark";
import { Notice } from "@/components/ui/card";
import { getI18n } from "@/lib/i18n/server";
import { publicSupabaseEnv } from "@/lib/supabase/public-env";
import { safeNext } from "@/lib/validation/common";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const { t } = await getI18n();
  const next = safeNext(params.next);
  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10">
      <div className="py-5">
        <Wordmark />
      </div>
      <h1 className="mt-6 text-3xl font-black tracking-tight">{t.auth.title}</h1>
      <p className="mt-2 text-ink-2">{t.auth.subtitle}</p>
      <div className="mt-6 space-y-4">
        {params.error === "link" ? <Notice tone="error">{t.auth.linkError}</Notice> : null}
        {publicSupabaseEnv() ? <LoginForm next={next} /> : <Notice tone="warn">{t.auth.notConfigured}</Notice>}
      </div>
    </main>
  );
}
