import type { Metadata } from "next";
import Link from "next/link";
import { Wordmark } from "@/components/brand/wordmark";
import { TrainingExplorer } from "@/components/training/training-explorer";
import { getViewer } from "@/lib/auth/viewer";
import { getI18n } from "@/lib/i18n/server";
import { trainingDictionary } from "@/lib/i18n/training";
import { assessmentDictionary } from "@/lib/i18n/assessment";

export const metadata: Metadata = {
  title: "Training Lab",
  description: "LEBLOND climbing training method and tool comparison atlas.",
};

export default async function TrainingLabPage() {
  const { locale } = await getI18n();
  const t = trainingDictionary(locale);
  const a = assessmentDictionary(locale);
  const viewer = await getViewer().catch(() => null);
  return (
    <main className="mx-auto max-w-6xl px-4 pb-20 pt-6 sm:px-6">
      <header className="flex items-center justify-between gap-4 border-b border-line pb-5">
        <Link href="/" aria-label="LEBLOND home"><Wordmark /></Link>
        <Link href={viewer?.active ? "/training-plans" : "/login?next=%2Ftraining-plans"} className="rounded-full bg-accent px-4 py-2 text-sm font-bold text-accent-ink hover:opacity-90">
          {viewer?.active ? t.myPlans : t.signIn}
        </Link>
      </header>
      <section className="py-10 sm:py-16">
        <p className="mb-3 text-xs font-black uppercase tracking-[0.2em] text-accent">{t.eyebrow}</p>
        <h1 className="max-w-3xl text-4xl font-black leading-tight tracking-tight sm:text-6xl">{t.title}</h1>
        <p className="mt-5 max-w-2xl text-lg leading-relaxed text-ink-2">{t.subtitle}</p>
      </section>
      <section className="mb-8 grid gap-3 sm:grid-cols-2">
        <Link href="/training/evaluate" className="rounded-2xl border border-accent bg-accent-soft p-5 text-ink hover:opacity-90">
          <p className="text-lg font-black">{a.publicEvaluate} →</p>
          <p className="mt-2 text-sm">{a.publicPrivacy}</p>
        </Link>
        <Link href={viewer?.active ? "/training-assessment" : "/login?next=%2Ftraining-assessment"} className="rounded-2xl border border-line bg-surface p-5 hover:bg-surface-2">
          <p className="text-lg font-black">{a.privateTracking} →</p>
          <p className="mt-2 text-sm text-ink-2">{a.subtitle}</p>
        </Link>
      </section>
      <TrainingExplorer locale={locale} />
      <section className="mt-12 rounded-3xl border border-line bg-surface p-6 sm:p-9">
        <h2 className="text-2xl font-black">{t.saveIntro}</h2>
        <p className="mt-2 max-w-2xl text-ink-2">{t.saveDescription}</p>
        <Link href={viewer?.active ? "/training-plans" : "/login?next=%2Ftraining-plans"} className="mt-5 inline-block rounded-xl bg-accent px-5 py-3 font-bold text-accent-ink">
          {viewer?.active ? t.myPlans : t.signIn} →
        </Link>
      </section>
      <p className="mt-8 text-xs leading-relaxed text-ink-3">{t.safety}</p>
    </main>
  );
}
