"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { removeCoachSession } from "@/lib/actions/coach-sessions";
import { formatDuration } from "@/lib/duration";
import { fmt, type Locale } from "@/lib/i18n";
import { coachSessionsDictionary } from "@/lib/i18n/coach-sessions";
import { sessionPickerDictionary } from "@/lib/i18n/session-picker";
import { trainingSessionDictionary } from "@/lib/i18n/training-session";
import { demoUrl, musclewikiUrl, type CoachSession } from "@/lib/training/coach-sessions";
import { buildPickerEntries, defaultVariant, variantFor, type PickerFamily } from "@/lib/training/session-picker";
import { MobilityIllustration } from "./mobility-illustrations";
import { formatClock } from "@/lib/training/sessions";
import { buttonClass, linkClass } from "@/components/ui/button";
import { IconClock, IconExternal } from "@/components/ui/icons";
import { cn } from "@/components/ui/cn";
import { CATEGORY_ICONS, FamilyChoice } from "./session-picker";

/**
 * The climber's coach sessions: one card per family (pick the level and the
 * duration), one per session without a family; preview of the exercises,
 * choose one for the session form, remove.
 */
export function CoachSessionsList({ locale, sessions, viewerId }: { locale: Locale; sessions: CoachSession[]; viewerId: string }) {
  const p = sessionPickerDictionary(locale);
  const entries = useMemo(() => buildPickerEntries(
    sessions.map((s) => ({ id: s.id, title: s.title, objective: s.objective, minutes: s.minutes, exercises: s.exercises.length, family: s.family })),
    locale, p.categories,
  ).filter((e) => e.kind !== "atlas"), [sessions, locale, p.categories]);
  const byId = new Map(sessions.map((s) => [s.id, s]));
  return <ul className="space-y-3">
    {entries.map((e) => e.kind === "family"
      ? <FamilyItem key={"f:" + e.key} locale={locale} family={e} byId={byId} viewerId={viewerId} />
      : e.kind === "coach" ? <li key={e.value} className="rounded-2xl border border-line bg-surface p-4">
        <SessionDetails locale={locale} s={byId.get(e.value.slice("coach:".length))!} viewerId={viewerId} />
      </li> : null)}
  </ul>;
}

function FamilyItem({ locale, family, byId, viewerId }: {
  locale: Locale; family: PickerFamily; byId: Map<string, CoachSession>; viewerId: string;
}) {
  const p = sessionPickerDictionary(locale);
  const first = defaultVariant(family);
  const [choice, setChoice] = useState({ level: first.level.key, minutes: first.variant.minutes });
  const level = family.levels.find((l) => l.key === choice.level) ?? first.level;
  const variant = variantFor(level, choice.minutes);
  const Icon = CATEGORY_ICONS[family.category];
  return <li className="rounded-2xl border border-line bg-surface p-4" data-testid="coach-family">
    <div className="flex items-start gap-3">
      <Icon aria-hidden="true" className="mt-0.5 size-6 shrink-0 text-accent" />
      <div className="min-w-0">
        <h3 className="text-lg font-black">{family.title}</h3>
        {family.summary ? <p className="text-sm text-ink-2">{family.summary}</p> : null}
        <p className="mt-0.5 text-xs font-semibold text-ink-3">{p.categories[family.category]}</p>
      </div>
    </div>
    <div className="mt-3"><FamilyChoice locale={locale} family={family} level={level} minutes={variant.minutes}
      onChange={(_, l, m) => setChoice({ level: l.key, minutes: m })} /></div>
    <div className="mt-4 border-t border-line pt-3">
      <SessionDetails locale={locale} s={byId.get(variant.id)!} viewerId={viewerId} />
    </div>
  </li>;
}

function SessionDetails({ locale, s, viewerId }: { locale: Locale; s: CoachSession; viewerId: string }) {
  const c = coachSessionsDictionary(locale);
  const t = trainingSessionDictionary(locale);
  const router = useRouter();
  const [pending, start] = useTransition();

  function remove(id: string) {
    if (!window.confirm(c.removeConfirm)) return;
    start(async () => {
      const r = await removeCoachSession(id);
      if (r.ok) router.refresh();
    });
  }

  return <div>
      <div className="flex items-start justify-between gap-3">
        <strong className="text-base">{s.title}</strong>
        <span aria-label={fmt(c.duration, { d: formatDuration(s.minutes) })} data-testid="coach-session-duration"
          className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-accent-soft px-3 py-1 text-base font-black tabular-nums text-accent">
          <IconClock /><span aria-hidden="true">{formatDuration(s.minutes)}</span>
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-2">{fmt(c.exercises, { n: s.exercises.length })} · {c.author[s.author]}{s.shared ? " · " + c.sharedBadge : ""}</p>
      {s.objective ? <p className="mt-1 text-sm text-ink-2">{s.objective}</p> : null}
      <details className="mt-2">
        <summary className="min-h-11 cursor-pointer py-2 text-sm font-bold text-accent">{c.preview}</summary>
        <ol className="space-y-2 text-sm">
          {s.exercises.map((e, i) => {
            const link = musclewikiUrl(e.musclewiki);
            const dose = [e.sets ? `${e.sets} × ` + (e.reps ? `${e.reps}` : e.seconds ? `${e.seconds} ${t.seconds}` : "") : e.seconds ? `${e.seconds} ${t.seconds}` : null,
              e.load ? `${c.load} : ${e.load}` : null, e.restSeconds ? `${t.rest} ${e.restSeconds} ${t.seconds}` : null].filter(Boolean).join(" · ");
            return <li key={i} className="border-l-2 border-line pl-3">
              <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{t.block[e.block]}</span>
              <span className="block font-semibold">{e.name}{dose ? <span className="font-normal text-ink-2"> — {dose}</span> : null}</span>
              {e.illustration ? <MobilityIllustration exerciseId={e.illustration} title={e.name} className="my-1 max-w-[12rem]" /> : null}
              {e.restAfterSeconds && i < s.exercises.length - 1 ? <span className="block text-xs text-ink-2">{fmt(c.restAfter, { d: formatClock(e.restAfterSeconds) })}</span> : null}
              {link ? <a href={link} target="_blank" rel="noopener noreferrer" className={cn(linkClass, "mr-3 text-xs")}>{c.musclewiki} <IconExternal /></a> : null}
              {e.demo && demoUrl(e.demo.url) ? <a href={demoUrl(e.demo.url)!} target="_blank" rel="noopener noreferrer" className={cn(linkClass, "text-xs")}>{fmt(c.demo, { site: e.demo.label })} <IconExternal /></a> : null}
            </li>;
          })}
        </ol>
        {s.notes ? <p className="mt-3 whitespace-pre-line text-sm text-ink-2">{s.notes}</p> : null}
        {s.sources.length ? <p className="mt-3 text-xs text-ink-3">{c.sources} : {s.sources.map((src, i) => <span key={i}>
          {i ? " · " : ""}<a href={src.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{src.label}</a>
        </span>)}</p> : null}
      </details>
      <div className="leblond-actions mt-3">
        <Link href={`/session/new?kind=train&coach=${s.id}#new-heading`} className={buttonClass("primary", "sm")}>{c.choose}</Link>
        {s.ownerId === viewerId ? <button type="button" disabled={pending} onClick={() => remove(s.id)} className={buttonClass("ghost", "sm")}>{c.remove}</button> : null}
      </div>
  </div>;
}
