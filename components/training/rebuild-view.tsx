import Link from "next/link";
import type { RebuildState } from "@/lib/data/mobility-rebuild";
import { formatDate } from "@/lib/format";
import { fmt, type Locale } from "@/lib/i18n";
import { rebuildDictionary } from "@/lib/i18n/mobility-rebuild";
import { clinicalPending, reassessments, type RebuildStatus } from "@/lib/training/mobility-rebuild/engine";
import type { RebuildSessionView } from "@/lib/training/mobility-rebuild/state";
import { buttonClass, chipClass } from "@/components/ui/button";
import { IconNext } from "@/components/ui/icons";

const TONE: Record<RebuildStatus, "neutral" | "accent" | "ok" | "warn" | "danger"> = {
  TODO: "neutral", IN_PROGRESS: "accent", DONE: "ok", ADAPTED: "ok", POSTPONED: "warn", INTERRUPTED: "warn", SKIPPED: "neutral",
};

export function RebuildStatusChip({ locale, status }: { locale: Locale; status: RebuildStatus }) {
  const r = rebuildDictionary(locale);
  return <span className={chipClass(TONE[status])} data-status={status}>{r.status[status]}</span>;
}

/** "Prêt à démarrer / validation clinique à documenter", or the recorded review. */
export function RebuildClinicalBadge({ locale, reviewOn }: { locale: Locale; reviewOn: string | null }) {
  const r = rebuildDictionary(locale);
  if (clinicalPending(reviewOn)) return <p className={chipClass("warn")} data-testid="rebuild-clinical">{r.clinicalPending}</p>;
  return <p className={chipClass("ok")} data-testid="rebuild-clinical">
    {fmt(r.clinicalDocumented, { date: formatDate(reviewOn + "T12:00:00", locale, { day: "numeric", month: "long", year: "numeric" }) })}</p>;
}

export function sessionDateLabel(s: Pick<RebuildSessionView, "scheduledDate">, locale: Locale): string {
  return s.scheduledDate ? formatDate(s.scheduledDate + "T12:00:00", locale, { weekday: "short", day: "numeric", month: "short" }) : "–";
}

/** The programme's entry point on the mobility and programmes pages. */
export function RebuildEntryCard({ locale, state }: { locale: Locale; state: RebuildState }) {
  const r = rebuildDictionary(locale);
  const { view, enrollment } = state;
  return <section aria-labelledby="rebuild-entry" className="leblond-premium-surface space-y-3 p-5 sm:p-6">
    <h2 id="rebuild-entry" className="text-lg font-bold">{r.title}</h2>
    <RebuildClinicalBadge locale={locale} reviewOn={enrollment.clinicalReviewOn} />
    <p className="text-sm text-ink-2">{fmt(r.adherence, view.adherence)}</p>
    {view.next ? <p className="text-sm"><strong>{r.next} :</strong> {sessionDateLabel(view.next, locale)} · {r.letter[view.next.letter]} · {fmt(r.minutes, { n: view.next.plannedMinutes ?? 0 })}</p> : null}
    <Link href="/train/mobility/rebuild" className={buttonClass("primary", "md")}>{r.open} <IconNext /></Link>
  </section>;
}

/** Suivi › Mobilité: séances done, pain before / after / next day, adherence, S0–S12. No overall score. */
export function RebuildTrack({ locale, state }: { locale: Locale; state: RebuildState }) {
  const r = rebuildDictionary(locale);
  const { view } = state;
  const done = view.sessions.filter((s) => s.status === "COMPLETED" || s.status === "INTERRUPTED")
    .sort((a, b) => (b.doneOn ?? "").localeCompare(a.doneOn ?? "") || b.slot - a.slot);
  const shortDate = (d: string | null) => (d ? formatDate(d + "T12:00:00", locale, { day: "numeric", month: "short" }) : "–");
  return <section aria-labelledby="rebuild-track" className="leblond-premium-surface space-y-4 p-5 sm:p-6" data-testid="rebuild-track">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="rebuild-track" className="text-lg font-bold">{r.trackTitle}</h2>
      <span className={chipClass("neutral")}>{r.selfReported}</span>
    </div>
    <RebuildClinicalBadge locale={locale} reviewOn={state.enrollment.clinicalReviewOn} />
    <p className="text-sm font-semibold">{fmt(r.adherence, view.adherence)}</p>
    {done.length === 0 ? <p className="text-sm text-ink-2">{r.trackEmpty}</p> : <div className="overflow-x-auto">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead className="text-xs text-ink-3"><tr>
          <th className="py-1 pr-3 font-semibold">{r.trackColumns.date}</th><th className="py-1 pr-3 font-semibold">{r.trackColumns.session}</th>
          <th className="py-1 pr-3 font-semibold">{r.trackColumns.before}</th><th className="py-1 pr-3 font-semibold">{r.trackColumns.after}</th>
          <th className="py-1 pr-3 font-semibold">{r.trackColumns.nextDay}</th><th className="py-1 font-semibold">{r.trackColumns.status}</th>
        </tr></thead>
        <tbody>{done.map((s) => <tr key={s.id} className="border-t border-line">
          <td className="py-2 pr-3">{shortDate(s.doneOn)}</td>
          <td className="py-2 pr-3"><Link href={"/train/sessions/" + s.id} className="font-semibold text-accent">{s.letter}</Link> · {fmt(r.phase, { n: s.phaseUsed ?? s.phase })}</td>
          <td className="py-2 pr-3 tabular-nums">{s.before ? `${s.before.backPain ?? "–"} / ${s.before.legRadiation ?? "–"}` : "–"}</td>
          <td className="py-2 pr-3 tabular-nums">{s.pain ?? (s.after?.stopReason ? r.stopReason[s.after.stopReason] : "–")}</td>
          <td className="py-2 pr-3">{s.nextDay?.overall ? r.overall[s.nextDay.overall] : "–"}</td>
          <td className="py-2"><RebuildStatusChip locale={locale} status={s.view} /></td>
        </tr>)}</tbody>
      </table>
      <p className="mt-1 text-xs text-ink-3">{r.trackColumns.before} : {r.backPain} / {r.legRadiation}</p>
    </div>}
    <p className="text-xs text-ink-3">{r.noScore}</p>
    <div className="space-y-1">
      <h3 className="text-base font-bold">{r.baseline}</h3>
      <ul className="text-sm text-ink-2">{reassessments(state.enrollment.startedOn).map((x) => <li key={x.key}>
        {fmt(r.reassessFrom, { key: x.key, date: shortDate(x.from) })}</li>)}</ul>
      <p className="text-xs text-ink-3">{r.baselineHint}</p>
      <Link href="/follow-up/mobility/battery" className={buttonClass("secondary", "sm")}>{r.baselineOpen} <IconNext /></Link>
    </div>
  </section>;
}
