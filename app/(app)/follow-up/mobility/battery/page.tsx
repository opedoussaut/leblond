import Link from "next/link";
import { rawText, SelfReportedBadge, signedText, unitText } from "@/components/training/battery-parts";
import { buttonClass, chipClass, linkClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { IconBack, IconNext } from "@/components/ui/icons";
import { batteryTrends, finishedSessions, type CardTrend } from "@/lib/analytics/mobility-battery";
import { requireViewer } from "@/lib/auth/viewer";
import { loadBattery } from "@/lib/data/mobility-battery";
import { formatDate } from "@/lib/format";
import { fmt, type Locale } from "@/lib/i18n";
import { batteryDictionary, type BatteryDictionary } from "@/lib/i18n/mobility-battery";
import { getI18n } from "@/lib/i18n/server";
import { CARD_BY_ID, CARDS } from "@/lib/training/mobility-battery/cards";
import { pick } from "@/lib/training/sessions";

export const metadata = { title: "LEBLOND — Mobility assessment history" };

function TrendRow({ trend, t, locale }: { trend: CardTrend; t: BatteryDictionary; locale: Locale }) {
  const card = CARD_BY_ID.get(trend.cardId)!;
  const itemLabel = pick(card.items.find((i) => i.item === trend.item)?.label, locale);
  const title = [card.sides === "LR" ? t.sides[trend.side] : "", itemLabel].filter(Boolean).join(" · ");
  const change = trend.latest?.change ?? null;
  return <div className="space-y-2 border-t border-line pt-3 first:border-0 first:pt-0">
    {title ? <p className="text-sm font-semibold">{title}</p> : null}
    <table className="w-full table-fixed text-sm">
      <thead><tr>{trend.checkpoints.map((c) => <th key={c.label} scope="col" className="text-left text-xs font-bold text-ink-3">{c.label}</th>)}</tr></thead>
      <tbody><tr>{trend.checkpoints.map((c) => <td key={c.label} className="align-top tabular-nums">
        {c.point ? <>
          <span className="block font-semibold">{rawText(t, locale, card, c.point)}</span>
          {c.point.trials.length > 1 ? <span className="block text-[11px] text-ink-3">{c.point.trials.map((v) => v.toLocaleString(locale === "fr" ? "fr-FR" : "en-GB")).join(" / ")}</span> : null}
          {c.point.radiationWorse || (c.point.painAfter ?? 0) > 0 ? <span className="block text-[11px] text-ink-3">{t.painAfterShort} {c.point.painAfter ?? "—"}{c.point.radiationWorse ? " · " + t.radiationOptions.LOWER_OR_STRONGER.toLowerCase() : ""}</span> : null}
        </> : <span className="text-ink-3">—</span>}
      </td>)}</tr></tbody>
    </table>
    {trend.latest && change ? <p className="text-xs">
      {fmt(t.changeSinceS0, { label: trend.latest.label, delta: `${signedText(change.delta, locale)} ${unitText(t, change.unit)}`.trim() })}
      {change.painIncreased ? <span className="text-danger"> · {t.painIncreased}</span>
        : change.withinMdc ? <span className="text-warn"> · {t.withinMdc}</span>
        : change.direction ? <span> · {t.directions[change.direction]}</span> : null}
    </p> : null}
  </div>;
}

/** Suivi › Mobilité › Bilan: history and the trend of each test. */
export default async function BatteryHistoryPage() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const t = batteryDictionary(locale);
  const { sessions, results } = await loadBattery(viewer.supabase);
  const finished = finishedSessions(sessions);
  const trends = batteryTrends(sessions, results);
  const date = (d: string) => formatDate(d + "T12:00:00", locale, { day: "numeric", month: "short", year: "numeric" });

  return <div className="space-y-6">
    <p className="text-sm"><Link href="/follow-up/mobility" className={linkClass}><IconBack /> {locale === "fr" ? "Mobilité" : "Mobility"}</Link></p>
    <PageHeader icon={<PAGE_ICONS.mobility />} title={t.historyTitle} subtitle={t.historySubtitle} action={<SelfReportedBadge locale={locale} />} />
    <p className="text-sm text-ink-2">{t.notDiagnosis}</p>

    <section aria-labelledby="sessions-heading" className="rounded-2xl border border-line bg-surface p-5">
      <h2 id="sessions-heading" className="text-lg font-bold">{t.sessions}</h2>
      {sessions.length ? <ul className="mt-2 divide-y divide-line">
        {sessions.map((s) => <li key={s.id}>
          <Link href={s.status === "IN_PROGRESS" ? `/train/mobility/battery/${s.id}` : `/follow-up/mobility/battery/${s.id}`}
            className="flex min-h-12 items-center justify-between gap-3 py-2 hover:bg-surface-2">
            <span className="text-sm font-semibold">{date(s.startedOn)}</span>
            <span className={chipClass(s.status === "STOPPED" ? "warn" : s.status === "COMPLETED" ? "ok" : "accent")}>{t.statuses[s.status]}</span>
          </Link>
        </li>)}
      </ul> : <div className="mt-2 space-y-3">
        <p className="text-sm text-ink-2">{t.empty}</p>
        <Link href="/train/mobility/battery" className={buttonClass("primary", "md")}>{t.openBattery} <IconNext /></Link>
      </div>}
    </section>

    {finished.length ? <section aria-labelledby="trends-heading" className="space-y-4">
      <h2 id="trends-heading" className="text-lg font-bold">{t.trends}</h2>
      <p className="text-xs text-ink-3">{t.noScore} {t.bestOf}.</p>
      {CARDS.filter((c) => trends.some((tr) => tr.cardId === c.id)).map((c) => <article key={c.id} aria-label={`${c.id} · ${pick(c.name, locale)}`}
        className="space-y-3 rounded-2xl border border-line bg-surface p-5">
        <h3 className="text-base font-bold"><span className="tabular-nums text-ink-3">{c.id}</span> · {pick(c.name, locale)}</h3>
        {trends.filter((tr) => tr.cardId === c.id).map((tr) => <TrendRow key={`${tr.side}:${tr.item}`} trend={tr} t={t} locale={locale} />)}
        <p className="text-[11px] text-ink-3">{c.mdc ? fmt(t.mdc, { value: c.mdc.value.toLocaleString(locale === "fr" ? "fr-FR" : "en-GB"), source: pick(c.mdc.source, locale) }) : t.noMdc}</p>
      </article>)}
    </section> : null}
  </div>;
}
