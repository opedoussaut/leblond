import Image from "next/image";
import { redirect } from "next/navigation";
import { Wordmark } from "@/components/brand/wordmark";
import { LinkButton } from "@/components/ui/button";
import { getViewer } from "@/lib/auth/viewer";
import { getI18n } from "@/lib/i18n/server";

export default async function LandingPage() {
  const viewer = await getViewer().catch(() => null);
  if (viewer) redirect("/home");
  const { t } = await getI18n();
  return (
    <main className="pt-safe mx-auto flex min-h-dvh max-w-md flex-col px-5 pb-10">
      <div className="py-5">
        <Wordmark />
      </div>
      <div className="relative overflow-hidden rounded-3xl">
        <Image
          src="/brand/leblond-hero.webp"
          alt="LEBLOND"
          width={900}
          height={900}
          priority
          className="h-auto w-full"
        />
      </div>
      <h1 className="mt-6 text-3xl font-black leading-tight tracking-tight">{t.landing.tagline}</h1>
      <p className="mt-3 text-ink-2">{t.landing.pitch}</p>
      <LinkButton href="/login" size="lg" className="mt-6 w-full">
        {t.landing.signIn}
      </LinkButton>
      <p className="mt-3 text-center text-sm text-ink-3">{t.landing.closedBeta}</p>
      <p className="mt-auto pt-10 text-xs text-ink-3">{t.landing.disclaimer}</p>
    </main>
  );
}
