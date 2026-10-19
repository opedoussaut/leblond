import Image from "next/image";
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
    <main className="leblond-login-glow pt-safe flex min-h-dvh items-center justify-center px-4 py-5 sm:px-6 sm:py-9">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-[2rem] border border-line bg-surface shadow-[0_28px_100px_-50px_rgba(9,41,77,0.42)] md:grid-cols-2">
        <div className="flex items-center justify-center bg-[#164775] p-3 sm:p-5 md:p-7">
          <Image
            src="/brand/leblond-approved-hero.svg"
            alt="LeBlond — climber suspended by one hand above the blue sea"
            width={720}
            height={720}
            unoptimized
            priority
            className="aspect-square h-auto max-h-[360px] w-full rounded-[1.5rem] object-contain md:max-h-none"
          />
        </div>
        <div className="flex flex-col justify-center p-6 sm:p-9 lg:p-12">
          <header className="mb-7">
            <span className="leblond-eyebrow text-accent">THE CLIMBING INTELLIGENCE STUDIO</span>
            <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-ink">{t.auth.title}</h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-2">{t.auth.subtitle}</p>
          </header>
          <section aria-label={t.auth.title}>
            {params.error === "link" ? <Notice tone="error">{t.auth.linkError}</Notice> : null}
            {publicSupabaseEnv()
              ? <LoginForm next={next} googleEnabled={googleEnabled} />
              : <Notice tone="warn">{t.auth.notConfigured}</Notice>}
          </section>
        </div>
      </div>
    </main>
  );
}
