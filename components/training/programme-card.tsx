import Link from "next/link";
import { formatDate } from "@/lib/format";
import { fmt, type Locale } from "@/lib/i18n";
import { journeyDictionary } from "@/lib/i18n/training-journey";
import { METHODS_FOR_PLANS } from "@/lib/training/catalogue";
import type { ProgrammeView, replanSignal } from "@/lib/training/programme";
import { sessionTitle } from "@/lib/training/programme";
import { buttonClass, linkClass } from "@/components/ui/button";
import { CreateProgrammeButton } from "./create-programme-button";
import { IconNext } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";

const day = (date: string, locale: Locale) => formatDate(date + "T12:00:00", locale, { weekday: "long", day: "numeric", month: "long" });

/** Shown when the daily check-ins keep flagging problems: points to a new full assessment. */
export function ReplanBanner({ locale, replan }: { locale: Locale; replan: ReturnType<typeof replanSignal> }) {
  const j = journeyDictionary(locale);
  return <section aria-labelledby="replan-heading" className="space-y-2 rounded-2xl border border-warn/50 bg-warn/10 p-4">
    <h2 id="replan-heading" className="text-base font-bold">{j.day.replanTitle}</h2>
    <p className="text-sm leading-relaxed">{replan.acute ? j.day.replanAcute : fmt(j.day.replanText, { n: replan.flagged })}</p>
    {replan.areas.length ? <p className="text-sm">{fmt(j.day.replanAreas, { areas: replan.areas.map((a) => j.areas[a].toLowerCase()).join(", ") })}</p> : null}
    <Link href="/train/assess" className={buttonClass("secondary", "sm")}>{j.day.replanCta} <IconNext /></Link>
  </section>;
}

/** The programme in progress: method, week X of N, weekly template, next session and next full assessment. */
export function ProgrammeCard({ locale, view, today }: { locale: Locale; view: ProgrammeView | null; today: string }) {
  const j = journeyDictionary(locale);
  const h = j.hub;
  if (!view) {
    return <section aria-labelledby="programme-heading" className="rounded-2xl border border-dashed border-line bg-surface p-5">
      <h2 id="programme-heading" className="text-lg font-bold">{h.programmeTitle}</h2>
      <p className="mt-1 text-sm font-semibold">{h.empty}</p>
      <p className="mt-1 text-sm text-ink-2">{h.emptyHint}</p>
      <Link href="/train/assess" className={buttonClass("primary", "sm", "mt-3")}>{h.fullCta} <IconNext /></Link>
    </section>;
  }
  const method = METHODS_FOR_PLANS.find((m) => m.id === view.methodId)?.title ?? view.methodId;
  const injuries = view.health.injuries;
  return <section aria-labelledby="programme-heading" className="space-y-4 rounded-2xl border border-line bg-surface p-5 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div>
        <h2 id="programme-heading" className="text-xs font-bold uppercase tracking-[0.12em] text-accent">{h.programmeTitle}</h2>
        <p className="mt-1 text-2xl font-extrabold tracking-tight">{method}</p>
        <p className="text-sm text-ink-2">{j.disciplines[view.discipline].label}{view.goal ? " · " + view.goal : ""}</p>
      </div>
      <p className="rounded-full bg-accent-soft px-3 py-1 text-sm font-black tabular-nums text-accent">{fmt(h.week, { week: view.week, total: view.horizonWeeks })}</p>
    </div>
    <div className="h-1.5 rounded-full bg-accent/15" aria-hidden="true">
      <div className="h-1.5 rounded-full bg-accent" style={{ width: `${Math.round((view.week / view.horizonWeeks) * 100)}%` }} />
    </div>
    {view.finished ? <p className="rounded-xl bg-surface-2 p-3 text-sm font-semibold">{h.finished}</p> : null}

    <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <div className="rounded-xl bg-surface-2 p-3">
        <dt className="text-xs font-semibold text-ink-3">{h.next}</dt>
        <dd className="mt-1 text-sm font-bold">{view.next ? <>
          {view.next.date === today ? h.nextToday : day(view.next.date, locale)} · {view.next.title}
          {view.next.minutes ? ` · ${view.next.minutes} min` : ""}{view.next.place ? ` · ${j.places[view.next.place]}` : ""}
          {view.next.sessionId ? <> · <Link className={linkClass} href={"/train/sessions/" + view.next.sessionId}>{h.open}</Link></> : null}
        </> : h.nextNone}</dd>
      </div>
      <div className="rounded-xl bg-surface-2 p-3">
        <dt className="text-xs font-semibold text-ink-3">{h.reassess}</dt>
        <dd className="mt-1 text-sm font-bold">{day(view.nextReassessment, locale)}{view.reassessmentDue ? " · " + fmt(h.fullDue, { date: day(view.nextReassessment, locale) }) : ""}</dd>
      </div>
    </dl>

    <div>
      <h3 className="text-sm font-bold">{h.weekTemplate} <span className="font-normal text-ink-3">· {fmt(h.weekCounts, { climb: view.availability.climbingPerWeek, off: view.availability.offWallPerWeek })}</span></h3>
      {view.plan ? <>
        <ul className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {view.plan.sessions.map((s, i) => <li key={i} className="rounded-xl border border-line px-3 py-2 text-sm">
            <span className="font-bold">{j.days[s.day]}</span> · {sessionTitle(s)}{s.place ? " · " + j.places[s.place] : ""} · {s.minutes} min
          </li>)}
        </ul>
        <Link href="/programmes#plans-heading" className={cn(linkClass, "mt-2 min-h-11 text-sm")}>{h.edit} <IconNext /></Link>
      </> : <div className="mt-2 space-y-2">
        <p className="text-sm text-ink-2">{h.noPlan}</p>
        <CreateProgrammeButton locale={locale} assessmentId={view.assessmentId} />
      </div>}
    </div>

    {injuries.length || view.health.unspecifiedPain ? <p className="text-sm">
      <span className="font-bold">{h.health} :</span>{" "}
      {[...injuries.map((i) => `${j.areas[i.area].toLowerCase()} (${j.levels[i.level].label.toLowerCase()})`),
        ...(view.health.unspecifiedPain ? [h.legacyPain.toLowerCase()] : [])].join(", ")}
    </p> : null}
  </section>;
}
