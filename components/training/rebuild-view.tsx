import Link from "next/link";
import type { RebuildState } from "@/lib/data/mobility-rebuild";
import { formatDate } from "@/lib/format";
import { fmt, type Locale } from "@/lib/i18n";
import { rebuildDictionary } from "@/lib/i18n/mobility-rebuild";
import { clinicalPending, reassessments, type RebuildStatus } from "@/lib/training/mobility-rebuild/engine";
import type { RebuildSessionView } from "@/lib/training/mobility-rebuild/state";
import { ChevronRight, Repeat } from "lucide-react";
import { mobilityFollowUpDictionary } from "@/lib/i18n/mobility-follow-up";
import { localDate_ } from "@/lib/training/sessions";
import { buttonClass, chipClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { ToneIcon } from "@/components/ui/hero-figure";
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
  const t = mobilityFollowUpDictionary(locale);
  const today = localDate_(new Date());
  const total = view.sessions.length;
  const share = total ? Math.round((done.length / total) * 100) : 0;
  return <section aria-labelledby="rebuild-track" className="leblond-premium-surface overflow-hidden" data-testid="rebuild-track">
    <div className="space-y-5 p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <ToneIcon icon={Repeat} tone="teal" />
          <div className="min-w-0 space-y-2">
            <h2 id="rebuild-track" className="text-lg font-bold leading-tight">{r.trackTitle}</h2>
            <RebuildClinicalBadge locale={locale} reviewOn={state.enrollment.clinicalReviewOn} />
          </div>
        </div>
        <span className={chipClass("neutral")}>{r.selfReported}</span>
      </div>

      <div className="grid gap-5 sm:grid-cols-2 sm:gap-6">
        <div>
          <p className="flex items-baseline gap-2">
            <span className="leblond-number text-5xl leading-none">{done.length}</span>
            <span className="text-base font-semibold text-ink-3">/ {total}</span>
          </p>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden="true">
            <div className="h-full rounded-full bg-teal-500" style={{ width: `${share}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink-3">{fmt(t.rebuildProgress, { done: done.length, total })}</p>
          <p className="mt-1 text-sm font-semibold">{fmt(r.adherence, view.adherence)}</p>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink-3">{r.baseline}</p>
          <ol className="mt-3 grid grid-cols-3 gap-2">
            {reassessments(state.enrollment.startedOn).map((x) => {
              const open = x.from <= today;
              return <li key={x.key} className={cn("rounded-xl px-3 py-2.5 ring-1", open ? "bg-teal-50 ring-teal-200 dark:bg-teal-950/40 dark:ring-teal-800" : "bg-surface-2 ring-line")}>
                <span className="block font-display text-base font-extrabold">{x.key}</span>
                <span className="mt-0.5 block text-xs text-ink-2">{fmt(t.fromDate, { date: shortDate(x.from) })}</span>
                {open ? <span className="mt-1 block text-[11px] font-bold text-teal-700 dark:text-teal-300">{t.reassessOpen}</span> : null}
              </li>;
            })}
          </ol>
        </div>
      </div>

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
    </div>
    <Link href="/follow-up/mobility/battery" className="group flex min-h-14 items-center gap-3 border-t border-line px-5 py-3 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent sm:px-6">
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-accent">{r.baselineOpen}</span>
        <span className="mt-0.5 block text-xs text-ink-3">{r.baselineHint}</span>
      </span>
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-3 transition-transform group-hover:translate-x-0.5" strokeWidth={2.25} />
    </Link>
  </section>;
}
