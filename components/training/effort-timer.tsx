"use client";

import { Bell, BellOff } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { fmt, type Locale } from "@/lib/i18n";
import { trainingSessionDictionary } from "@/lib/i18n/training-session";
import { scheduleBeeps, setSoundEnabled, soundEnabled, unlockSound } from "@/lib/training/beeper";
import type { TrainingExercise } from "@/lib/training/sessions";
import { spokenDuration, timerBeeps, timerPlan, timerState } from "@/lib/training/timer";

/** Keeps the screen on while `active` (where the browser allows it), so the phone can lie on the floor. */
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || typeof navigator === "undefined" || !("wakeLock" in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let stopped = false;
    const request = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const next = await navigator.wakeLock.request("screen");
        if (stopped) void next.release().catch(() => undefined);
        else sentinel = next;
      } catch {
        /* refused (battery saver, not allowed): the timer still beeps */
      }
    };
    void request();
    // The lock is lost when the page is hidden; take it again on return.
    const onVisible = () => { if (!stopped) void request(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      document.removeEventListener("visibilitychange", onVisible);
      void sentinel?.release().catch(() => undefined);
    };
  }, [active]);
}

/** The beeps on/off switch, remembered on this phone. */
export function useSoundSetting(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setOn(soundEnabled()), 0);
    return () => window.clearTimeout(t);
  }, []);
  return [on, (next: boolean) => { setSoundEnabled(next); setOn(next); }];
}

export function SoundToggle({ locale, on, onChange }: { locale: Locale; on: boolean; onChange: (on: boolean) => void }) {
  const t = trainingSessionDictionary(locale);
  const Icon = on ? Bell : BellOff;
  return (
    <button type="button" aria-pressed={on} onClick={() => { if (!on) unlockSound(); onChange(!on); }}
      aria-label={on ? t.soundOn : t.soundOff} title={on ? t.soundOn : t.soundOff}
      className="inline-flex min-h-12 min-w-12 items-center justify-center rounded-full border border-line bg-surface text-ink-2">
      <Icon aria-hidden="true" className="h-5 w-5" />
    </button>
  );
}

/** iPhones mute web sounds with the silent switch: say so, on iPhones only. */
function useIsIos() {
  const [ios, setIos] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setIos(/iPhone|iPad|iPod/.test(navigator.userAgent)
      || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)), 0);
    return () => window.clearTimeout(t);
  }, []);
  return ios;
}

/**
 * The timer of a timed set — a hold, a hang, a stretch, repeaters or a timed
 * block: "3, 2, 1, go", the effort, then a beep at the end. Remounted for every
 * set, which also cancels beeps still to come.
 */
export function EffortTimer({ locale, exercise, sound }: { locale: Locale; exercise: TrainingExercise; sound: boolean }) {
  const t = trainingSessionDictionary(locale);
  const plan = useMemo(
    () => timerPlan({ modality: exercise.modality, targetSeconds: exercise.targetSeconds, targetReps: exercise.targetReps }),
    [exercise.modality, exercise.targetSeconds, exercise.targetReps],
  );
  const [startAt, setStartAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const cancel = useRef<(() => void) | null>(null);
  const ios = useIsIos();

  const state = plan && startAt !== null ? timerState(plan, startAt, now) : null;
  const running = !!state && !state.done;
  useWakeLock(running);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(id);
  }, [running]);
  // Leaving the set (logged, another exercise) silences what is left.
  useEffect(() => () => cancel.current?.(), []);

  if (!plan) return null;

  function start() {
    if (!plan) return;
    unlockSound();
    cancel.current?.();
    const at = Date.now();
    cancel.current = scheduleBeeps(timerBeeps(plan, at));
    setStartAt(at);
    setNow(at);
  }
  function stop() {
    cancel.current?.();
    cancel.current = null;
    setStartAt(null);
  }

  const what = plan.modality === "INTERVALS"
    ? fmt(t.timerIntervals, { reps: plan.reps, on: plan.workSeconds, off: plan.recoverSeconds })
    : spokenDuration(plan.workSeconds);

  let label = "";
  if (state && !state.done) {
    const p = state.phase;
    label = p.kind === "ready" ? t.timerReady
      : p.kind === "recover" ? fmt(t.timerRecover, { n: p.rep, total: plan.reps })
        : plan.modality === "INTERVALS" ? fmt(t.timerWork, { n: p.rep, total: plan.reps })
          : plan.modality === "TIME" ? t.timerGo : t.timerHold;
  }
  const big = state && !state.done
    ? (state.remaining >= 60 ? `${Math.floor(state.remaining / 60)}:${String(state.remaining % 60).padStart(2, "0")}` : String(state.remaining))
    : null;

  return (
    <section aria-label={t.timerLabel} className="mt-4 rounded-2xl border border-line bg-surface-2 p-4">
      {big !== null ? (
        <div className="text-center">
          <p className="text-sm font-bold uppercase tracking-[0.12em] text-accent" aria-live="polite">{label}</p>
          <p className="mt-1 text-6xl font-black tabular-nums text-ink">{big}</p>
          <button type="button" onClick={stop} className="mt-3 min-h-12 rounded-full border border-line bg-surface px-5 text-sm font-bold text-ink-2">
            ■ {t.timerStop}
          </button>
        </div>
      ) : state?.done ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-base font-black text-accent" role="status">✓ {t.timerDone}</p>
          <button type="button" onClick={start} className="min-h-12 rounded-full border border-line bg-surface px-5 text-sm font-bold">↻ {t.timerAgain}</button>
        </div>
      ) : (
        <>
          <button type="button" onClick={start}
            className="min-h-14 w-full rounded-2xl bg-accent px-5 text-lg font-black text-accent-ink active:scale-[0.99]">
            ▶ {fmt(t.timerStart, { what })}
          </button>
          <p className="mt-2 text-xs text-ink-2">{sound ? t.timerHint : t.timerSilent}</p>
          {sound && ios ? <p className="mt-1 text-xs text-ink-3">{t.iosSilent}</p> : null}
        </>
      )}
    </section>
  );
}
