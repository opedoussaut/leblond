"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  changeTrainingStatus, createTrainingSession, schedulePlanWeek, startTrainingSession,
} from "@/lib/actions/training-sessions";
import { fmt, type Locale } from "@/lib/i18n";
import { trainingSessionDictionary } from "@/lib/i18n/training-session";
import { coachSessionsDictionary } from "@/lib/i18n/coach-sessions";
import { formatDuration } from "@/lib/duration";
import { METHODS_FOR_PLANS } from "@/lib/training/catalogue";
import type { TrainingStatus } from "@/lib/training/sessions";
import { buttonClass, linkClass } from "@/components/ui/button";
import { DurationField } from "@/components/ui/duration-field";
import { fieldClass as field } from "@/components/ui/field";
import { IconNext, IconPlay } from "@/components/ui/icons";

type LiveError = { liveId?: string };

function LiveNotice({ locale, liveId }: { locale: Locale; liveId?: string }) {
  const t = trainingSessionDictionary(locale);
  return <p role="alert" className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
    {t.liveElsewhere}{liveId ? <> <Link className={linkClass} href={"/train/sessions/" + liveId}>{t.goLive}</Link></> : null}
  </p>;
}

/** Start / skip / cancel / delete controls for a session that is not running. */
export function SessionLifecycleActions({ locale, id, status }: { locale: Locale; id: string; status: TrainingStatus }) {
  const t = trainingSessionDictionary(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<{ msg: string } & LiveError | null>(null);
  function run(fn: () => Promise<{ ok: boolean; error?: string; liveId?: string }>, after?: () => void) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (!r.ok) { setError({ msg: r.error === "live" ? "live" : t.error, liveId: r.liveId }); return; }
      if (after) after(); else router.refresh();
    });
  }
  return <div className="space-y-3">
    {error ? (error.msg === "live" ? <LiveNotice locale={locale} liveId={error.liveId} /> :
      <p role="alert" className="text-sm font-semibold text-danger">{error.msg}</p>) : null}
    <div className="flex flex-wrap gap-3">
      {status === "PLANNED" || status === "INTERRUPTED" ? (
        <button type="button" disabled={pending} onClick={() => run(() => startTrainingSession(id))}
          className={buttonClass("primary", "md", "flex-1 sm:flex-none")}>
          <IconPlay /> {status === "INTERRUPTED" ? t.resume : t.start}
        </button>
      ) : null}
      {status === "PLANNED" ? <>
        <button type="button" disabled={pending} onClick={() => run(() => changeTrainingStatus(id, "SKIPPED"))}
          className={buttonClass("secondary", "md")}>{t.skip}</button>
        <button type="button" disabled={pending} onClick={() => run(() => changeTrainingStatus(id, "CANCELED"))}
          className={buttonClass("secondary", "md")}>{t.cancel}</button>
      </> : null}
      {status === "SKIPPED" || status === "CANCELED" ? (
        <button type="button" disabled={pending} onClick={() => run(() => changeTrainingStatus(id, "PLANNED"))}
          className={buttonClass("secondary", "md")}>{t.reschedule}</button>
      ) : null}

    </div>
  </div>;
}

/** One-off session: start now or schedule, with or without an Atlas method. */
export type CoachChoice = { id: string; title: string; minutes: number };

/**
 * One-off session: start now or schedule. The type is a coach session (its own
 * exercises and duration), an Atlas method, or a free session.
 */
export function QuickSessionForm({ locale, today, presetMethod = "", coachSessions = [] }: {
  locale: Locale; today: string; presetMethod?: string; coachSessions?: CoachChoice[];
}) {
  const t = trainingSessionDictionary(locale);
  const c = coachSessionsDictionary(locale);
  const router = useRouter();
  const [methodId, setMethodId] = useState(presetMethod);
  const coach = methodId.startsWith("coach:") ? coachSessions.find((s) => "coach:" + s.id === methodId) ?? null : null;
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [error, setError] = useState<{ msg: string } & LiveError | null>(null);
  const [pending, start] = useTransition();
  function create(startNow: boolean) {
    setError(null);
    start(async () => {
      const when = { date: startNow ? today : date, time: startNow ? "" : time, startNow };
      const r = await createTrainingSession(coach
        ? { source: "coach", coachSessionId: coach.id, ...when }
        : { source: "quick", methodId: methodId || null, title, minutes, ...when });
      if (!r.ok) { setError({ msg: r.error === "live" ? "live" : t.error, liveId: r.liveId }); return; }
      router.push("/train/sessions/" + r.data.id);
    });
  }
  return <form onSubmit={(e) => { e.preventDefault(); create(true); }} className="space-y-4" aria-label={t.newSession}>
    <label className="block text-sm font-semibold">{t.method}
      <select className={field} value={methodId} onChange={(e) => setMethodId(e.target.value)}>
        <option value="">{t.noMethod}</option>
        {coachSessions.length ? <optgroup label={c.group}>
          {coachSessions.map((s) => <option key={s.id} value={"coach:" + s.id}>{s.title} · {formatDuration(s.minutes)}</option>)}
        </optgroup> : null}
        <optgroup label={c.atlasGroup}>
          {METHODS_FOR_PLANS.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
        </optgroup>
      </select>
    </label>
    {coach ? <p className="text-sm text-ink-2">{fmt(c.durationFromCoach, { d: formatDuration(coach.minutes) })}</p> :
      <label className="block text-sm font-semibold">{t.sessionTitle}
        <input className={field} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {coach ? null : <DurationField className="col-span-2 sm:col-span-1" label={t.minutes} value={minutes}
        onChange={(v) => setMinutes(v ?? 0)} min={10} max={240} />}
      <label className="text-sm font-semibold">{t.date}
        <input className={field} type="date" min="2020-01-01" max="2100-12-31" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="text-sm font-semibold">{t.time}
        <input className={field} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </label>
    </div>
    {error ? (error.msg === "live" ? <LiveNotice locale={locale} liveId={error.liveId} /> :
      <p role="alert" className="text-sm font-semibold text-danger">{error.msg}</p>) : null}
    <div className="leblond-actions">
      <button type="submit" disabled={pending} className={buttonClass("primary", "md")}><IconPlay /> {t.startNow}</button>
      <button type="button" disabled={pending} onClick={() => create(false)} className={buttonClass("secondary", "md")}>{t.schedule}</button>
    </div>
    <p className="text-xs text-ink-3">{t.safetyNote}</p>
  </form>;
}

/** "Prepare / start" from a calendar TRAIN entry (idempotent: reuses an existing session). */
export function CalendarEntrySessionButton({ locale, entryId, sessionId }: { locale: Locale; entryId: string; sessionId: string | null }) {
  const t = trainingSessionDictionary(locale);
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState("");
  if (sessionId) {
    return <Link href={"/train/sessions/" + sessionId}
      className={buttonClass("primary", "sm")}>{t.openSession} <IconNext /></Link>;
  }
  return <>
    <button type="button" disabled={pending}
      onClick={() => start(async () => {
        setError("");
        const r = await createTrainingSession({ source: "calendar", calendarEntryId: entryId, startNow: false });
        if (!r.ok) { setError(t.error); return; }
        router.push("/train/sessions/" + r.data.id);
      })}
      className={buttonClass("primary", "sm")}>{t.prepare} <IconNext /></button>
    {error ? <span role="alert" className="text-xs text-danger">{error}</span> : null}
  </>;
}

/** Plan page: start one plan day now, or schedule a whole week. */
export function PlanSessionControls({ locale, planId, sessions, today, monday, phaseIndex = 0 }: {
  locale: Locale; planId: string; sessions: { day: number; methodId: string | null; minutes: number; title?: string }[]; today: string; monday: string;
  /** For plans in phases: the phase whose weekly template is scheduled or started. */
  phaseIndex?: number;
}) {
  const t = trainingSessionDictionary(locale);
  const router = useRouter();
  const [week, setWeek] = useState(monday);
  const [message, setMessage] = useState<{ msg: string } & LiveError | null>(null);
  const [pending, start] = useTransition();
  const days = locale === "fr" ? ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return <section className="space-y-4 rounded-2xl border border-accent/25 bg-accent-soft p-4" aria-label={t.scheduleThisWeek}>
    <div className="flex flex-wrap items-end gap-3 [&>label]:min-w-40 [&>label]:flex-1">
      <label className="text-sm font-semibold">{t.weekOf}
        <input type="date" className={field} value={week} onChange={(e) => setWeek(e.target.value)} />
      </label>
      <button type="button" disabled={pending}
        onClick={() => start(async () => {
          setMessage(null);
          const r = await schedulePlanWeek(planId, week, phaseIndex);
          setMessage({ msg: r.ok ? fmt(t.scheduledCount, { n: r.data.created }) : t.error });
          if (r.ok) router.refresh();
        })}
        className={buttonClass("primary", "md")}>{t.scheduleThisWeek}</button>
    </div>
    <p className="text-xs text-ink-2">{t.scheduleWeekHint}</p>
    <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      {sessions.map((s, i) => <li key={i}>
        <button type="button" disabled={pending}
          onClick={() => start(async () => {
            setMessage(null);
            const r = await createTrainingSession({ source: "plan", planId, planSessionIndex: i, phaseIndex, date: today, time: "", startNow: true });
            if (!r.ok) { setMessage({ msg: r.error === "live" ? "live" : t.error, liveId: r.liveId }); return; }
            router.push("/train/sessions/" + r.data.id);
          })}
          className={buttonClass("secondary", "sm", "w-full !justify-start !text-left")}>
          <IconPlay /> {days[s.day]} · {s.title ?? METHODS_FOR_PLANS.find((m) => m.id === s.methodId)?.title} · {s.minutes} min
        </button>
      </li>)}
    </ul>
    {message ? (message.msg === "live" ? <LiveNotice locale={locale} liveId={message.liveId} /> :
      <p role="status" className="text-sm font-semibold text-ink-2">{message.msg}</p>) : null}
  </section>;
}
