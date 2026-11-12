"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { egoTimeline } from "@/lib/analytics/alter-ego";
import {
  changeTrainingStatus, completeTrainingSession, deleteTrainingSet, pauseTrainingSession,
  saveTrainingSet, setCurrentExercise, setExerciseStatus,
} from "@/lib/actions/training-sessions";
import { fmt, type Locale } from "@/lib/i18n";
import { trainingSessionDictionary } from "@/lib/i18n/training-session";
import { coachSessionsDictionary } from "@/lib/i18n/coach-sessions";
import { demoUrl, musclewikiUrl } from "@/lib/training/coach-sessions";
import {
  activeSeconds, formatClock, pick, restRemaining,
  type SaveSetInput, type TrainingExercise, type TrainingSession, type TrainingSet,
} from "@/lib/training/sessions";
import { buttonClass } from "@/components/ui/button";
import { mobilityDictionary } from "@/lib/i18n/mobility";
import { WARNING_FLAGS, type WarningFlag } from "@/lib/training/hip-mobility/assessment";
import { VARIANTS, VARIANT_NAMES, type Variant } from "@/lib/training/hip-mobility/prescription";
import { scheduleBeeps, unlockSound } from "@/lib/training/beeper";
import { restBeeps } from "@/lib/training/timer";
import { AlterEgoLane } from "./alter-ego-lane";
import { EffortTimer, SoundToggle, useSoundSetting, useWakeLock } from "./effort-timer";
import { MobilityIllustration } from "./mobility-illustrations";

type LoggedValues = Pick<TrainingSet, "reps" | "seconds" | "loadKg" | "edgeMm">
  & Partial<Pick<TrainingSet, "side" | "variant" | "controlled" | "discomfort" | "flags">>;

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

/*
 * Sets not yet confirmed by the server are kept in a local queue, so a refresh,
 * a lost connection or a closed tab never loses recorded work. Saves are keyed
 * by (exercise, set number) on the server, so re-sending a queued set is safe.
 */
function pendingKey(sessionId: string) { return "lb-pending-sets-" + sessionId; }
function readPending(sessionId: string): SaveSetInput[] {
  try { const v = JSON.parse(window.localStorage.getItem(pendingKey(sessionId)) ?? "[]"); return Array.isArray(v) ? v : []; }
  catch { return []; }
}
function updatePending(sessionId: string, fn: (list: SaveSetInput[]) => SaveSetInput[]) {
  try {
    const next = fn(readPending(sessionId));
    if (next.length) window.localStorage.setItem(pendingKey(sessionId), JSON.stringify(next));
    else window.localStorage.removeItem(pendingKey(sessionId));
  } catch { /* storage unavailable: saves still go straight to the server */ }
}
const sameSet = (a: Pick<SaveSetInput, "exerciseId" | "setIndex">, b: Pick<SaveSetInput, "exerciseId" | "setIndex">) =>
  a.exerciseId === b.exerciseId && a.setIndex === b.setIndex;

export function TrainingPlayer({ locale, session, exercises: initial, climbs, ego = null }: {
  locale: Locale; session: TrainingSession; exercises: TrainingExercise[]; climbs: ClimbOption[];
  ego?: { name: string; factor: number; easeOff: boolean } | null;
}) {
  const t = trainingSessionDictionary(locale);
  const c = coachSessionsDictionary(locale);
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
  const [sound, setSound] = useSoundSetting();
  // The rest's beeps, scheduled when it starts; cancelled when it is skipped or the page closes.
  const restBeepsCancel = useRef<(() => void) | null>(null);

  const current = exercises[index];
  const nextSetIndex = (current?.sets.reduce((m, s) => Math.max(m, s.setIndex), 0) ?? 0) + 1;

  // The clock only triggers re-renders; elapsed time is always derived from timestamps.
  // The rest timer's end time is restored from storage, so it survives a refresh.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const restore = window.setTimeout(() => {
      const ends = readRest(session.id);
      setRestEndsAt(ends);
      // After a reload the phone may only beep again after a tap; the countdown still shows.
      if (ends) restBeepsCancel.current = scheduleBeeps(restBeeps(ends, Date.now()));
    }, 0);
    const timer = window.setInterval(tick, 1000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearTimeout(restore); window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      restBeepsCancel.current?.();
    };
  }, [session.id]);

  async function flushPending() {
    for (const q of readPending(session.id)) {
      const r = await saveTrainingSet(q);
      if (!r.ok) { if (r.error !== "not_found") { setNotice(t.offline); return; } }
      updatePending(session.id, (list) => list.filter((x) => !sameSet(x, q)));
      if (r.ok) patchExercise(q.exerciseId, (e) => ({ ...e, sets: e.sets.map((x) => x.setIndex === q.setIndex ? { ...x, id: r.data.id } : x) }));
    }
    setNotice(t.saved);
  }

  // Recover sets that were logged but not confirmed before a refresh, then re-send them.
  useEffect(() => {
    const queued = readPending(session.id);
    if (!queued.length) return;
    const timer = window.setTimeout(() => {
      setExercises((list) => list.map((e) => {
        const missing = queued.filter((q) => q.exerciseId === e.id && !e.sets.some((x) => x.setIndex === q.setIndex));
        if (!missing.length) return e;
        return { ...e, sets: [...e.sets, ...missing.map((q) => ({ id: "pending-" + q.setIndex, setIndex: q.setIndex,
          reps: q.reps, seconds: q.seconds, loadKg: q.loadKg, edgeMm: q.edgeMm ?? null, completed: q.completed, notes: q.notes,
          side: q.side ?? null, variant: q.variant ?? null, controlled: q.controlled ?? null, discomfort: q.discomfort ?? null, flags: q.flags ?? [] }))]
          .sort((a, b) => a.setIndex - b.setIndex) };
      }));
      void flushPending();
    }, 0);
    const retry = () => { void flushPending(); };
    window.addEventListener("online", retry);
    return () => { window.clearTimeout(timer); window.removeEventListener("online", retry); };
  }, [session.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const elapsed = activeSeconds({ startedAt: session.startedAt, pausedAt, pausedSeconds, completedAt: null }, new Date(now));
  const rest = restRemaining(restEndsAt, now);
  // The phone can lie on the floor during the rest: the screen stays on until it beeps.
  useWakeLock(rest > 0);
  const doneCount = exercises.filter((e) => e.status !== "PENDING").length;
  const progress = useMemo(() => exercises.length ? Math.round((doneCount / exercises.length) * 100) : 0, [doneCount, exercises.length]);
  const egoPhases = useMemo(() => (ego ? egoTimeline(initial, ego.factor) : []), [ego, initial]);

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

  function logSet(values: LoggedValues) {
    if (!current) return;
    const set: TrainingSet = { id: "pending-" + nextSetIndex, setIndex: nextSetIndex, ...values, completed: true, notes: "" };
    patchExercise(current.id, (e) => ({ ...e, sets: [...e.sets, set] }));
    if (current.restSeconds) startRest(current.restSeconds);
    const input: SaveSetInput = {
      exerciseId: current.id, setIndex: set.setIndex, reps: set.reps, seconds: set.seconds,
      loadKg: set.loadKg, edgeMm: set.edgeMm ?? null, completed: true, notes: "",
      // Hip-mobility details, only sent when recorded.
      ...(values.side ? { side: values.side } : {}),
      ...(values.variant ? { variant: values.variant } : {}),
      ...(values.controlled !== undefined ? { controlled: values.controlled } : {}),
      ...(values.discomfort !== undefined ? { discomfort: values.discomfort } : {}),
      ...(values.flags?.length ? { flags: values.flags } : {}),
    };
    // Queue first (synchronously) so a refresh during the request cannot lose the set.
    updatePending(session.id, (list) => [...list.filter((x) => !sameSet(x, input)), input]);
    setNotice(t.saving);
    start(async () => {
      const r = await saveTrainingSet(input);
      if (!r.ok) { fail(); return; } // stays queued; retried on reload or reconnect
      updatePending(session.id, (list) => list.filter((x) => !sameSet(x, input)));
      patchExercise(current.id, (e) => ({ ...e, sets: e.sets.map((s) => s.setIndex === set.setIndex ? { ...s, id: r.data.id } : s) }));
      setNotice(t.saved);
    });
  }

  function removeSet(setIndex: number) {
    if (!current) return;
    const exerciseId = current.id;
    const before = current.sets;
    patchExercise(exerciseId, (e) => ({ ...e, sets: e.sets.filter((s) => s.setIndex !== setIndex) }));
    updatePending(session.id, (list) => list.filter((x) => !sameSet(x, { exerciseId, setIndex })));
    start(async () => {
      const r = await deleteTrainingSet(exerciseId, setIndex);
      if (!r.ok) { patchExercise(exerciseId, (e) => ({ ...e, sets: before })); fail(); }
    });
  }

  function settle(status: TrainingExercise["status"]) {
    if (!current) return;
    const exercise = current;
    patchExercise(exercise.id, (e) => ({ ...e, status }));
    // Rest before the next exercise (coach sessions), unless this one was skipped.
    const restAfter = status !== "SKIPPED" && index < exercises.length - 1 ? exercise.instructions.restAfter ?? 0 : 0;
    if (restAfter > 0) startRest(restAfter);
    else clearRest();
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

  /** Starts a rest (from a tap, so the phone may beep): pips for its last 3 seconds, then a beep. */
  function startRest(seconds: number) {
    unlockSound();
    const ends = Date.now() + seconds * 1000;
    setRestEndsAt(ends); writeRest(session.id, ends);
    restBeepsCancel.current?.();
    restBeepsCancel.current = scheduleBeeps(restBeeps(ends, Date.now()));
  }

  function clearRest() {
    restBeepsCancel.current?.(); restBeepsCancel.current = null;
    setRestEndsAt(null); writeRest(session.id, null);
  }

  function changeSound(on: boolean) {
    setSound(on);
    // Turned back on during a rest: its end beeps again.
    if (on && restEndsAt && restEndsAt > Date.now()) {
      restBeepsCancel.current?.();
      restBeepsCancel.current = scheduleBeeps(restBeeps(restEndsAt, Date.now()));
    }
  }

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
  // A rest started on this exercise with no set logged yet is the rest between exercises.
  const betweenExercises = index > 0 && current.sets.length === 0 && !!exercises[index - 1]?.instructions.restAfter;
  const instr = current.instructions;
  const mob = instr.mobility;
  const m = mobilityDictionary(locale);
  const warned = !!mob && current.sets.some((s) => s.flags?.length);

  return <div className="space-y-5 pb-6">
    <section aria-label={t.player} className="sticky top-0 z-20 -mx-4 border-b border-line bg-bg/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 md:static md:mx-0 md:rounded-2xl md:border md:bg-surface md:px-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{pausedAt ? t.paused : t.elapsed}</p>
          <p className="text-3xl font-black tabular-nums tracking-tight" role="timer" aria-live="off">{formatClock(elapsed)}</p>
        </div>
        <div className="flex items-center gap-2">
          <SoundToggle locale={locale} on={sound} onChange={changeSound} />
          <button type="button" onClick={togglePause} aria-pressed={!!pausedAt}
            className={buttonClass("secondary", "md")}>
            {pausedAt ? "▶ " + t.resumeTimer : "❚❚ " + t.pause}
          </button>
        </div>
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
      {ego ? <AlterEgoLane locale={locale} name={ego.name} phases={egoPhases} exerciseNames={initial.map((e) => e.name)}
        elapsed={elapsed} youFraction={progress / 100} easeOff={ego.easeOff} /> : null}
    </section>

    {rest > 0 ? <section role="status" aria-live="polite" className="rounded-2xl border border-accent/30 bg-accent-soft p-5 text-center">
      <p className="text-sm font-bold uppercase tracking-[0.12em] text-accent">{betweenExercises ? c.restBetween : t.restTimer}</p>
      <p className="mt-1 text-5xl font-black tabular-nums text-accent">{formatClock(rest)}</p>
      {betweenExercises ? <p className="mt-1 text-sm font-semibold text-accent">{fmt(c.nextUp, { name: current.name })}</p> : null}
      <button type="button" onClick={clearRest} className="mt-3 min-h-12 rounded-full border border-accent/30 bg-surface px-5 text-sm font-bold text-accent">{t.skipRest}</button>
    </section> : null}

    <article className="leblond-premium-surface p-5 sm:p-6" aria-labelledby="current-exercise">
      <p className="leblond-eyebrow text-accent">{t.block[current.block]} · {t.exStatus[current.status]}</p>
      <h2 id="current-exercise" className="mt-2 text-2xl font-black tracking-tight">{current.name}</h2>
      {mob ? <MobilityIllustration exerciseId={mob.exerciseId} title={current.name} className="mt-3" /> : null}
      {targetLine ? <p className="mt-2 text-base font-bold text-ink">{targetLine}</p> : null}
      {current.intensity ? <p className="mt-1 text-sm text-ink-2"><span className="font-semibold">{t.intensity} :</span> {current.intensity}</p> : null}
      {instr.load ? <p className="mt-1 text-sm text-ink-2"><span className="font-semibold">{c.load} :</span> {instr.load}</p> : null}
      {instr.restAfter ? <p className="mt-1 text-sm text-ink-2">{fmt(c.restAfter, { d: formatClock(instr.restAfter) })}</p> : null}
      {instr.summary ? <p className="mt-3 text-sm leading-relaxed text-ink-2">{pick(instr.summary, locale)}</p> : null}
      {mob ? <p className="mt-2 text-sm text-ink-2"><span className="font-semibold">{m.whyDose} :</span> {m.reasons[mob.reason]}</p> : null}
      {mob ? <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
        <details className="rounded-xl border border-line bg-surface-2 px-3 open:pb-3">
          <summary className="cursor-pointer py-3 text-sm font-bold text-accent">{m.easier} · {pick(mob.easier.name, locale)}</summary>
          <p className="text-sm leading-relaxed text-ink-2">{pick(mob.easier.how, locale)}</p>
        </details>
        <details className="rounded-xl border border-line bg-surface-2 px-3 open:pb-3">
          <summary className="cursor-pointer py-3 text-sm font-bold text-accent">{m.harder} · {pick(mob.harder.name, locale)}</summary>
          <p className="text-sm leading-relaxed text-ink-2">{pick(mob.harder.how, locale)}</p>
        </details>
      </div> : null}
      {musclewikiUrl(instr.musclewiki) ? <a href={musclewikiUrl(instr.musclewiki)!} target="_blank" rel="noopener noreferrer"
        className="mr-4 mt-3 inline-block text-sm font-bold text-accent underline underline-offset-4">{c.musclewiki} ↗</a> : null}
      {instr.demo && demoUrl(instr.demo.url) ? <a href={demoUrl(instr.demo.url)!} target="_blank" rel="noopener noreferrer"
        className="mt-3 inline-block text-sm font-bold text-accent underline underline-offset-4">{fmt(c.demo, { site: instr.demo.label })} ↗</a> : null}
      {instr.steps?.length || instr.safety || instr.adaptation || current.methodId ? <details className="mt-3 rounded-xl border border-line bg-surface-2 px-3 open:pb-3">
        <summary className="cursor-pointer py-3 text-sm font-bold text-accent">{t.howTo}</summary>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm leading-relaxed text-ink-2">
          {(instr.steps ?? []).map((s, i) => <li key={i}>{pick(s, locale)}</li>)}
        </ol>
        {mob?.mistakes.length ? <>
          <p className="mt-3 text-sm font-bold text-ink">{m.mistakes}</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-relaxed text-ink-2">
            {mob.mistakes.map((x, i) => <li key={i}>{pick(x, locale)}</li>)}
          </ul>
        </> : null}
        {instr.safety ? <p className="mt-3 text-sm text-ink"><strong>{t.safety} :</strong> {pick(instr.safety, locale)}</p> : null}
        {instr.adaptation ? <p className="mt-2 text-sm text-ink-2"><strong>{t.adaptation} :</strong> {pick(instr.adaptation, locale)}</p> : null}
        {current.methodId ? <Link href={"/atlas/" + current.methodId} className="mt-3 inline-block text-sm font-bold text-accent underline underline-offset-4">{t.atlasSheet} ↗</Link> : null}
      </details> : null}

      {warned ? <div role="alert" className="mt-4 rounded-2xl border border-danger/40 bg-danger/10 p-4">
        <p className="text-sm font-black text-danger">{m.stopTitle}</p>
        <p className="mt-1 text-sm text-ink">{m.stopText}</p>
        <button type="button" onClick={() => settle(current.sets.some((s) => s.completed) ? "MODIFIED" : "SKIPPED")}
          className={buttonClass("secondary", "md", "mt-3")}>{m.skipRestOfExercise} →</button>
      </div> : null}

      <div className="mt-5 border-t border-line pt-5">
        <h3 className="text-sm font-extrabold">{t.set} {nextSetIndex}{current.targetSets ? ` / ${current.targetSets}` : ""}</h3>
        {/* Holds, hangs, stretches, repeaters, timed blocks: a timer that beeps. New for every set. */}
        <EffortTimer key={current.id + ":" + nextSetIndex} locale={locale} exercise={current} sound={sound} />
        {mob ? <MobilitySetLogger key={current.id} locale={locale} exercise={current} onLog={logSet} />
          : <SetLogger key={current.id} locale={locale} exercise={current} onLog={logSet} />}
        <h3 className="mt-5 text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{t.completedSets}</h3>
        {current.sets.length === 0 ? <p className="mt-2 text-sm text-ink-3">{t.noSets}</p> :
          <ul className="mt-2 space-y-2">
            {current.sets.map((s) => <li key={s.setIndex} className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-2.5 text-sm">
              <span className="font-bold tabular-nums">{t.set} {s.setIndex}
                <span className="ml-2 font-semibold text-ink-2">
                  {[s.reps !== null ? `${s.reps} ${current.modality === "ROUTES" ? "✓" : t.reps}` : null,
                    s.seconds !== null ? (isTime ? `${Math.round(s.seconds / 60)} ${t.minutesShort}` : `${s.seconds} ${t.seconds}`) : null,
                    s.loadKg !== null ? `${s.loadKg > 0 ? "+" : ""}${s.loadKg} kg` : null,
                    s.edgeMm ? `${s.edgeMm} mm` : null,
                    mob && s.side && s.side !== "BOTH" ? m.sides[s.side] : null,
                    mob && s.variant && s.variant !== "STANDARD" ? (s.variant === "EASIER" ? m.easier : m.harder) : null,
                    mob && s.controlled === false ? m.notQuite : null,
                    mob && s.discomfort ? `${m.discomfort.split(" (")[0]} ${s.discomfort}/10` : null,
                    ...(mob ? (s.flags ?? []).map((f) => "⚠ " + m.flagNames[f]) : [])].filter(Boolean).join(" · ")}
                </span>
              </span>
              <button type="button" onClick={() => removeSet(s.setIndex)} className="min-h-11 rounded-xl px-3 text-xs font-bold text-danger">{t.removeSet}</button>
            </li>)}
          </ul>}
      </div>
    </article>

    {notice ? <p role="status" className="text-center text-sm font-semibold text-ink-2">{notice}</p> : null}

    <div className="grid grid-cols-1 gap-3">
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
        <button type="button" onClick={() => setFinishing(true)} className={buttonClass("primary", "md")}>{t.finish}</button>
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
    <h2 id="finish-title" className="text-lg font-black">{t.finishTitle}</h2>
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
      <button type="submit" disabled={pending} className={buttonClass("primary", "md", "flex-1")}>
        {pending ? t.saving : t.confirmFinish}
      </button>
      <button type="button" onClick={onCancel} className="min-h-14 rounded-2xl border border-line px-5 text-sm font-bold">{t.previous}</button>
    </div>
  </form>;
}

/**
 * Hip-mobility set: reps, the side (alternating on one-sided exercises), the
 * version done, whether every rep was controlled (left unanswered = unknown),
 * discomfort 0–10 and warning signs. Remounted per exercise.
 */
function MobilitySetLogger({ locale, exercise, onLog }: {
  locale: Locale; exercise: TrainingExercise; onLog: (v: LoggedValues) => void;
}) {
  const t = trainingSessionDictionary(locale);
  const m = mobilityDictionary(locale);
  const mob = exercise.instructions.mobility!;
  const last = exercise.sets.at(-1);
  const nextSide = !mob.perSide ? "BOTH" : last?.side === "LEFT" ? "RIGHT" : "LEFT";
  const [side, setSide] = useState<"LEFT" | "RIGHT" | "BOTH">(nextSide);
  const [variant, setVariant] = useState<Variant>(last?.variant ?? mob.dose.variant);
  const [reps, setReps] = useState(String(exercise.targetReps ?? mob.dose.reps));
  const [controlled, setControlled] = useState<boolean | null>(null);
  const [discomfort, setDiscomfort] = useState(0);
  const [flags, setFlags] = useState<WarningFlag[]>([]);
  const chip = (on: boolean) => "min-h-11 rounded-full border px-4 text-sm font-bold " + (on ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink");
  function submit() {
    const n = Number(reps);
    onLog({
      reps: reps.trim() === "" || !Number.isFinite(n) ? null : Math.max(0, Math.min(500, Math.round(n))),
      seconds: null, loadKg: null, edgeMm: null,
      side, variant, controlled, discomfort, flags,
    });
    setSide(!mob.perSide ? "BOTH" : side === "LEFT" ? "RIGHT" : "LEFT");
    setControlled(null); setDiscomfort(0); setFlags([]);
  }
  return <div className="mt-2 space-y-4">
    {mob.perSide ? <fieldset>
      <legend className="text-sm font-semibold">{m.sideNow}</legend>
      <div className="mt-1 flex gap-2">
        {(["LEFT", "RIGHT"] as const).map((x) => <button key={x} type="button" aria-pressed={side === x} onClick={() => setSide(x)} className={chip(side === x)}>{m.sides[x]}</button>)}
      </div>
    </fieldset> : null}
    <label className="block text-sm font-semibold">{t.repsLabel}
      <input className={inputClass} inputMode="numeric" type="number" min={0} max={500} value={reps} onChange={(e) => setReps(e.target.value)} />
    </label>
    <fieldset>
      <legend className="text-sm font-semibold">{m.version}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {VARIANTS.map((v) => <button key={v} type="button" aria-pressed={variant === v} onClick={() => setVariant(v)} className={chip(variant === v)}>
          {pick(VARIANT_NAMES[v], locale)}</button>)}
      </div>
    </fieldset>
    <fieldset>
      <legend className="text-sm font-semibold">{m.controlled}</legend>
      <div className="mt-1 flex gap-2">
        <button type="button" aria-pressed={controlled === true} onClick={() => setControlled(controlled === true ? null : true)} className={chip(controlled === true)}>{m.yes}</button>
        <button type="button" aria-pressed={controlled === false} onClick={() => setControlled(controlled === false ? null : false)} className={chip(controlled === false)}>{m.notQuite}</button>
      </div>
    </fieldset>
    <label className="block text-sm font-semibold">{m.discomfortSet}
      <input type="range" min={0} max={10} value={discomfort} onChange={(e) => setDiscomfort(Number(e.target.value))} className="mt-2 w-full accent-accent" />
      <span className="text-sm font-bold tabular-nums">{discomfort} / 10</span>
    </label>
    <fieldset>
      <legend className="text-sm font-semibold">{m.warning}</legend>
      <div className="mt-1 flex flex-wrap gap-2">
        {WARNING_FLAGS.map((f) => <button key={f} type="button" aria-pressed={flags.includes(f)}
          onClick={() => setFlags((list) => list.includes(f) ? list.filter((x) => x !== f) : [...list, f])}
          className={"min-h-11 rounded-full border px-4 text-sm font-bold " + (flags.includes(f) ? "border-danger bg-danger text-surface" : "border-line bg-surface text-ink")}>
          {m.flagNames[f]}</button>)}
      </div>
    </fieldset>
    <button type="button" onClick={submit} className={buttonClass("primary", "md", "w-full text-lg active:scale-[0.99]")}>
      ✓ {t.logSet}{mob.perSide ? " · " + m.sides[side] : ""}
    </button>
  </div>;
}

/** Inputs for the next set, pre-filled with the exercise targets. Remounted per exercise. */
function SetLogger({ locale, exercise, onLog }: {
  locale: Locale; exercise: TrainingExercise; onLog: (v: Pick<TrainingSet, "reps" | "seconds" | "loadKg" | "edgeMm">) => void;
}) {
  const t = trainingSessionDictionary(locale);
  const isTime = exercise.modality === "TIME" || exercise.modality === "FREE";
  const [reps, setReps] = useState(exercise.targetReps ? String(exercise.targetReps) : "");
  const [seconds, setSeconds] = useState(exercise.targetSeconds
    ? String(isTime ? Math.round(exercise.targetSeconds / 60) : exercise.targetSeconds) : "");
  const [load, setLoad] = useState(exercise.sets.at(-1)?.loadKg?.toString() ?? "");
  // Edge size: asked for hangs planned on an edge; the last set's edge wins over the plan.
  const plannedEdge = exercise.instructions.edgeMm;
  const [edge, setEdge] = useState(String(exercise.sets.at(-1)?.edgeMm ?? plannedEdge ?? ""));
  const num = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v)) ? null : Number(v));
  function submit() {
    const r = num(reps), sec = num(seconds), kg = num(load), mm = num(edge);
    onLog({
      reps: r === null ? null : Math.max(0, Math.round(r)),
      seconds: sec === null ? null : Math.max(0, Math.round(sec * (isTime ? 60 : 1))),
      loadKg: kg === null ? null : Math.round(kg * 2) / 2,
      edgeMm: plannedEdge && mm !== null ? Math.min(60, Math.max(3, Math.round(mm))) : null,
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
      {plannedEdge ? (
        <div className="col-span-2 text-sm font-semibold">
          <label htmlFor={"edge-" + exercise.id}>{t.edge}</label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            {[20, 15, 12, 10].map((mm) => <button key={mm} type="button" aria-pressed={edge === String(mm)} onClick={() => setEdge(String(mm))}
              className={"min-h-11 rounded-full border px-4 text-sm font-bold " + (edge === String(mm) ? "border-accent bg-accent text-surface" : "border-line bg-surface text-ink")}>
              {mm} mm</button>)}
            <input id={"edge-" + exercise.id} className={inputClass + " w-24"} inputMode="numeric" type="number" min={3} max={60} value={edge} onChange={(e) => setEdge(e.target.value)} />
          </div>
        </div>
      ) : null}
    </div>
    <button type="button" onClick={submit}
      className={buttonClass("primary", "md", "mt-4 w-full text-lg active:scale-[0.99]")}>
      ✓ {t.logSet}
    </button>
  </>;
}
