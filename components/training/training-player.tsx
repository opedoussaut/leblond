"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  changeTrainingStatus, completeTrainingSession, deleteTrainingSet, pauseTrainingSession,
  saveTrainingSet, setCurrentExercise, setExerciseStatus,
} from "@/lib/actions/training-sessions";
import { fmt, type Locale } from "@/lib/i18n";
import { trainingSessionDictionary } from "@/lib/i18n/training-session";
import {
  activeSeconds, formatClock, pick, restRemaining,
  type TrainingExercise, type TrainingSession, type TrainingSet,
} from "@/lib/training/sessions";

type ClimbOption = { id: string; label: string };
const inputClass = "mt-1 block w-full rounded-2xl border border-line bg-surface px-4 py-3 text-lg font-bold tabular-nums text-ink";

function restKey(sessionId: string) { return "lb-rest-" + sessionId; }
function readRest(sessionId: string): number | null {
  try { const v = Number(window.localStorage.getItem(restKey(sessionId))); return Number.isFinite(v) && v > 0 ? v : null; }
  catch { return null; }
}
function writeRest(sessionId: string, endsAt: number | null) {
  try {
    if (endsAt) window.localStorage.setItem(restKey(sessionId), String(endsAt));
    else window.localStorage.removeItem(restKey(sessionId));
  } catch { /* storage unavailable: the timer still works in memory */ }
}

export function TrainingPlayer({ locale, session, exercises: initial, climbs }: {
  locale: Locale; session: TrainingSession; exercises: TrainingExercise[]; climbs: ClimbOption[];
}) {
  const t = trainingSessionDictionary(locale);
  const router = useRouter();
  const [exercises, setExercises] = useState(initial);
  const [index, setIndex] = useState(Math.min(session.currentIndex, Math.max(0, initial.length - 1)));
  const [pausedAt, setPausedAt] = useState(session.pausedAt);
  const [pausedSeconds, setPausedSeconds] = useState(session.pausedSeconds);
  const [now, setNow] = useState(() => Date.now());
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const [finishing, setFinishing] = useState(false);
  const [, start] = useTransition();

  const current = exercises[index];
  const nextSetIndex = (current?.sets.reduce((m, s) => Math.max(m, s.setIndex), 0) ?? 0) + 1;

  // The clock only triggers re-renders; elapsed time is always derived from timestamps.
  // The rest timer's end time is restored from storage, so it survives a refresh.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const restore = window.setTimeout(() => setRestEndsAt(readRest(session.id)), 0);
    const timer = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearTimeout(restore); window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [session.id]);

  const elapsed = activeSeconds({ startedAt: session.startedAt, pausedAt, pausedSeconds, completedAt: null }, new Date(now));
  const rest = restRemaining(restEndsAt, now);
  const doneCount = exercises.filter((e) => e.status !== "PENDING").length;
  const progress = useMemo(() => exercises.length ? Math.round((doneCount / exercises.length) * 100) : 0, [doneCount, exercises.length]);

  function patchExercise(id: string, update: (e: TrainingExercise) => TrainingExercise) {
    setExercises((list) => list.map((e) => (e.id === id ? update(e) : e)));
  }
  function fail() { setNotice(t.offline); }

  function goTo(i: number) {
    const clamped = Math.max(0, Math.min(exercises.length - 1, i));
    setIndex(clamped); setNotice("");
    window.scrollTo({ top: 0, behavior: "smooth" });
    start(async () => { await setCurrentExercise(session.id, clamped); });
  }

  function togglePause() {
    const pausing = !pausedAt;
    const at = new Date().toISOString();
    if (pausing) setPausedAt(at);
    else {
      setPausedSeconds((s) => s + Math.round((Date.now() - new Date(pausedAt!).getTime()) / 1000));
      setPausedAt(null);
    }
    start(async () => { const r = await pauseTrainingSession(session.id, pausing); if (!r.ok) fail(); });
  }

  function logSet(values: Pick<TrainingSet, "reps" | "seconds" | "loadKg">) {
    if (!current) return;
    const set: TrainingSet = { id: "pending-" + nextSetIndex, setIndex: nextSetIndex, ...values, completed: true, notes: "" };
    patchExercise(current.id, (e) => ({ ...e, sets: [...e.sets, set] }));
    if (current.restSeconds) {
      const ends = Date.now() + current.restSeconds * 1000;
      setRestEndsAt(ends); writeRest(session.id, ends);
    }
    setNotice("");
    start(async () => {
      const r = await saveTrainingSet({
        exerciseId: current.id, setIndex: set.setIndex, reps: set.reps, seconds: set.seconds,
        loadKg: set.loadKg, completed: true, notes: "",
      });
      if (!r.ok) {
        patchExercise(current.id, (e) => ({ ...e, sets: e.sets.filter((s) => s.setIndex !== set.setIndex) }));
        fail();
        return;
      }
      patchExercise(current.id, (e) => ({ ...e, sets: e.sets.map((s) => s.setIndex === set.setIndex ? { ...s, id: r.data.id } : s) }));
      setNotice(t.saved);
    });
  }

  function removeSet(setIndex: number) {
    if (!current) return;
    const exerciseId = current.id;
    const before = current.sets;
    patchExercise(exerciseId, (e) => ({ ...e, sets: e.sets.filter((s) => s.setIndex !== setIndex) }));
    start(async () => {
      const r = await deleteTrainingSet(exerciseId, setIndex);
      if (!r.ok) { patchExercise(exerciseId, (e) => ({ ...e, sets: before })); fail(); }
    });
  }

  function settle(status: TrainingExercise["status"]) {
    if (!current) return;
    const exercise = current;
    patchExercise(exercise.id, (e) => ({ ...e, status }));
    clearRest();
    start(async () => {
      const r = await setExerciseStatus({ exerciseId: exercise.id, status, rpe: exercise.rpe, notes: exercise.notes });
      if (!r.ok) { patchExercise(exercise.id, (e) => ({ ...e, status: exercise.status })); fail(); return; }
    });
    if (index < exercises.length - 1) goTo(index + 1);
    else setFinishing(true);
  }

  function nextExercise() {
    if (!current) return;
    const done = current.sets.filter((s) => s.completed).length;
    settle(done === 0 ? "SKIPPED" : current.targetSets && done < current.targetSets ? "MODIFIED" : "DONE");
  }

  function clearRest() { setRestEndsAt(null); writeRest(session.id, null); }

  function stopEarly() {
    if (!window.confirm(t.stopConfirm)) return;
    start(async () => {
      const r = await changeTrainingStatus(session.id, "INTERRUPTED");
      if (!r.ok) { fail(); return; }
      clearRest(); router.refresh();
    });
  }

  if (!current) return <p className="text-sm text-ink-2">{t.noSets}</p>;
  const isTime = current.modality === "TIME" || current.modality === "FREE";
  const targetLine = [
    current.targetSets ? `${current.targetSets} ${current.targetSets > 1 ? t.sets : t.set.toLowerCase()}` : null,
    current.targetReps ? `${current.targetReps} ${current.modality === "ROUTES" ? "×" : t.reps}` : null,
    current.targetSeconds ? (isTime ? `${Math.round(current.targetSeconds / 60)} ${t.minutesShort}` : `${current.targetSeconds} ${t.seconds}`) : null,
    current.restSeconds ? `${t.rest} ${formatClock(current.restSeconds)}` : null,
  ].filter(Boolean).join(" · ");
  const instr = current.instructions;

  return <div className="space-y-5 pb-6">
    <section aria-label={t.player} className="sticky top-0 z-20 -mx-4 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 md:static md:mx-0 md:rounded-[1.5rem] md:border md:bg-surface md:px-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{pausedAt ? t.paused : t.elapsed}</p>
          <p className="text-3xl font-black tabular-nums tracking-tight" role="timer" aria-live="off">{formatClock(elapsed)}</p>
        </div>
        <button type="button" onClick={togglePause} aria-pressed={!!pausedAt}
          className="min-h-14 rounded-full border border-line bg-surface px-6 text-base font-extrabold text-accent">
          {pausedAt ? "▶ " + t.resumeTimer : "❚❚ " + t.pause}
        </button>
      </div>
      <div className="mt-3" aria-hidden="true">
        <div className="flex gap-1">
          {exercises.map((e, i) => <span key={e.id} className={"h-1.5 flex-1 rounded-full " +
            (i === index ? "bg-accent" : e.status === "PENDING" ? "bg-line" : e.status === "SKIPPED" ? "bg-ink-3/40" : "bg-accent/50")} />)}
        </div>
      </div>
      <p className="mt-2 text-xs font-semibold text-ink-2">
        {fmt(t.exerciseOf, { n: index + 1, total: exercises.length })} · {progress}%
      </p>
    </section>

    {rest > 0 ? <section role="status" aria-live="polite" className="rounded-[1.5rem] border border-accent/30 bg-accent-soft p-5 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.12em] text-accent">{t.restTimer}</p>
      <p className="mt-1 text-5xl font-black tabular-nums text-accent">{formatClock(rest)}</p>
      <button type="button" onClick={clearRest} className="mt-3 min-h-12 rounded-full border border-accent/30 bg-surface px-5 text-sm font-bold text-accent">{t.skipRest}</button>
    </section> : null}

    <article className="leblond-premium-surface p-5 sm:p-6" aria-labelledby="current-exercise">
      <p className="leblond-eyebrow text-accent">{t.block[current.block]} · {t.exStatus[current.status]}</p>
      <h2 id="current-exercise" className="mt-2 text-2xl font-black tracking-tight">{current.name}</h2>
      {targetLine ? <p className="mt-2 text-base font-bold text-ink">{targetLine}</p> : null}
      {current.intensity ? <p className="mt-1 text-sm text-ink-2"><span className="font-semibold">{t.intensity} :</span> {current.intensity}</p> : null}
      {instr.summary ? <p className="mt-3 text-sm leading-relaxed text-ink-2">{pick(instr.summary, locale)}</p> : null}
      <details className="mt-3 rounded-xl border border-line bg-surface-2 p-3">
        <summary className="min-h-10 cursor-pointer text-sm font-bold text-accent">{t.howTo}</summary>
        <ol className="mt-2 list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
          {(instr.steps ?? []).map((s, i) => <li key={i}>{pick(s, locale)}</li>)}
        </ol>
        {instr.safety ? <p className="mt-3 text-sm text-ink"><strong>{t.safety} :</strong> {pick(instr.safety, locale)}</p> : null}
        {instr.adaptation ? <p className="mt-2 text-sm text-ink-2"><strong>{t.adaptation} :</strong> {pick(instr.adaptation, locale)}</p> : null}
        {current.methodId ? <Link href={"/atlas/" + current.methodId} className="mt-3 inline-block text-sm font-bold text-accent underline underline-offset-4">{t.atlasSheet} ↗</Link> : null}
      </details>

      <div className="mt-5 border-t border-line pt-5">
        <h3 className="text-sm font-extrabold">{t.set} {nextSetIndex}{current.targetSets ? ` / ${current.targetSets}` : ""}</h3>
        <SetLogger key={current.id} locale={locale} exercise={current} onLog={logSet} />
        <h3 className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{t.completedSets}</h3>
        {current.sets.length === 0 ? <p className="mt-2 text-sm text-ink-3">{t.noSets}</p> :
          <ul className="mt-2 space-y-2">
            {current.sets.map((s) => <li key={s.setIndex} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm">
              <span className="font-bold tabular-nums">{t.set} {s.setIndex}
                <span className="ml-2 font-semibold text-ink-2">
                  {[s.reps !== null ? `${s.reps} ${current.modality === "ROUTES" ? "✓" : t.reps}` : null,
                    s.seconds !== null ? (isTime ? `${Math.round(s.seconds / 60)} ${t.minutesShort}` : `${s.seconds} ${t.seconds}`) : null,
                    s.loadKg !== null ? `${s.loadKg > 0 ? "+" : ""}${s.loadKg} kg` : null].filter(Boolean).join(" · ")}
                </span>
              </span>
              <button type="button" onClick={() => removeSet(s.setIndex)} className="min-h-10 rounded-lg px-3 text-xs font-bold text-danger">{t.removeSet}</button>
            </li>)}
          </ul>}
      </div>
    </article>

    {notice ? <p role="status" className="text-center text-sm font-semibold text-ink-2">{notice}</p> : null}

    <div className="grid gap-3">
      <button type="button" onClick={nextExercise}
        className="min-h-16 w-full rounded-2xl bg-ink px-6 text-lg font-black text-surface">
        {index < exercises.length - 1 ? t.next + " →" : t.finish}
      </button>
      <div className="grid grid-cols-2 gap-3">
        <button type="button" onClick={() => goTo(index - 1)} disabled={index === 0}
          className="min-h-14 rounded-2xl border border-line bg-surface text-sm font-bold disabled:opacity-40">← {t.previous}</button>
        <button type="button" onClick={() => settle("SKIPPED")}
          className="min-h-14 rounded-2xl border border-line bg-surface text-sm font-bold text-ink-2">{t.markSkipped}</button>
      </div>
    </div>

    <nav aria-label={t.exercises} className="leblond-premium-surface p-4">
      <h2 className="text-sm font-extrabold">{t.exercises}</h2>
      <ol className="mt-3 space-y-1.5">
        {exercises.map((e, i) => <li key={e.id}>
          <button type="button" onClick={() => goTo(i)} aria-current={i === index ? "step" : undefined}
            className={"flex min-h-12 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm " +
              (i === index ? "bg-accent-soft font-bold text-accent" : "hover:bg-surface-2")}>
            <span>{i + 1}. {e.name}</span>
            <span className="text-xs font-semibold text-ink-3">{t.exStatus[e.status]} · {e.sets.length}</span>
          </button>
        </li>)}
      </ol>
    </nav>

    {finishing ? <FinishForm locale={locale} sessionId={session.id} climbs={climbs} onCancel={() => setFinishing(false)} onDone={() => { clearRest(); router.refresh(); }} />
      : <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={() => setFinishing(true)} className="min-h-12 rounded-full bg-accent px-6 text-sm font-extrabold text-accent-ink">{t.finish}</button>
        <button type="button" onClick={stopEarly} className="min-h-12 rounded-full px-4 text-sm font-bold text-danger underline underline-offset-4">{t.stopEarly}</button>
      </div>}
  </div>;
}

export function FinishForm({ locale, sessionId, climbs, onCancel, onDone }: {
  locale: Locale; sessionId: string; climbs: ClimbOption[]; onCancel: () => void; onDone: () => void;
}) {
  const t = trainingSessionDictionary(locale);
  const [rpe, setRpe] = useState<number | null>(null);
  const [pain, setPain] = useState<number | null>(0);
  const [painNotes, setPainNotes] = useState("");
  const [notes, setNotes] = useState("");
  const [climb, setClimb] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  function submit(e: React.FormEvent) {
    e.preventDefault(); setError("");
    start(async () => {
      const r = await completeTrainingSession({ sessionId, rpe, pain, painNotes, notes, climbingSessionId: climb || null });
      if (!r.ok) { setError(t.offline); return; }
      onDone();
    });
  }
  return <form onSubmit={submit} className="leblond-premium-surface space-y-4 p-5" aria-labelledby="finish-title">
    <h2 id="finish-title" className="text-xl font-black">{t.finishTitle}</h2>
    <p className="text-sm text-ink-2">{t.finishHint}</p>
    <fieldset>
      <legend className="text-sm font-semibold">{t.rpe}</legend>
      <div className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-10">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) =>
          <button type="button" key={n} aria-pressed={rpe === n} onClick={() => setRpe(n)}
            className={"min-h-12 rounded-xl border text-base font-bold " + (rpe === n ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface")}>{n}</button>)}
      </div>
    </fieldset>
    <label className="block text-sm font-semibold">{t.pain}
      <input type="range" min={0} max={10} value={pain ?? 0} onChange={(e) => setPain(Number(e.target.value))} className="mt-2 w-full accent-accent" />
      <span className="text-sm font-bold tabular-nums">{pain ?? 0} / 10</span>
    </label>
    {(pain ?? 0) > 0 ? <label className="block text-sm font-semibold">{t.painNotes}
      <input value={painNotes} maxLength={500} onChange={(e) => setPainNotes(e.target.value)} className="mt-1 block w-full rounded-xl border border-line bg-surface px-3 py-2.5" />
    </label> : null}
    <label className="block text-sm font-semibold">{t.notes}
      <textarea rows={3} maxLength={2000} value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 block w-full rounded-xl border border-line bg-surface px-3 py-2.5" />
    </label>
    {climbs.length ? <label className="block text-sm font-semibold">{t.linkClimb}
      <select value={climb} onChange={(e) => setClimb(e.target.value)} className="mt-1 block w-full rounded-xl border border-line bg-surface px-3 py-2.5">
        <option value="">{t.noLink}</option>
        {climbs.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
      </select>
      <span className="mt-1 block text-xs text-ink-3">{t.linkHint}</span>
    </label> : null}
    {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
    <div className="flex flex-wrap gap-3">
      <button type="submit" disabled={pending} className="min-h-14 flex-1 rounded-2xl bg-accent px-6 text-base font-black text-accent-ink disabled:opacity-60">
        {pending ? t.saving : t.confirmFinish}
      </button>
      <button type="button" onClick={onCancel} className="min-h-14 rounded-2xl border border-line px-5 text-sm font-bold">{t.previous}</button>
    </div>
  </form>;
}

/** Inputs for the next set, pre-filled with the exercise targets. Remounted per exercise. */
function SetLogger({ locale, exercise, onLog }: {
  locale: Locale; exercise: TrainingExercise; onLog: (v: Pick<TrainingSet, "reps" | "seconds" | "loadKg">) => void;
}) {
  const t = trainingSessionDictionary(locale);
  const isTime = exercise.modality === "TIME" || exercise.modality === "FREE";
  const [reps, setReps] = useState(exercise.targetReps ? String(exercise.targetReps) : "");
  const [seconds, setSeconds] = useState(exercise.targetSeconds
    ? String(isTime ? Math.round(exercise.targetSeconds / 60) : exercise.targetSeconds) : "");
  const [load, setLoad] = useState(exercise.sets.at(-1)?.loadKg?.toString() ?? "");
  const num = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  function submit() {
    const r = num(reps), sec = num(seconds), kg = num(load);
    onLog({
      reps: r === null ? null : Math.max(0, Math.round(r)),
      seconds: sec === null ? null : Math.max(0, Math.round(sec * (isTime ? 60 : 1))),
      loadKg: kg === null ? null : Math.round(kg * 2) / 2,
    });
  }
  return <>
    <div className="mt-2 grid grid-cols-2 gap-3">
      {exercise.modality === "REPS" || exercise.modality === "ROUTES" || exercise.modality === "INTERVALS" ? (
        <label className="text-sm font-semibold">{exercise.modality === "ROUTES" ? t.routesLabel : exercise.modality === "INTERVALS" ? t.intervalsLabel : t.repsLabel}
          <input className={inputClass} inputMode="numeric" type="number" min={0} max={500} value={reps} onChange={(e) => setReps(e.target.value)} />
        </label>
      ) : null}
      {exercise.modality === "HOLD" || isTime ? (
        <label className="text-sm font-semibold">{isTime ? t.duration + " (" + t.minutesShort + ")" : t.secondsLabel}
          <input className={inputClass} inputMode="numeric" type="number" min={0} max={isTime ? 120 : 7200} value={seconds} onChange={(e) => setSeconds(e.target.value)} />
        </label>
      ) : null}
      {exercise.modality === "HOLD" || exercise.modality === "INTERVALS" || (exercise.modality === "REPS" && exercise.block === "MAIN") ? (
        <label className="col-span-2 text-sm font-semibold sm:col-span-1">{t.load}
          <input className={inputClass} inputMode="decimal" type="number" step={0.5} min={-100} max={300} value={load} onChange={(e) => setLoad(e.target.value)} />
        </label>
      ) : null}
    </div>
    <button type="button" onClick={submit}
      className="mt-4 min-h-16 w-full rounded-2xl bg-accent px-6 text-lg font-black text-accent-ink active:scale-[0.99]">
      ✓ {t.logSet}
    </button>
  </>;
}
