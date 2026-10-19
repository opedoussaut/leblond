import Link from "next/link";
import type { Metadata } from "next";
import { PublicAssessment } from "@/components/training/public-assessment";
import { Wordmark } from "@/components/brand/wordmark";
import { getI18n } from "@/lib/i18n/server";
import { assessmentDictionary } from "@/lib/i18n/assessment";

export const metadata: Metadata = {
  title: "Free Climbing Self-Assessment",
  description: "Compare a climbing skill self-assessment with an illustrative training-method scenario. No account needed.",
};

export default async function PublicEvaluationPage() {
  const { locale } = await getI18n();
  const t = assessmentDictionary(locale);
  return <main className="mx-auto max-w-4xl px-4 pb-24 pt-6 sm:px-6">
    <header className="flex items-center justify-between gap-4 border-b border-line pb-5">
      <Link href="/" aria-label="LEBLOND"><Wordmark/></Link>
      <Link href="/training" className="text-sm font-bold text-accent underline underline-offset-4">← {t.back}</Link>
    </header>
    <div className="py-9">
      <h1 className="text-4xl font-black">{t.title}</h1>
      <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-2">{t.subtitle}</p>
      <p className="mt-3 text-sm font-semibold text-accent">{t.publicPrivacy}</p>
    </div>
    <PublicAssessment locale={locale}/>
  </main>;
}
