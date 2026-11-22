import Link from "next/link";
import { CalendarCheck, ChevronRight, Flag, MapPin } from "lucide-react";
import type { ReactNode } from "react";
import type { MobilityActivity, MobilityCompass, MobilitySessionItem, UpcomingMobility } from "@/lib/analytics/mobility-follow-up";
import { formatDate } from "@/lib/format";
import { fmt, type Locale } from "@/lib/i18n";
import { mobilityFollowUpDictionary } from "@/lib/i18n/mobility-follow-up";
import { LEVELS, LEVEL_LABELS } from "@/lib/training/hip-mobility/content";
import { splitLevelName } from "@/lib/training/hip-mobility/levels";
import { pick } from "@/lib/training/sessions";
import { chipClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Fold } from "@/components/ui/fold";
import { HeadingMark, ToneIcon, type Tone } from "@/components/ui/hero-figure";
import { IconNext } from "@/components/ui/icons";

const longDate = (d: string, locale: Locale) => formatDate(d + "T12:00:00", locale, { day: "numeric", month: "long", year: "numeric" });
const shortDate = (d: string, locale: Locale) => formatDate(d + "T12:00:00", locale, { day: "numeric", month: "short" });
const dayDate = (d: string, locale: Locale) => formatDate(d + "T12:00:00", locale, { weekday: "short", day: "numeric", month: "short" });

function PanelLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex min-h-10 items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white">
    {children} <IconNext />
  </Link>;
}

function Block({ id, title, icon, tone, evidence, children }: {
  id: string; title: string; icon: typeof MapPin; tone: Tone; evidence?: string; children: ReactNode;
}) {
  return <section aria-labelledby={id} data-testid={id} className="flex min-w-0 flex-col gap-3 rounded-2xl bg-white/[0.06] p-4 ring-1 ring-white/10 sm:p-5">
    {/* The title never breaks; the evidence badge moves under it when the card is narrow. */}
    <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
      <h2 id={id} className="flex items-center gap-2 whitespace-nowrap text-sm font-bold text-blue-100">
        <ToneIcon icon={icon} tone={tone} onPanel size="sm" />{title}
      </h2>
      {evidence ? <span className="whitespace-nowrap rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-blue-100">{evidence}</span> : null}
    </div>
    {children}
  </section>;
}

const MAX_LEVEL = LEVELS[LEVELS.length - 1];

/** A level as one figure: "Niveau" above, the number large, "/ 4" beside it, its name below. */
function LevelFigure({ label, level, title, testId }: { label: string; level: number; title: string; testId: string }) {
  return <div>
    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-200">{label}</p>
    <p className="mt-1.5 flex items-baseline gap-2" data-testid={testId}>
      <span className="leblond-number text-6xl leading-[0.85] text-white">{level}</span>
      <span className="text-base font-semibold text-blue-200/80">/ {MAX_LEVEL}</span>
    </p>
    {title ? <p className="mt-3 text-[15px] font-semibold leading-snug text-white">{title}</p> : null}
  </div>;
}

/** The five levels as steps: done in sky, the next one in amber. */
function LevelScale({ level, goal, label }: { level: number; goal: number | null; label: string }) {
  return <div aria-label={label} role="img">
    <div className="flex gap-1.5">
      {LEVELS.map((l) => <span key={l} className={cn("h-1.5 flex-1 rounded-full",
        l <= level ? "bg-sky-300" : l === goal ? "bg-amber-300/80" : "bg-white/15")} />)}
    </div>
    <div className="mt-1.5 flex gap-1.5 text-[10px] font-semibold tabular-nums text-blue-200/70">
      {LEVELS.map((l) => <span key={l} className={cn("flex-1", l === level && "text-white")}>{l}</span>)}
    </div>
  </div>;
}

/** Tests at the required level, one pip each. */
function TestPips({ met, counted, label }: { met: number; counted: number; label: string }) {
  return <div>
    <div className="flex gap-1.5" aria-hidden="true">
      {Array.from({ length: counted }, (_, i) => <span key={i} className={cn("h-1.5 w-9 rounded-full", i < met ? "bg-amber-300" : "bg-white/15")} />)}
    </div>
    <p className="mt-2 text-xs text-blue-200">{label}</p>
  </div>;
}

/** The first screen of Suivi › Mobilité: where I am, what I aim for, what I have done. No overall score. */
export function MobilityCompassPanel({ locale, compass, activity, next, testNames }: {
  locale: Locale; compass: MobilityCompass; activity: MobilityActivity; next: UpcomingMobility | null;
  /** Localised names of the tests that still block the next level. */
  testNames: string[];
}) {
  const t = mobilityFollowUpDictionary(locale);
  const level = compass.where ? splitLevelName(pick(LEVEL_LABELS[compass.where.stage].name, locale)) : null;
  const goal = compass.goal ? splitLevelName(pick(LEVEL_LABELS[compass.goal.stage].name, locale)) : null;
  const cp = compass.checkpoint;
  const weekMax = Math.max(1, ...activity.weeks.map((w) => w.sessions));
  return <div className="leblond-hero-panel space-y-4 p-4 sm:p-6" data-testid="mobility-compass">
    <p className="leblond-eyebrow text-blue-200">{t.heroLabel}</p>
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <Block id="mobility-where" title={t.where} icon={MapPin} tone="sky" evidence={level ? t.selfAssessed : undefined}>
        {level && compass.where ? <>
          <LevelFigure label={t.levelWord} level={compass.where.stage} title={level.title} testId="mobility-where-level" />
          <LevelScale level={compass.where.stage} goal={compass.goal?.stage ?? null}
            label={fmt(t.scaleLabel, { max: MAX_LEVEL, level: compass.where.stage })} />
        </> : <>
          <p className="leblond-number text-5xl leading-none text-white">—</p>
          <p className="text-[15px] font-semibold text-white">{t.noLevel}</p>
          <p className="text-xs text-blue-200">{t.noLevelHint}</p>
          <div><PanelLink href="/train/mobility/assess">{t.doTest}</PanelLink></div>
        </>}
        {compass.where || compass.lastBilan ? <div className="mt-auto space-y-1 border-t border-white/15 pt-3 text-xs text-blue-200">
          {compass.where ? <p>{fmt(t.levelOn, { date: longDate(compass.where.date, locale) })}</p> : null}
          {compass.lastBilan ? <p>{fmt(compass.lastBilan.stopped ? t.lastBilanStopped : t.lastBilan, { date: shortDate(compass.lastBilan.date, locale) })}</p> : null}
        </div> : null}
      </Block>

      <Block id="mobility-goal" title={t.goal} icon={Flag} tone="amber">
        {goal && compass.goal ? <>
          <LevelFigure label={t.nextLevel} level={compass.goal.stage} title={goal.title} testId="mobility-goal-level" />
          <TestPips met={compass.goal.met} counted={compass.goal.counted}
            label={fmt(t.nextLevelProgress, { met: compass.goal.met, counted: compass.goal.counted })} />
          {testNames.length ? <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-blue-200">{t.toWorkLabel}</p>
            <ul className="mt-1.5 space-y-1 text-xs leading-snug text-blue-50">
              {testNames.map((n) => <li key={n} className="flex gap-2"><span aria-hidden="true" className="mt-1.5 size-1 shrink-0 rounded-full bg-amber-300" />{n}</li>)}
            </ul>
          </div> : null}
        </> : compass.atTop ? <>
          <p className="leblond-number text-3xl leading-tight text-white">{t.atTop}</p>
          <p className="text-sm text-blue-100">{t.atTopHint}</p>
        </> : <p className="text-sm text-blue-100">{t.noGoal}</p>}
        {cp ? <div className="mt-auto space-y-2 border-t border-white/15 pt-3">
          <p className="text-sm font-semibold text-white" data-testid="mobility-checkpoint">
            {cp.due ? fmt(t.checkpointDue, { key: cp.key, date: shortDate(cp.from, locale) })
              : <>{fmt(t.checkpoint, { key: cp.key, date: shortDate(cp.from, locale) })} <span className="font-normal text-blue-200">· {fmt(t.checkpointIn, { n: cp.daysLeft })}</span></>}
          </p>
          {cp.due ? <PanelLink href="/train/mobility/battery">{t.doBilan}</PanelLink> : null}
        </div> : null}
      </Block>

      <Block id="mobility-done" title={t.done} icon={CalendarCheck} tone="green" evidence={t.recorded}>
        <dl className="grid grid-cols-3 gap-2">
          {([[t.thisWeek, activity.thisWeek], [t.total, activity.total], [t.streak, activity.streakWeeks]] as const).map(([label, value]) =>
            // Number first on screen (same line for all three), label under it, whatever its length.
            <div key={label} className="flex min-w-0 flex-col-reverse justify-end gap-1.5 rounded-xl bg-white/[0.06] px-3 py-3 ring-1 ring-white/10">
              <dt className="text-[11px] font-semibold leading-tight text-blue-200">{label}</dt>
              <dd className="leblond-number text-4xl leading-none text-white">{value}</dd>
            </div>)}
        </dl>
        <figure>
          <figcaption className="flex items-baseline justify-between gap-2 text-[11px] font-semibold text-blue-200">
            <span>{t.weeksLabel}</span>
            {activity.minutesThisWeek > 0 ? <span className="text-blue-100">{fmt(t.minutesThisWeek, { n: activity.minutesThisWeek })}</span> : null}
          </figcaption>
          <ol className="mt-2 flex h-11 items-end gap-1">
            {activity.weeks.map((w, i) => <li key={w.start} className="flex h-full flex-1 items-end">
              <span aria-hidden="true" className={cn("block w-full rounded-[3px]", w.sessions ? (i === activity.weeks.length - 1 ? "bg-emerald-300" : "bg-emerald-300/55") : "bg-white/10")}
                style={{ height: `${w.sessions ? Math.max(18, (w.sessions / weekMax) * 100) : 9}%` }} />
              <span className="sr-only">{fmt(t.weekBar, { date: shortDate(w.start, locale), n: w.sessions })}</span>
            </li>)}
          </ol>
        </figure>
        <div className="mt-auto space-y-2 border-t border-white/15 pt-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">{t.next}</p>
          {next ? <>
            <p className="text-sm font-semibold text-white">{next.inProgress ? fmt(t.nextInProgress, { title: next.title })
              : fmt(t.nextOn, { date: next.date ? dayDate(next.date, locale) : "–", title: next.title })}</p>
            <PanelLink href={"/train/sessions/" + next.id}>{next.inProgress ? t.resume : t.open}</PanelLink>
          </> : <>
            <p className="text-sm text-blue-100">{t.nothingPlanned}</p>
            <PanelLink href="/train/mobility">{t.choose}</PanelLink>
          </>}
        </div>
      </Block>
    </div>
    <p className="text-xs text-blue-200">{t.notClinical}</p>
  </div>;
}

function SessionRow({ s, locale }: { s: MobilitySessionItem; locale: Locale }) {
  const t = mobilityFollowUpDictionary(locale);
  const minutes = s.minutes === null ? t.noMinutes : fmt(s.minutesPlanned ? t.minutesPlanned : t.minutes, { n: s.minutes });
  return <li>
    <Link href={"/train/sessions/" + s.id} className="group flex min-h-14 items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent sm:px-5">
      <span className="w-16 shrink-0 text-sm font-semibold tabular-nums text-ink-2">{shortDate(s.date, locale)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold">{s.title}</span>
        <span className="mt-0.5 block text-xs text-ink-3">{t.sources[s.source]} · {minutes}</span>
      </span>
      {s.status === "INTERRUPTED" ? <span className={chipClass("warn")}>{t.interrupted}</span> : null}
      <ChevronRight aria-hidden="true" className="size-4 shrink-0 text-ink-3" strokeWidth={2.25} />
    </Link>
  </li>;
}

const SHOWN = 6;

/** Every mobility séance done, newest first, each opening its séance (the weekly bars are in the panel above). */
export function MobilitySessionsDone({ locale, done, activity }: { locale: Locale; done: MobilitySessionItem[]; activity: MobilityActivity }) {
  const t = mobilityFollowUpDictionary(locale);
  return <section aria-labelledby="mobility-sessions" className="leblond-premium-surface overflow-hidden" data-testid="mobility-sessions">
    <div className="flex flex-wrap items-start justify-between gap-2 px-4 pt-5 sm:px-5">
      <div className="min-w-0">
        <h2 id="mobility-sessions" className="flex items-center gap-2 text-lg font-bold"><HeadingMark />{t.recentTitle}</h2>
        <p className="mt-1 text-sm text-ink-2">{fmt(t.last28, { n: activity.last28 })} · {t.recentHint}</p>
      </div>
      <span className={chipClass("neutral")}>{t.recorded}</span>
    </div>
    {done.length === 0 ? <p className="px-4 py-5 text-sm text-ink-2 sm:px-5">{t.recentEmpty}</p> : <>
      <ul className="mt-3 divide-y divide-line border-t border-line">
        {done.slice(0, SHOWN).map((s) => <SessionRow key={s.id} s={s} locale={locale} />)}
      </ul>
      {done.length > SHOWN ? <div className="border-t border-line px-4 sm:px-5">
        <Fold title={fmt(t.showAll, { n: done.length })} variant="flush">
          <ul className="-mx-4 divide-y divide-line sm:-mx-5">{done.slice(SHOWN).map((s) => <SessionRow key={s.id} s={s} locale={locale} />)}</ul>
        </Fold>
      </div> : null}
    </>}
  </section>;
}
