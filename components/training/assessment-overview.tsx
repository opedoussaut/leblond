import type { ReactNode } from "react";
import {
  CalendarClock, CircleAlert, CircleCheck, CircleDashed, ClipboardCheck, ListChecks, MoveRight, RotateCcw,
  TrendingDown, TrendingUp, type LucideIcon,
} from "lucide-react";
import { cn } from "@/components/ui/cn";
import { formatDate } from "@/lib/format";
import { fmt, type Locale } from "@/lib/i18n";
import { assessmentDictionary } from "@/lib/i18n/assessment";
import type { AssessmentOverview, CheckinState, OverallState, TimelineWeek, Trend } from "@/lib/training/assessment-overview";

/*
 * One symbol per status across the evaluation pages, always next to its word:
 * a check-in is done, due, late or upcoming; a result is improving, stable or
 * declining. Colour only repeats what the icon and the word already say.
 */

type Symbol = { icon: LucideIcon; tone: string; panel: string };

const GREEN = { tone: "bg-tone-green-soft text-tone-green", panel: "bg-emerald-300/15 text-emerald-100 ring-emerald-200/30" };
const AMBER = { tone: "bg-tone-amber-soft text-tone-amber", panel: "bg-amber-300/15 text-amber-100 ring-amber-200/30" };
const ROSE = { tone: "bg-tone-rose-soft text-tone-rose", panel: "bg-rose-300/15 text-rose-100 ring-rose-200/30" };
const NEUTRAL = { tone: "bg-surface-2 text-ink-2", panel: "bg-white/10 text-blue-100 ring-white/20" };
const BLUE = { tone: "bg-tone-blue-soft text-tone-blue", panel: "bg-sky-300/15 text-sky-100 ring-sky-200/30" };

export const CHECKIN_SYMBOLS: Record<CheckinState, Symbol> = {
  done: { icon: CircleCheck, ...GREEN },
  due: { icon: CalendarClock, ...AMBER },
  late: { icon: CircleAlert, ...ROSE },
  upcoming: { icon: CircleDashed, ...NEUTRAL },
};

export const OVERALL_SYMBOLS: Record<OverallState, Symbol> = {
  "on-track": { icon: CircleCheck, ...GREEN },
  due: { icon: CalendarClock, ...AMBER },
  late: { icon: CircleAlert, ...ROSE },
  upcoming: { icon: CircleDashed, ...NEUTRAL },
  reassess: { icon: RotateCcw, ...BLUE },
};

/** A decline is information, not an alarm: amber, never red. */
export const TREND_SYMBOLS: Record<Trend, Symbol> = {
  improving: { icon: TrendingUp, ...GREEN },
  stable: { icon: MoveRight, ...NEUTRAL },
  declining: { icon: TrendingDown, ...AMBER },
};

/** An icon and its word, in one pill. */
export function StatusPill({ symbol, label, onPanel = false, className }: { symbol: Symbol; label: string; onPanel?: boolean; className?: string }) {
  const Icon = symbol.icon;
  return <span className={cn("inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-bold",
    onPanel ? cn("ring-1", symbol.panel) : symbol.tone, className)}>
    <Icon aria-hidden="true" className="size-3.5 shrink-0" strokeWidth={2.5} />{label}
  </span>;
}

export function TrendPill({ trend, locale }: { trend: Trend; locale: Locale }) {
  return <StatusPill symbol={TREND_SYMBOLS[trend]} label={assessmentDictionary(locale).overview.trends[trend]} />;
}

const SEGMENT: Record<CheckinState, { light: string; panel: string }> = {
  done: { light: "bg-tone-green", panel: "bg-emerald-300" },
  due: { light: "bg-tone-amber ring-2 ring-tone-amber/30", panel: "bg-amber-300 ring-2 ring-amber-200/40" },
  late: { light: "bg-tone-rose/70", panel: "bg-rose-300/80" },
  upcoming: { light: "bg-line", panel: "bg-white/20" },
};

/** The period's check-ins as one segmented bar, with a worded list for screen readers and a legend under it. */
export function CheckinStrip({ timeline, locale, onPanel = false }: { timeline: TimelineWeek[]; locale: Locale; onPanel?: boolean }) {
  const o = assessmentDictionary(locale).overview;
  const shown = (["done", "due", "late", "upcoming"] as const).filter((s) => timeline.some((w) => w.state === s));
  return <div>
    <ol aria-label={o.timeline} className="flex gap-1">
      {timeline.map((w) => <li key={w.week} className="min-w-0 flex-1">
        <span aria-hidden="true" title={fmt(o.weekState, { week: w.week, state: o.checkinStates[w.state] })}
          className={cn("block h-2 rounded-full", onPanel ? SEGMENT[w.state].panel : SEGMENT[w.state].light)} />
        <span className="sr-only">{fmt(o.weekState, { week: w.week, state: o.checkinStates[w.state] })}</span>
      </li>)}
    </ol>
    <ul aria-label={o.legend} className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
      {shown.map((s) => { const Icon = CHECKIN_SYMBOLS[s].icon; return <li key={s}
        className={cn("flex items-center gap-1.5 text-xs font-semibold", onPanel ? "text-blue-100" : "text-ink-2")}>
        <Icon aria-hidden="true" className="size-3.5" strokeWidth={2.5} />
        {o.checkinStates[s]} · <span className="tabular-nums">{timeline.filter((w) => w.state === s).length}</span>
      </li>; })}
    </ul>
  </div>;
}

const dayLabel = (date: string, locale: Locale) => formatDate(date + "T12:00:00", locale, { day: "numeric", month: "short" });

/**
 * The current full assessment, first on its pages: its status, week n of N,
 * the check-ins as a bar, the next dates, and the one thing to do now.
 */
export function AssessmentHero({ locale, overview, method, actions, testId }: {
  locale: Locale; overview: AssessmentOverview; method: string;
  /** The buttons under "What to do now". */
  actions: ReactNode;
  testId?: string;
}) {
  const o = assessmentDictionary(locale).overview;
  const { status, next } = overview;
  const todo = next.kind === "reassess" ? o.nextReassess : next.kind === "checkin" ? fmt(o.nextCheckin, { week: next.week })
    : next.kind === "wait" ? o.nextWait : o.nextDone;
  const TodoIcon = next.kind === "reassess" ? RotateCcw : next.kind === "checkin" ? CalendarClock : CircleCheck;
  const stats: Array<{ icon: LucideIcon; label: string; value: string }> = [
    { icon: ListChecks, label: o.checkinsStat, value: `${status.checkins}/${status.horizon}` },
    { icon: CalendarClock, label: o.nextCheckinStat,
      value: status.dueCheckin !== null ? o.now : overview.nextCheckin ? dayLabel(overview.nextCheckin, locale) : o.none },
    { icon: RotateCcw, label: o.reassessStat, value: dayLabel(overview.reassessOn, locale) },
  ];
  return <section aria-labelledby="current-assessment-heading" data-testid={testId}
    className="leblond-hero-panel relative isolate space-y-5 p-5 sm:p-7">
    <ClipboardCheck aria-hidden="true" strokeWidth={1.25}
      className="pointer-events-none absolute -right-6 -top-8 -z-10 size-44 text-white/[0.07] sm:size-56" />
    <div className="flex flex-wrap items-center justify-between gap-2">
      <h2 id="current-assessment-heading" className="leblond-eyebrow text-blue-200">{o.eyebrow}</h2>
      <StatusPill symbol={OVERALL_SYMBOLS[overview.state]} label={o.states[overview.state]} onPanel />
    </div>
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
      <div className="min-w-0">
        <p aria-hidden="true" className="text-xs font-bold uppercase tracking-[0.12em] text-blue-200">{o.weekLabel}</p>
        <p className="mt-1 flex items-baseline gap-2 whitespace-nowrap leading-none">
          <span aria-hidden="true" className="leblond-number text-6xl text-white sm:text-7xl">{status.week}</span>
          <span aria-hidden="true" className="leblond-number text-2xl text-blue-200 sm:text-3xl">/ {status.horizon}</span>
          <span className="sr-only">{fmt(o.week, { week: status.week })} {fmt(o.ofTotal, { total: status.horizon })}</span>
        </p>
        <p className="mt-3 truncate text-sm font-semibold text-blue-100">{method}</p>
        <p className="mt-0.5 text-xs text-blue-200">{fmt(o.doneOn, { date: formatDate(overview.createdOn + "T12:00:00", locale, { day: "numeric", month: "long", year: "numeric" }) })}</p>
      </div>
      {/* Phones: one row per figure, label left and value right; wider: three columns. */}
      <dl className="grid grid-cols-1 divide-y divide-white/10 border-t border-white/15 sm:min-w-[22rem] sm:grid-cols-3 sm:gap-4 sm:divide-y-0 sm:border-l sm:border-t-0 sm:pl-5">
        {stats.map((s) => { const Icon = s.icon; return <div key={s.label}
          className="flex min-w-0 items-center justify-between gap-3 py-2.5 sm:block sm:py-0">
          <dt className="flex items-center gap-2 text-xs font-semibold text-blue-200 sm:block">
            <Icon aria-hidden="true" className="size-4 shrink-0 text-sky-200 sm:mb-2 sm:block" strokeWidth={2} />{s.label}
          </dt>
          <dd className="leblond-number text-lg leading-none text-white sm:mt-1 sm:text-2xl">{s.value}</dd>
        </div>; })}
      </dl>
    </div>
    <CheckinStrip timeline={overview.timeline} locale={locale} onPanel />
    <div className="rounded-2xl bg-white/10 p-4 ring-1 ring-white/15">
      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-blue-200">{o.todo}</p>
      <p className="mt-1.5 flex items-start gap-2 text-sm font-semibold text-white">
        <TodoIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-sky-200" strokeWidth={2.25} />{todo}
      </p>
      {overview.missed > 0 && next.kind !== "reassess" ? <p className="mt-1 pl-6 text-xs text-blue-100">{fmt(o.missed, { n: overview.missed })}</p> : null}
      <div className="leblond-actions mt-4">{actions}</div>
    </div>
  </section>;
}

/** Button classes for the hero panel: white primary, glass secondary. */
export const heroButton = (primary: boolean) => cn(
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition-colors focus-visible:outline-white",
  primary ? "bg-white text-[#0b2745] hover:bg-blue-50" : "bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20",
);
