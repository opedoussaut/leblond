import Link from "next/link";
import { CalendarCheck, ChevronRight, Flag, MapPin, Move } from "lucide-react";
import type { ReactNode } from "react";
import type { MobilityActivity, MobilityCompass, MobilitySessionItem, UpcomingMobility } from "@/lib/analytics/mobility-follow-up";
import { formatDate } from "@/lib/format";
import { fmt, type Locale } from "@/lib/i18n";
import { mobilityFollowUpDictionary } from "@/lib/i18n/mobility-follow-up";
import { LEVEL_LABELS } from "@/lib/training/hip-mobility/content";
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
    <div className="flex items-center justify-between gap-2">
      <h2 id={id} className="flex items-center gap-2 text-sm font-bold text-blue-100">
        <ToneIcon icon={icon} tone={tone} onPanel size="sm" />{title}
      </h2>
      {evidence ? <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-blue-100">{evidence}</span> : null}
    </div>
    {children}
  </section>;
}

function Big({ short, title }: { short: string; title?: string }) {
  return <div>
    <p className="leblond-number text-4xl leading-none text-white sm:text-5xl">{short}</p>
    {title ? <p className="mt-2 text-sm font-semibold text-blue-50">{title}</p> : null}
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
  return <div className="leblond-hero-panel relative isolate space-y-4 p-4 sm:p-6" data-testid="mobility-compass">
    <Move aria-hidden="true" strokeWidth={1.25} className="pointer-events-none absolute -right-6 -top-8 -z-10 size-44 text-white/[0.07] sm:size-56" />
    <p className="leblond-eyebrow text-blue-200">{t.heroLabel}</p>
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
      <Block id="mobility-where" title={t.where} icon={MapPin} tone="sky" evidence={level ? t.selfAssessed : undefined}>
        {level && compass.where ? <>
          <Big short={level.short} title={level.title} />
          <p className="text-xs text-blue-200">{fmt(t.levelOn, { date: longDate(compass.where.date, locale) })}</p>
        </> : <>
          <Big short="—" title={t.noLevel} />
          <p className="text-xs text-blue-200">{t.noLevelHint}</p>
          <div><PanelLink href="/train/mobility/assess">{t.doTest}</PanelLink></div>
        </>}
        {compass.lastBilan ? <p className="text-xs text-blue-200">
          {fmt(compass.lastBilan.stopped ? t.lastBilanStopped : t.lastBilan, { date: shortDate(compass.lastBilan.date, locale) })}</p> : null}
      </Block>

      <Block id="mobility-goal" title={t.goal} icon={Flag} tone="amber">
        {goal && compass.goal ? <>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-200">{t.nextLevel}</p>
          <Big short={goal.short} title={goal.title} />
          <p className="text-xs text-blue-200">{fmt(t.nextLevelProgress, { met: compass.goal.met, counted: compass.goal.counted })}</p>
          {testNames.length ? <p className="text-xs text-blue-100">{fmt(t.toWork, { tests: testNames.join(", ") })}</p> : null}
        </> : compass.atTop ? <Big short={t.atTop} title={t.atTopHint} />
          : <p className="text-sm text-blue-100">{t.noGoal}</p>}
        {cp ? <div className="mt-auto space-y-2 border-t border-white/15 pt-3">
          <p className="text-sm font-semibold text-white" data-testid="mobility-checkpoint">
            {cp.due ? fmt(t.checkpointDue, { key: cp.key, date: shortDate(cp.from, locale) })
              : <>{fmt(t.checkpoint, { key: cp.key, date: shortDate(cp.from, locale) })} <span className="font-normal text-blue-200">· {fmt(t.checkpointIn, { n: cp.daysLeft })}</span></>}
          </p>
          {cp.due ? <PanelLink href="/train/mobility/battery">{t.doBilan}</PanelLink> : null}
        </div> : null}
      </Block>

      <Block id="mobility-done" title={t.done} icon={CalendarCheck} tone="green" evidence={t.recorded}>
        <dl className="grid grid-cols-3 gap-3">
          {([[t.thisWeek, activity.thisWeek], [t.total, activity.total], [t.streak, activity.streakWeeks]] as const).map(([label, value]) =>
            <div key={label} className="min-w-0">
              <dt className="text-xs font-semibold text-blue-200">{label}</dt>
              <dd className="leblond-number mt-1 text-3xl leading-none text-white">{value}</dd>
            </div>)}
        </dl>
        {activity.minutesThisWeek > 0 ? <p className="text-xs text-blue-200">{fmt(t.minutesThisWeek, { n: activity.minutesThisWeek })}</p> : null}
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

/** Every mobility séance done, newest first, each opening its séance; the weekly bars underneath. */
export function MobilitySessionsDone({ locale, done, activity }: { locale: Locale; done: MobilitySessionItem[]; activity: MobilityActivity }) {
  const t = mobilityFollowUpDictionary(locale);
  const max = Math.max(1, ...activity.weeks.map((w) => w.sessions));
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
    <figure className="border-t border-line px-4 py-4 sm:px-5">
      <figcaption className="text-sm font-semibold">{t.perWeek}</figcaption>
      <ol className="mt-2 flex h-24 items-end gap-1.5" aria-label={t.perWeek}>
        {activity.weeks.map((w) => <li key={w.start} className="flex flex-1 flex-col items-center justify-end gap-1">
          <span className="text-xs font-bold tabular-nums">{w.sessions || ""}</span>
          <span className={cn("w-full rounded-t-md", w.sessions ? "bg-accent" : "bg-line")} style={{ height: `${Math.max(3, (w.sessions / max) * 64)}px` }} aria-hidden="true" />
          <span className="text-[10px] text-ink-3">{shortDate(w.start, locale)}</span>
          <span className="sr-only">{shortDate(w.start, locale)} : {w.sessions}</span>
        </li>)}
      </ol>
    </figure>
  </section>;
}
