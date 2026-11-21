import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BatteryCardForm } from "@/components/training/battery-card-form";
import { BatteryStopConditions, SelfReportedBadge } from "@/components/training/battery-parts";
import { linkClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { IconBack } from "@/components/ui/icons";
import { requireViewer } from "@/lib/auth/viewer";
import { gateOf, loadBatterySession } from "@/lib/data/mobility-battery";
import { fmt } from "@/lib/i18n";
import { batteryDictionary } from "@/lib/i18n/mobility-battery";
import { getI18n } from "@/lib/i18n/server";
import { CARD_BY_ID, isCardId } from "@/lib/training/mobility-battery/cards";
import { PAINFREE_MAX_REST_PAIN, cardAccess } from "@/lib/training/mobility-battery/safety";
import { pick } from "@/lib/training/sessions";

export const metadata = { title: "LEBLOND — Mobility assessment card" };

/** Test screen: one card. Clinician cards show no instructions, only a transcription form. */
export default async function BatteryCardPage({ params }: PageProps<"/train/mobility/battery/[sessionId]/[cardId]">) {
  const { sessionId, cardId } = await params;
  if (!isCardId(cardId)) notFound();
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const t = batteryDictionary(locale);
  const loaded = await loadBatterySession(viewer.supabase, sessionId);
  if (!loaded) notFound();
  const { session, results } = loaded;
  if (session.status !== "IN_PROGRESS") redirect(`/follow-up/mobility/battery/${session.id}`);
  const card = CARD_BY_ID.get(cardId)!;
  // M01 itself is judged without its own previous values.
  const access = cardAccess(card, gateOf(session, results.filter((r) => r.cardId !== card.id)));
  const saved = results.filter((r) => r.cardId === card.id);
  const clinician = card.access === "clinician_only";

  return <div className="space-y-5">
    <p className="text-sm"><Link href={`/train/mobility/battery/${session.id}`} className={linkClass}><IconBack /> {t.backToSession}</Link></p>
    <PageHeader icon={<PAGE_ICONS.mobility />} title={`${card.id} · ${pick(card.name, locale)}`}
      subtitle={`${pick(card.region, locale)} · ${fmt(t.access[card.access], { max: PAINFREE_MAX_REST_PAIN })}`}
      action={<SelfReportedBadge locale={locale} />} />

    {clinician ? <section aria-labelledby="clin-heading" className="rounded-2xl border border-line bg-surface-2 p-5">
      <h2 id="clin-heading" className="text-base font-bold">{t.clinicianTitle}</h2>
      <p className="mt-1 text-sm text-ink-2">{t.clinicianText}</p>
      <p className="mt-2 text-sm"><strong>{t.record}</strong> — {pick(card.record, locale)}</p>
      <p className="mt-1 text-xs text-ink-3">{pick(card.limit, locale)}</p>
    </section> : <section aria-labelledby="how-heading" className="space-y-3 rounded-2xl border border-line bg-surface p-5">
      <h2 id="how-heading" className="text-base font-bold">{t.how}</h2>
      <ol className="list-decimal space-y-1 pl-5 text-sm">{card.how?.map((h, i) => <li key={i}>{pick(h, locale)}</li>)}</ol>
      <p className="text-sm"><strong>{t.record}</strong> — {pick(card.record, locale)}</p>
      <p className="text-xs text-ink-3"><strong>{t.limit}</strong> — {pick(card.limit, locale)}</p>
      {card.mdc ? <p className="text-xs text-ink-3">{fmt(t.mdc, { value: card.mdc.value.toLocaleString(locale === "fr" ? "fr-FR" : "en-GB"), source: pick(card.mdc.source, locale) })}</p> : null}
      {card.context ? <p className="text-xs text-ink-3"><strong>{t.context}</strong> — {pick(card.context, locale)}</p> : null}
    </section>}

    {clinician ? null : <BatteryStopConditions locale={locale} />}

    <BatteryCardForm locale={locale} sessionId={session.id} card={card} access={access} clinicalReviewOn={session.clinicalReviewOn}
      saved={saved.map((r) => ({
        side: r.side, item: r.item, trial: r.trial, status: r.status, value: r.value, category: r.category, notDoneReason: r.notDoneReason,
        painBefore: r.painBefore, painAfter: r.painAfter, radiation: r.radiation, details: r.details, note: r.note,
      }))} />
  </div>;
}
