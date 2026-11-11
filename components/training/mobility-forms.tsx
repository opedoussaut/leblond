"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { enrollInMobility, updateMobilitySettings } from "@/lib/actions/mobility";
import { createTrainingSession, scheduleMobilitySessions } from "@/lib/actions/training-sessions";
import { formatDate } from "@/lib/format";
import { fmt, type Locale } from "@/lib/i18n";
import { mobilityDictionary } from "@/lib/i18n/mobility";
import { EXERCISE_BY_ID, LEVEL_SESSIONS, type SessionLength } from "@/lib/training/hip-mobility/content";
import { VARIANT_NAMES, type Dose, type SessionPlan } from "@/lib/training/hip-mobility/prescription";
import { pick } from "@/lib/training/sessions";
import { buttonClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";

const STANDARD_MIN = LEVEL_SESSIONS[0]!.STANDARD.minutes;
const SHORT_MIN = LEVEL_SESSIONS[0]!.SHORT.minutes;

function chip(on: boolean) {
  return "min-h-11 rounded-full border px-4 text-sm font-bold " + (on ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink");
}

export function doseText(locale: Locale, exerciseId: string, dose: Dose): string {
  const m = mobilityDictionary(locale);
  const ex = EXERCISE_BY_ID.get(exerciseId);
  if (!ex) return "";
  const reps = fmt(ex.perSide ? m.perSide : m.total, { reps: dose.reps });
  return dose.variant === "STANDARD" ? reps : `${reps} · ${pick(VARIANT_NAMES[dose.variant], locale).toLowerCase()}`;
}

function LengthPicker({ locale, value, onChange }: { locale: Locale; value: SessionLength; onChange: (v: SessionLength) => void }) {
  const m = mobilityDictionary(locale);
  return <fieldset>
    <legend className="text-sm font-semibold">{m.defaultLength}</legend>
    <div className="mt-1 flex flex-wrap gap-2">
      <button type="button" aria-pressed={value === "STANDARD"} onClick={() => onChange("STANDARD")} className={chip(value === "STANDARD")}>{fmt(m.standard, { min: STANDARD_MIN })}</button>
      <button type="button" aria-pressed={value === "SHORT"} onClick={() => onChange("SHORT")} className={chip(value === "SHORT")}>{fmt(m.short, { min: SHORT_MIN })}</button>
    </div>
  </fieldset>;
}

function PerWeek({ locale, value, onChange, id }: { locale: Locale; value: number; onChange: (v: number) => void; id: string }) {
  const m = mobilityDictionary(locale);
  return <label htmlFor={id} className="block text-sm font-semibold">{m.perWeek}
    <select id={id} value={value} onChange={(e) => onChange(Number(e.target.value))} className={fieldClass}>
      {[1, 2, 3, 4, 5, 6, 7].map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
    <span className="mt-1 block text-xs font-normal text-ink-3">{m.perWeekHint}</span>
  </label>;
}

/** Join the programme: sessions per week and the usual length, nothing else. */
export function MobilityEnrollForm({ locale }: { locale: Locale }) {
  const m = mobilityDictionary(locale);
  const router = useRouter();
  const [perWeek, setPerWeek] = useState(3);
  const [length, setLength] = useState<SessionLength>("STANDARD");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    start(async () => {
      const r = await enrollInMobility({ sessionsPerWeek: perWeek, sessionLength: length });
      if (!r.ok) { setError(m.problem); return; }
      router.refresh();
    });
  }
  return <form onSubmit={submit} className="space-y-4" aria-labelledby="enroll-title">
    <h2 id="enroll-title" className="text-lg font-extrabold">{m.enrollTitle}</h2>
    <PerWeek locale={locale} value={perWeek} onChange={setPerWeek} id="mob-per-week" />
    <LengthPicker locale={locale} value={length} onChange={setLength} />
    {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
    <button type="submit" disabled={pending} className={buttonClass("primary", "md")}>{pending ? m.enrolling : m.enroll}</button>
  </form>;
}

/**
 * The next session as prescribed from the records: each exercise with its dose
 * and why, and any increase on offer, which only applies if the climber ticks it.
 */
export function MobilityNextSession({ locale, plan, today, liveId }: {
  locale: Locale; plan: SessionPlan; today: string; liveId: string | null;
}) {
  const m = mobilityDictionary(locale);
  const router = useRouter();
  const [accept, setAccept] = useState<string[]>([]);
  const [error, setError] = useState<{ msg: string; liveId?: string } | null>(null);
  const [pending, start] = useTransition();
  function run(length: SessionLength) {
    setError(null);
    start(async () => {
      const r = await createTrainingSession({ source: "mobility", length, accept, date: today, time: "", startNow: true });
      if (!r.ok) { setError(r.error === "live" ? { msg: m.live, liveId: r.liveId } : { msg: m.problem }); return; }
      router.push("/train/sessions/" + r.data.id);
    });
  }
  const names = plan.excluded.map((id) => EXERCISE_BY_ID.get(id)?.name[locale] ?? id).join(", ");
  return <div className="space-y-4">
    {plan.decisions.length === 0 ? <p className="text-sm font-semibold text-warn">{m.noExercise}</p> : <ol className="space-y-3">
      {plan.decisions.map((d, i) => {
        const ex = EXERCISE_BY_ID.get(d.exerciseId)!;
        return <li key={d.exerciseId} className="rounded-2xl border border-line bg-surface p-4">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="font-extrabold">{i + 1}. {ex.name[locale]}</p>
            <p className="text-sm font-bold tabular-nums text-ink">{doseText(locale, d.exerciseId, d.dose)}</p>
          </div>
          <p className="mt-1 text-sm text-ink-2">
            {d.stepBack ? <span className="mr-2 rounded-full bg-warn/15 px-2 py-0.5 text-xs font-bold text-warn">{m.stepBack}</span> : null}
            {m.reasons[d.reason]}
          </p>
          {d.offer ? <label className="mt-2 flex min-h-11 items-center gap-3 rounded-xl bg-accent-soft px-3 text-sm font-semibold text-accent">
            <input type="checkbox" checked={accept.includes(d.exerciseId)} className="h-5 w-5 accent-accent"
              onChange={(e) => setAccept((list) => e.target.checked ? [...list, d.exerciseId] : list.filter((x) => x !== d.exerciseId))} />
            <span>{fmt(m.offer, { dose: doseText(locale, d.exerciseId, d.offer) })} — {m.acceptOffer}</span>
          </label> : null}
        </li>;
      })}
    </ol>}
    {plan.excluded.length ? <p className="text-sm text-ink-2">{fmt(m.excluded, { names })}</p> : null}
    {error ? <p role="alert" className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
      {error.msg}{error.liveId ? <> <Link className="font-bold text-accent underline" href={"/train/sessions/" + error.liveId}>{m.openLive}</Link></> : null}
    </p> : null}
    {liveId ? <p className="text-sm">{m.live} <Link className="font-bold text-accent underline" href={"/train/sessions/" + liveId}>{m.openLive}</Link></p> : null}
    {plan.decisions.length ? <div className="flex flex-wrap gap-3">
      <button type="button" disabled={pending} onClick={() => run("STANDARD")} className={buttonClass("primary", "md", "flex-1 sm:flex-none")}>
        ▶ {pending ? m.starting : m.startStandard}
      </button>
      <button type="button" disabled={pending} onClick={() => run("SHORT")} className={buttonClass("secondary", "md", "flex-1 sm:flex-none")}>
        {m.startShort}
      </button>
    </div> : null}
  </div>;
}

function addDays(date: string, n: number) {
  const [y, mo, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1, d + n)).toISOString().slice(0, 10);
}

/** Plan sessions on chosen days of the next two weeks (each one is prescribed again at start). */
export function MobilityScheduleForm({ locale, today, length, taken }: {
  locale: Locale; today: string; length: SessionLength; taken: readonly string[];
}) {
  const m = mobilityDictionary(locale);
  const router = useRouter();
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i));
  const [picked, setPicked] = useState<string[]>([]);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  function submit(e: React.FormEvent) {
    e.preventDefault(); setMessage("");
    start(async () => {
      const r = await scheduleMobilitySessions({ dates: picked, length });
      if (!r.ok) { setMessage(m.problem); return; }
      setMessage(r.data.created ? fmt(m.scheduled, { n: r.data.created }) : m.scheduledNone);
      setPicked([]);
      router.refresh();
    });
  }
  return <form onSubmit={submit} className="space-y-3">
    <p className="text-sm text-ink-2">{m.scheduleHint}</p>
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
      {days.map((d) => {
        const busy = taken.includes(d);
        const on = picked.includes(d);
        return <button key={d} type="button" disabled={busy} aria-pressed={on}
          onClick={() => setPicked((list) => on ? list.filter((x) => x !== d) : [...list, d])}
          className={"min-h-12 rounded-xl border px-2 text-sm font-bold disabled:opacity-40 " + (on ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface")}>
          {formatDate(d + "T12:00:00", locale, { weekday: "short", day: "numeric", month: "short" })}
        </button>;
      })}
    </div>
    <button type="submit" disabled={pending || picked.length === 0} className={buttonClass("secondary", "md")}>{m.schedule}</button>
    {message ? <p role="status" className="text-sm font-semibold text-ink-2">{message}</p> : null}
  </form>;
}

export function MobilitySettingsForm({ locale, enrollment }: {
  locale: Locale; enrollment: { sessionsPerWeek: number; sessionLength: SessionLength; status: "ACTIVE" | "PAUSED" };
}) {
  const m = mobilityDictionary(locale);
  const router = useRouter();
  const [perWeek, setPerWeek] = useState(enrollment.sessionsPerWeek);
  const [length, setLength] = useState<SessionLength>(enrollment.sessionLength);
  const [message, setMessage] = useState("");
  const [pending, start] = useTransition();
  function save(status?: "ACTIVE" | "PAUSED") {
    setMessage("");
    start(async () => {
      const r = await updateMobilitySettings({ sessionsPerWeek: perWeek, sessionLength: length, ...(status ? { status } : {}) });
      setMessage(r.ok ? m.settingsSaved : m.problem);
      if (r.ok) router.refresh();
    });
  }
  return <div className="space-y-4">
    <PerWeek locale={locale} value={perWeek} onChange={setPerWeek} id="mob-settings-per-week" />
    <LengthPicker locale={locale} value={length} onChange={setLength} />
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={pending} onClick={() => save()} className={buttonClass("secondary", "md")}>{m.saveSettings}</button>
      <button type="button" disabled={pending} onClick={() => save(enrollment.status === "ACTIVE" ? "PAUSED" : "ACTIVE")}
        className="min-h-12 rounded-2xl border border-line bg-surface px-4 text-sm font-bold">
        {enrollment.status === "ACTIVE" ? m.pause : m.resume}
      </button>
    </div>
    {message ? <p role="status" className="text-sm font-semibold text-ink-2">{message}</p> : null}
  </div>;
}
