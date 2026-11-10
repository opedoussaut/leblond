"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { removeCoachSession } from "@/lib/actions/coach-sessions";
import { formatDuration } from "@/lib/duration";
import { fmt, type Locale } from "@/lib/i18n";
import { coachSessionsDictionary } from "@/lib/i18n/coach-sessions";
import { trainingSessionDictionary } from "@/lib/i18n/training-session";
import { musclewikiUrl, type CoachSession } from "@/lib/training/coach-sessions";
import { formatClock } from "@/lib/training/sessions";
import { buttonClass } from "@/components/ui/button";

/** The climber's coach sessions: preview of the exercises, choose one for the form above, remove. */
export function CoachSessionsList({ locale, sessions, viewerId }: { locale: Locale; sessions: CoachSession[]; viewerId: string }) {
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

  return <ul className="space-y-3">
    {sessions.map((s) => <li key={s.id} className="rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <strong className="text-base">{s.title}</strong>
        <span className="text-xs text-ink-2">{formatDuration(s.minutes)} · {fmt(c.exercises, { n: s.exercises.length })} · {c.author[s.author]}{s.shared ? " · " + c.sharedBadge : ""}</span>
      </div>
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
              {e.restAfterSeconds && i < s.exercises.length - 1 ? <span className="block text-xs text-ink-2">{fmt(c.restAfter, { d: formatClock(e.restAfterSeconds) })}</span> : null}
              {link ? <a href={link} target="_blank" rel="noopener noreferrer" className="text-xs font-bold text-accent underline underline-offset-4">{c.musclewiki} ↗</a> : null}
            </li>;
          })}
        </ol>
        {s.notes ? <p className="mt-3 whitespace-pre-line text-sm text-ink-2">{s.notes}</p> : null}
        {s.sources.length ? <p className="mt-3 text-xs text-ink-3">{c.sources} : {s.sources.map((src, i) => <span key={i}>
          {i ? " · " : ""}<a href={src.url} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4">{src.label}</a>
        </span>)}</p> : null}
      </details>
      <div className="leblond-actions mt-3">
        <Link href={`/train/sessions?coach=${s.id}#new-heading`} className={buttonClass("primary", "sm")}>{c.choose}</Link>
        {s.ownerId === viewerId ? <button type="button" disabled={pending} onClick={() => remove(s.id)} className={buttonClass("ghost", "sm")}>{c.remove}</button> : null}
      </div>
    </li>)}
  </ul>;
}
