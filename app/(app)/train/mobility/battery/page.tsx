import Link from "next/link";
import { BatteryStartForm } from "@/components/training/battery-start-form";
import { BatteryStopConditions } from "@/components/training/battery-parts";
import { buttonClass, linkClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { IconBack, IconNext } from "@/components/ui/icons";
import { nextDue } from "@/lib/analytics/mobility-battery";
import { requireViewer } from "@/lib/auth/viewer";
import { loadBattery } from "@/lib/data/mobility-battery";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { batteryDictionary } from "@/lib/i18n/mobility-battery";
import { getI18n } from "@/lib/i18n/server";
import { BATTERY_INTERVAL_DAYS } from "@/lib/training/mobility-battery/cards";
import { localDate_ } from "@/lib/training/sessions";

export const metadata = { title: "LEBLOND — Mobility assessment" };

/** Entraînement › Mobilité › Bilan: the session screen's entry (safety screen, conditions, start or resume). */
export default async function BatteryPage() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const t = batteryDictionary(locale);
  const { sessions } = await loadBattery(viewer.supabase);
  const open = sessions.find((s) => s.status === "IN_PROGRESS") ?? null;
  const last = sessions.find((s) => s.status !== "IN_PROGRESS") ?? null;
  const due = nextDue(sessions, BATTERY_INTERVAL_DAYS);
  const date = (d: string) => formatDate(d + "T12:00:00", locale, { day: "numeric", month: "long", year: "numeric" });

  return <div className="space-y-6">
    <p className="text-sm"><Link href="/train/mobility" className={linkClass}><IconBack /> {locale === "fr" ? "Mobilité" : "Mobility"}</Link></p>
    <PageHeader icon={<PAGE_ICONS.mobility />} title={t.title} subtitle={t.subtitle} />

    <section className="leblond-premium-surface space-y-3 p-5 sm:p-6">
      <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">{t.organisation.map((s) => <li key={s}>{s}</li>)}</ul>
      <p className="text-sm text-ink-2">{t.notDiagnosis} {t.noScore}</p>
      {last ? <p className="text-sm font-semibold">{fmt(t.lastSession, { date: date(last.startedOn) })}{due ? ` · ${fmt(t.nextDue, { date: date(due) })}` : ""}</p> : null}
      {sessions.length ? <Link href="/follow-up/mobility/battery" className={linkClass}>{t.history} <IconNext /></Link> : null}
    </section>

    <BatteryStopConditions locale={locale} />

    {open ? <Link href={`/train/mobility/battery/${open.id}`} className={buttonClass("primary", "lg", "w-full sm:w-auto")}>{t.resume} <IconNext /></Link>
      : <BatteryStartForm locale={locale} today={localDate_(new Date())} previous={last?.conditions ?? null} clinicalReviewOn={last?.clinicalReviewOn ?? null} />}
  </div>;
}
