"use client";

import { useId, useState } from "react";
import { Clock3, Dumbbell, HeartPulse, Leaf, PersonStanding, type LucideIcon } from "lucide-react";
import { formatDuration } from "@/lib/duration";
import { formatDate } from "@/lib/format";
import { fmt, type Locale } from "@/lib/i18n";
import { awayDictionary } from "@/lib/i18n/away";
import type { AwayLoad, AwayObjective } from "@/lib/training/away/sessions";
import type { AwaySessionView } from "@/lib/training/away/view";
import { ILLUSTRATION_SIZES, illustrationSrc, isIllustration } from "@/lib/training/illustrations";
import { HeadingMark, ToneIcon, type Tone } from "@/components/ui/hero-figure";
import { chipClass, toggleClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { Segments } from "./session-picker";
import { AwayActions } from "./away-actions";

export const OBJECTIVE_STYLE: Record<AwayObjective, { icon: LucideIcon; tone: Tone }> = {
  MOBILITY: { icon: PersonStanding, tone: "teal" },
  STRENGTH: { icon: Dumbbell, tone: "blue" },
  CONDITIONING: { icon: HeartPulse, tone: "amber" },
  RECOVERY: { icon: Leaf, tone: "green" },
};
const LOAD_TONE: Record<AwayLoad, "ok" | "accent" | "warn"> = { LIGHT: "ok", MODERATE: "accent", HARD: "warn" };

/** The eight séances, filtered by length and goal, each with its whole content one click away. */
export function AwayCatalogue({ locale, sessions, today, lastDone, doneCount, caution }: {
  locale: Locale; sessions: AwaySessionView[]; today: string;
  lastDone: Record<string, string>; doneCount: Record<string, number>;
  /** Séances to keep for another day (hard after a hard day). */
  caution: string[];
}) {
  const a = awayDictionary(locale);
  const id = useId();
  const [minutes, setMinutes] = useState<0 | 60 | 90>(0);
  const [objective, setObjective] = useState<AwayObjective | "ALL">("ALL");
  const objectives = (["MOBILITY", "STRENGTH", "CONDITIONING", "RECOVERY"] as const).filter((o) => sessions.some((s) => s.objective === o));
  const shown = sessions.filter((s) => (minutes === 0 || s.minutes === minutes) && (objective === "ALL" || s.objective === objective));

  return <section aria-labelledby={id + "-h"} className="space-y-4">
    <h2 id={id + "-h"} className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-3"><HeadingMark />{a.title}</h2>
    <div className="grid gap-3 sm:grid-cols-[minmax(0,18rem)_1fr] sm:items-end">
      <Segments name={id + "-minutes"} label={a.duration} value={minutes} onChange={setMinutes}
        options={[{ value: 0, label: a.allObjectives }, { value: 60, label: formatDuration(60) }, { value: 90, label: formatDuration(90) }]} />
      <div role="group" aria-label={a.objective} className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:none] sm:flex-wrap sm:overflow-visible [&>button]:shrink-0">
        <button type="button" aria-pressed={objective === "ALL"} onClick={() => setObjective("ALL")} className={toggleClass(objective === "ALL")}>{a.allObjectives}</button>
        {objectives.map((o) => { const Icon = OBJECTIVE_STYLE[o].icon; return <button key={o} type="button" aria-pressed={objective === o}
          onClick={() => setObjective(objective === o ? "ALL" : o)} className={toggleClass(objective === o)}><Icon aria-hidden="true" />{a.objectives[o]}</button>; })}
      </div>
    </div>
    <p aria-live="polite" className="sr-only">{shown.length === 1 ? a.oneResult : fmt(a.results, { n: shown.length })}</p>
    {shown.length === 0 ? <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-ink-2">{a.empty}</p> : null}
    <ul className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
      {/* An open preview takes the whole row, so the card beside it does not stretch empty. */}
      {shown.map((s) => <li key={s.key} className="lg:has-[[data-open]]:col-span-2"><AwayCard locale={locale} s={s} today={today} last={lastDone[s.key] ?? null}
        count={doneCount[s.key] ?? 0} caution={caution.includes(s.key)} /></li>)}
    </ul>
  </section>;
}

export function AwayCard({ locale, s, today, last, count, caution, highlight }: {
  locale: Locale; s: AwaySessionView; today: string; last: string | null; count: number; caution: boolean; highlight?: string;
}) {
  const a = awayDictionary(locale);
  const style = OBJECTIVE_STYLE[s.objective];
  const [open, setOpen] = useState(false);
  const panel = useId();
  // The suggested copy at the top keeps the catalogue's card as the one #<key> links to.
  return <article id={highlight ? undefined : s.key} data-testid={highlight ? "away-suggested" : "away-" + s.key} aria-labelledby={panel + "-t"}
    data-open={open || undefined}
    className={cn("leblond-premium-surface leblond-elevated flex h-full scroll-mt-24 flex-col gap-4 p-5", highlight && "ring-2 ring-accent")}>
    {highlight ? <p className="leblond-eyebrow text-accent">{highlight}</p> : null}
    <header className="flex items-start gap-3">
      <ToneIcon icon={style.icon} tone={style.tone} />
      <div className="min-w-0 flex-1">
        <h3 id={panel + "-t"} className="text-lg font-black leading-tight">{s.title}</h3>
        <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs font-semibold text-ink-3">
          <span className={chipClass("neutral")}><Clock3 aria-hidden="true" />{formatDuration(s.minutes)}</span>
          <span className={chipClass("neutral")}>{a.objectives[s.objective]}</span>
          <span className={chipClass(LOAD_TONE[s.load])}>{a.loadLabel} : {a.loads[s.load]}</span>
          {caution ? <span className={chipClass("warn")}>{a.caution}</span> : null}
        </p>
      </div>
      <p className="leblond-number shrink-0 text-right text-3xl leading-none">{s.minutes === 60 ? "60" : "90"}<span className="ml-0.5 text-sm font-semibold text-ink-3">min</span></p>
    </header>
    <p className="text-sm text-ink-2">{s.summary}</p>
    <dl className="grid gap-3 text-sm sm:grid-cols-2">
      <div>
        <dt className="text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{a.focus}</dt>
        <dd className="mt-1 flex flex-wrap gap-1.5">{s.focus.map((f) => <span key={f} className={chipClass("accent")}>{f}</span>)}</dd>
      </div>
      <div>
        <dt className="text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{a.needs}</dt>
        <dd className="mt-1 text-ink">{s.required.map((q) => a.equipment[q]).join(" · ")}</dd>
        {s.optional.length ? <dd className="mt-0.5 text-xs text-ink-3">{a.optional} : {s.optional.map((q) => a.equipment[q]).join(", ")} ({a.optionalHint})</dd> : null}
      </div>
    </dl>
    <p className="text-xs text-ink-3">
      {fmt(a.estimate, { d: formatDuration(s.estimate) })} · {fmt(a.exercises, { n: s.exercises })}
      {" · "}{last ? fmt(a.lastDone, { date: formatDate(last + "T12:00:00", locale, { day: "numeric", month: "long" }) }) : a.neverDone}
      {count > 1 ? " · " + fmt(a.doneCount, { n: count }) : count === 1 ? " · " + a.doneOnce : ""}
    </p>
    <div className="mt-auto space-y-3">
      <button type="button" aria-expanded={open} aria-controls={panel} onClick={() => setOpen(!open)}
        className="min-h-11 text-sm font-semibold text-accent underline-offset-4 hover:underline">{open ? a.hidePreview : a.preview}</button>
      {open ? <AwayPreview id={panel} locale={locale} s={s} /> : null}
      <AwayActions locale={locale} awayKey={s.key} title={s.title} today={today} />
    </div>
  </article>;
}

/** The whole séance: blocks, exercises, doses, rests, adapted versions and alternatives. */
function AwayPreview({ id, locale, s }: { id: string; locale: Locale; s: AwaySessionView }) {
  const a = awayDictionary(locale);
  return <div id={id} className="space-y-4 border-t border-line pt-4">
    {s.sections.map((sec, k) => <section key={k} aria-label={sec.title} className="space-y-2">
      <h4 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.12em] text-ink-3"><HeadingMark />{sec.title}</h4>
      <ol className="divide-y divide-line rounded-xl border border-line bg-surface">
        {sec.items.map((it, j) => <li key={j} className="flex gap-3 p-3">
          {isIllustration(it.illustration) ? /* A small public drawing, decorative: the name is next to it. */
            // eslint-disable-next-line @next/next/no-img-element
            <img src={illustrationSrc(it.illustration)} alt="" width={ILLUSTRATION_SIZES[it.illustration][0]} height={ILLUSTRATION_SIZES[it.illustration][1]}
              loading="lazy" decoding="async" className="size-16 shrink-0 self-start rounded-lg bg-white object-contain ring-1 ring-black/5" /> : null}
          <div className="min-w-0 flex-1 text-sm">
            <p className="flex flex-wrap items-baseline justify-between gap-x-3">
              <strong className="font-semibold">{it.name}</strong>
              <span className="leblond-number text-sm">{it.dose}</span>
            </p>
            <p className="mt-0.5 text-xs text-ink-3">{[it.rest, it.after].filter(Boolean).join(" · ")}</p>
            <p className="mt-1 text-xs text-ink-2">{it.summary} <span className="text-ink-3">— {it.cue}</span></p>
            {it.hipNote ? <p className="mt-1 text-xs font-semibold text-accent">{it.version === "EASIER" ? a.adaptedNote : a.advancedNote} : {it.hipNote}</p> : null}
            {it.alternative ? <p className="mt-1 text-xs text-ink-2"><strong>{a.alternative} :</strong> {it.alternative}</p> : null}
          </div>
        </li>)}
      </ol>
    </section>)}
    <p className="rounded-xl bg-surface-2 p-3 text-xs text-ink-2">{s.notes}</p>
  </div>;
}
