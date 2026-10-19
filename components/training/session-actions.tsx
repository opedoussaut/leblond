"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  changeTrainingStatus, createTrainingSession, deleteTrainingSession, schedulePlanWeek, startTrainingSession,
} from "@/lib/actions/training-sessions";
import { fmt, type Locale } from "@/lib/i18n";
import { trainingSessionDictionary } from "@/lib/i18n/training-session";
import { METHODS_FOR_PLANS } from "@/lib/training/catalogue";
import type { TrainingStatus } from "@/lib/training/sessions";

const field = "mt-1 block w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink";
type LiveError = { liveId?: string };

function LiveNotice({ locale, liveId }: { locale: Locale; liveId?: string }) {
  const t = trainingSessionDictionary(locale);
  return <p role="alert" className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
    {t.liveElsewhere}{liveId ? <> <Link className="font-bold text-accent underline" href={"/train/sessions/" + liveId}>{t.goLive}</Link></> : null}
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
          className="min-h-14 flex-1 rounded-2xl bg-accent px-6 text-base font-black text-accent-ink disabled:opacity-60 sm:flex-none">
          ▶ {status === "INTERRUPTED" ? t.resume : t.start}
        </button>
      ) : null}
      {status === "PLANNED" ? <>
        <button type="button" disabled={pending} onClick={() => run(() => changeTrainingStatus(id, "SKIPPED"))}
          className="min-h-12 rounded-2xl border border-line bg-surface px-4 text-sm font-bold">{t.skip}</button>
        <button type="button" disabled={pending} onClick={() => run(() => changeTrainingStatus(id, "CANCELED"))}
          className="min-h-12 rounded-2xl border border-line bg-surface px-4 text-sm font-bold">{t.cancel}</button>
      </> : null}
      {status === "SKIPPED" || status === "CANCELED" ? (
        <button type="button" disabled={pending} onClick={() => run(() => changeTrainingStatus(id, "PLANNED"))}
          className="min-h-12 rounded-2xl border border-line bg-surface px-4 text-sm font-bold">{t.reschedule}</button>
      ) : null}
      {status !== "IN_PROGRESS" ? (
        <button type="button" disabled={pending}
          onClick={() => { if (window.confirm(t.deleteConfirm)) run(() => deleteTrainingSession(id), () => router.push("/train/sessions")); }}
          className="min-h-12 rounded-2xl px-4 text-sm font-bold text-danger underline underline-offset-4">{t.delete}</button>
      ) : null}
    </div>
  </div>;
}

/** One-off session: start now or schedule, with or without an Atlas method. */
export function QuickSessionForm({ locale, today, presetMethod = "" }: { locale: Locale; today: string; presetMethod?: string }) {
  const t = trainingSessionDictionary(locale);
  const router = useRouter();
  const [methodId, setMethodId] = useState(presetMethod);
  const [title, setTitle] = useState("");
  const [minutes, setMinutes] = useState(60);
  const [date, setDate] = useState(today);
  const [time, setTime] = useState("");
  const [error, setError] = useState<{ msg: string } & LiveError | null>(null);
  const [pending, start] = useTransition();
  function create(startNow: boolean) {
    setError(null);
    start(async () => {
      const r = await createTrainingSession({
        source: "quick", methodId: methodId || null, title, minutes,
        date: startNow ? today : date, time: startNow ? "" : time, startNow,
      });
      if (!r.ok) { setError({ msg: r.error === "live" ? "live" : t.error, liveId: r.liveId }); return; }
      router.push("/train/sessions/" + r.data.id);
    });
  }
  return <form onSubmit={(e) => { e.preventDefault(); create(true); }} className="space-y-4" aria-label={t.newSession}>
    <label className="block text-sm font-semibold">{t.method}
      <select className={field} value={methodId} onChange={(e) => setMethodId(e.target.value)}>
        <option value="">{t.noMethod}</option>
        {METHODS_FOR_PLANS.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
      </select>
    </label>
    <label className="block text-sm font-semibold">{t.sessionTitle}
      <input className={field} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
    </label>
    <div className="grid grid-cols-3 gap-3">
      <label className="text-sm font-semibold">{t.minutes}
        <input className={field} type="number" min={10} max={240} step={5} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} />
      </label>
      <label className="text-sm font-semibold">{t.date}
        <input className={field} type="date" min="2020-01-01" max="2100-12-31" value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="text-sm font-semibold">{t.time}
        <input className={field} type="time" value={time} onChange={(e) => setTime(e.target.value)} />
      </label>
    </div>
    {error ? (error.msg === "live" ? <LiveNotice locale={locale} liveId={error.liveId} /> :
      <p role="alert" className="text-sm font-semibold text-danger">{error.msg}</p>) : null}
    <div className="flex flex-wrap gap-3">
      <button type="submit" disabled={pending} className="min-h-12 rounded-full bg-accent px-6 text-sm font-extrabold text-accent-ink disabled:opacity-60">▶ {t.startNow}</button>
      <button type="button" disabled={pending} onClick={() => create(false)} className="min-h-12 rounded-full border border-line bg-surface px-6 text-sm font-bold text-accent">{t.schedule}</button>
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
      className="inline-flex min-h-10 items-center rounded-lg bg-accent px-3 text-xs font-bold text-accent-ink">{t.openSession} →</Link>;
  }
  return <>
    <button type="button" disabled={pending}
      onClick={() => start(async () => {
        setError("");
        const r = await createTrainingSession({ source: "calendar", calendarEntryId: entryId, startNow: false });
        if (!r.ok) { setError(t.error); return; }
        router.push("/train/sessions/" + r.data.id);
      })}
      className="inline-flex min-h-10 items-center rounded-lg bg-accent px-3 text-xs font-bold text-accent-ink disabled:opacity-60">{t.prepare} →</button>
    {error ? <span role="alert" className="text-xs text-danger">{error}</span> : null}
  </>;
}

/** Plan page: start one plan day now, or schedule a whole week. */
export function PlanSessionControls({ locale, planId, sessions, today, monday }: {
  locale: Locale; planId: string; sessions: { day: number; methodId: string; minutes: number }[]; today: string; monday: string;
}) {
  const t = trainingSessionDictionary(locale);
  const router = useRouter();
  const [week, setWeek] = useState(monday);
  const [message, setMessage] = useState<{ msg: string } & LiveError | null>(null);
  const [pending, start] = useTransition();
  const days = locale === "fr" ? ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"] : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return <section className="space-y-4 rounded-2xl border border-accent/25 bg-accent-soft p-4" aria-label={t.scheduleThisWeek}>
    <div className="flex flex-wrap items-end gap-3">
      <label className="text-sm font-semibold">{t.weekOf}
        <input type="date" className={field} value={week} onChange={(e) => setWeek(e.target.value)} />
      </label>
      <button type="button" disabled={pending}
        onClick={() => start(async () => {
          setMessage(null);
          const r = await schedulePlanWeek(planId, week);
          setMessage({ msg: r.ok ? fmt(t.scheduledCount, { n: r.data.created }) : t.error });
          if (r.ok) router.refresh();
        })}
        className="min-h-12 rounded-full bg-accent px-5 text-sm font-extrabold text-accent-ink disabled:opacity-60">{t.scheduleThisWeek}</button>
    </div>
    <p className="text-xs text-ink-2">{t.scheduleWeekHint}</p>
    <ul className="flex flex-wrap gap-2">
      {sessions.map((s, i) => <li key={i}>
        <button type="button" disabled={pending}
          onClick={() => start(async () => {
            setMessage(null);
            const r = await createTrainingSession({ source: "plan", planId, planSessionIndex: i, date: today, time: "", startNow: true });
            if (!r.ok) { setMessage({ msg: r.error === "live" ? "live" : t.error, liveId: r.liveId }); return; }
            router.push("/train/sessions/" + r.data.id);
          })}
          className="min-h-11 rounded-full border border-line bg-surface px-4 text-xs font-bold text-accent">
          ▶ {days[s.day]} · {METHODS_FOR_PLANS.find((m) => m.id === s.methodId)?.title} · {s.minutes} min
        </button>
      </li>)}
    </ul>
    {message ? (message.msg === "live" ? <LiveNotice locale={locale} liveId={message.liveId} /> :
      <p role="status" className="text-sm font-semibold text-ink-2">{message.msg}</p>) : null}
  </section>;
}
