import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { BatterySessionActions } from "@/components/training/battery-session-actions";
import { BatteryStopConditions, SelfReportedBadge } from "@/components/training/battery-parts";
import { chipClass, linkClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { IconBack, IconNext } from "@/components/ui/icons";
import { cardStatus, sessionProgress } from "@/lib/analytics/mobility-battery";
import { requireViewer } from "@/lib/auth/viewer";
import { gateOf, loadBatterySession } from "@/lib/data/mobility-battery";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { batteryDictionary } from "@/lib/i18n/mobility-battery";
import { getI18n } from "@/lib/i18n/server";
import { CARDS } from "@/lib/training/mobility-battery/cards";
import { PAINFREE_MAX_REST_PAIN, cardAccess } from "@/lib/training/mobility-battery/safety";
import { pick } from "@/lib/training/sessions";

export const metadata = { title: "LEBLOND — Mobility assessment session" };

/** Session screen: the 20 cards in their two slots, each with its access state. */
export default async function BatterySessionPage({ params }: PageProps<"/train/mobility/battery/[sessionId]">) {
  const { sessionId } = await params;
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const t = batteryDictionary(locale);
  const loaded = await loadBatterySession(viewer.supabase, sessionId);
  if (!loaded) notFound();
  const { session, results } = loaded;
  if (session.status !== "IN_PROGRESS") redirect(`/follow-up/mobility/battery/${session.id}`);
  const gate = gateOf(session, results);
  const progress = sessionProgress(results);
  const date = formatDate(session.startedOn + "T12:00:00", locale, { day: "numeric", month: "long", year: "numeric" });

  const list = (slot: 0 | 1 | 2) => <ul className="divide-y divide-line">
    {CARDS.filter((c) => c.slot === slot).map((c) => {
      const access = cardAccess(c, gate);
      const status = cardStatus(results.filter((r) => r.cardId === c.id));
      const label = status ? t.states[status] : t.states[access.state];
      const tone = status === "DONE" ? "ok" : status === "STOPPED" ? "danger" : access.state === "LOCKED" ? "warn" : "neutral";
      return <li key={c.id}>
        <Link href={`/train/mobility/battery/${session.id}/${c.id}`} aria-label={`${c.id} · ${pick(c.name, locale)} — ${label}`}
          className="flex min-h-14 items-center justify-between gap-3 py-3 hover:bg-surface-2">
          <span className="min-w-0">
            <span className="block text-sm font-bold"><span className="tabular-nums text-ink-3">{c.id}</span> · {pick(c.name, locale)}</span>
            <span className="block text-xs text-ink-3">{pick(c.region, locale)} · {fmt(t.access[c.access], { max: PAINFREE_MAX_REST_PAIN })}</span>
            {access.state === "LOCKED" && !status ? <span className="block text-xs text-warn">{access.reasons.map((r) => t.lockReasons[r]).join(" ")}</span> : null}
          </span>
          <span className={chipClass(tone)}>{label}</span>
        </Link>
      </li>;
    })}
  </ul>;

  return <div className="space-y-6">
    <p className="text-sm"><Link href="/train/mobility/battery" className={linkClass}><IconBack /> {t.short}</Link></p>
    <PageHeader icon={<PAGE_ICONS.mobility />} title={fmt(t.sessionTitle, { date })} subtitle={fmt(t.progress, progress)} action={<SelfReportedBadge locale={locale} />} />

    <section aria-labelledby="slot1" className="rounded-2xl border border-line bg-surface p-5">
      <h2 id="slot1" className="text-lg font-bold">{t.slot1}</h2>
      {list(1)}
    </section>
    <section aria-labelledby="slot2" className="rounded-2xl border border-line bg-surface p-5">
      <h2 id="slot2" className="text-lg font-bold">{t.slot2}</h2>
      <p className="text-xs text-ink-3">{t.slot2Hint}</p>
      {list(2)}
    </section>
    <section aria-labelledby="clinician" className="rounded-2xl border border-line bg-surface-2 p-5">
      <h2 id="clinician" className="text-lg font-bold">{t.clinicianSection}</h2>
      <p className="text-sm text-ink-2">{t.clinicianSectionHint}</p>
      {list(0)}
    </section>

    <BatteryStopConditions locale={locale} />
    <BatterySessionActions locale={locale} sessionId={session.id} />
    <p className="text-sm"><Link href="/follow-up/mobility/battery" className={linkClass}>{t.history} <IconNext /></Link></p>
  </div>;
}
