import Image from "next/image";
import { ForgetOfflineData } from "@/components/offline/forget-offline-data";
import { Notice } from "@/components/ui/card";
import { normalizeInviteCode } from "@/lib/auth/invite-code";
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
  // Invitation link (/login?invite=ABCDE-FGHJK): the code is checked when the account is created.
  const rawInvite = typeof params.invite === "string" ? params.invite : null;
  const invite = normalizeInviteCode(rawInvite);
  return (
    <main className="leblond-login-glow pt-safe flex min-h-dvh items-center justify-center px-4 py-5 sm:px-6 sm:py-9">
      <ForgetOfflineData />
      <div className="grid grid-cols-1 w-full max-w-5xl overflow-hidden rounded-2xl border border-line bg-surface shadow-[0_28px_100px_-50px_rgba(9,41,77,0.42)] md:grid-cols-2">
        <div className="flex items-center justify-center bg-[#164775] p-3 sm:p-5 md:p-7">
          <Image
            src="/brand/leblond-approved-hero.svg"
            alt="LeBlond — climber suspended by one hand above the blue sea"
            width={720}
            height={720}
            unoptimized
            priority
            className="aspect-square h-auto max-h-[360px] w-full rounded-2xl object-contain md:max-h-none"
          />
        </div>
        <div className="flex flex-col justify-center p-6 sm:p-9 lg:p-12">
          <header className="mb-7">
            <span className="leblond-eyebrow text-accent">THE CLIMBING INTELLIGENCE STUDIO</span>
            <h1 className="mt-4 text-ink text-2xl font-bold tracking-tight md:text-3xl">{t.auth.title}</h1>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-ink-2">{t.auth.subtitle}</p>
          </header>
          <section aria-label={t.auth.title}>
            {params.error === "link" || params.error === "invite" ? (
              <div className="mb-5">
                <Notice tone="error">{params.error === "link" ? t.auth.linkError : t.auth.notInvited}</Notice>
              </div>
            ) : null}
            {rawInvite && !invite ? (
              <div className="mb-5">
                <Notice tone="error">{t.auth.inviteInvalid}</Notice>
              </div>
            ) : null}
            {publicSupabaseEnv()
              ? <LoginForm next={next} googleEnabled={googleEnabled} invite={invite} />
              : <Notice tone="warn">{t.auth.notConfigured}</Notice>}
          </section>
        </div>
      </div>
    </main>
  );
}
