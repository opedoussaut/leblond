import type { Modality } from "./session-templates";

/*
 * Exercise and rest timers that beep, so the climber can keep their eyes off
 * the phone while hanging, holding or stretching. Pure: times are milliseconds
 * since the epoch; the sounds themselves are in ./beeper.
 */

/** "3, 2, 1, go" before the effort. */
export const COUNT_IN_SECONDS = 3;
/** Recovery between interval reps (7:3 repeaters), as in the session estimates. */
export const INTERVAL_RECOVERY_SECONDS = 3;
/** Short pips announce the end of phases at least this long (not of 7 s repeaters). */
const PIPS_FROM_SECONDS = 10;
const MAX_SECONDS = 2 * 3600;

export type PhaseKind = "ready" | "work" | "recover";
/** `rep` is 1-based for work and recovery, 0 for the count-in. */
export type Phase = { kind: PhaseKind; seconds: number; rep: number };
export type TimerPlan = { modality: Modality; reps: number; workSeconds: number; recoverSeconds: number; phases: Phase[] };

/** pip: a short tick before a change · go: start · stop: let go (interval recovery) · end: finished. */
export type Tone = "pip" | "go" | "stop" | "end";
export type Beep = { at: number; tone: Tone };

/** The timer a timed exercise gets (holds, timed blocks, intervals), or null (reps, routes, free). */
export function timerPlan(e: { modality: Modality; targetSeconds: number | null; targetReps: number | null }): TimerPlan | null {
  const work = Math.min(MAX_SECONDS, Math.round(e.targetSeconds ?? 0));
  if (work <= 0) return null;
  if (e.modality === "HOLD" || e.modality === "TIME") return build(e.modality, 1, work, 0);
  if (e.modality === "INTERVALS") return build(e.modality, Math.min(100, Math.max(1, e.targetReps ?? 1)), work, INTERVAL_RECOVERY_SECONDS);
  return null;
}

function build(modality: Modality, reps: number, workSeconds: number, recoverSeconds: number): TimerPlan {
  const phases: Phase[] = [{ kind: "ready", seconds: COUNT_IN_SECONDS, rep: 0 }];
  for (let rep = 1; rep <= reps; rep++) {
    phases.push({ kind: "work", seconds: workSeconds, rep });
    if (rep < reps && recoverSeconds > 0) phases.push({ kind: "recover", seconds: recoverSeconds, rep });
  }
  return { modality, reps, workSeconds, recoverSeconds, phases };
}

export function totalSeconds(plan: TimerPlan): number {
  return plan.phases.reduce((n, p) => n + p.seconds, 0);
}

/**
 * Every beep of a timer started at `startAt`: pips counting in, "go" at each
 * effort, "stop" at each recovery, pips before the end of long phases, and
 * "end" when it is over.
 */
export function timerBeeps(plan: TimerPlan, startAt: number): Beep[] {
  const beeps: Beep[] = [];
  let t = startAt;
  plan.phases.forEach((p, i) => {
    if (p.kind === "ready") {
      for (let s = 0; s < p.seconds; s++) beeps.push({ at: t + s * 1000, tone: "pip" });
    } else {
      // The tone that opens this phase (the one closing the count-in is this phase's "go").
      beeps.push({ at: t, tone: p.kind === "work" ? "go" : "stop" });
      if (p.seconds >= PIPS_FROM_SECONDS) {
        for (let s = 3; s >= 1; s--) beeps.push({ at: t + (p.seconds - s) * 1000, tone: "pip" });
      }
    }
    t += p.seconds * 1000;
    if (i === plan.phases.length - 1) beeps.push({ at: t, tone: "end" });
  });
  return beeps;
}

export type TimerState =
  | { done: false; index: number; phase: Phase; remaining: number }
  | { done: true };

/** Where a timer started at `startAt` stands at `now`; `remaining` is whole seconds, rounded up. */
export function timerState(plan: TimerPlan, startAt: number, now: number): TimerState {
  let elapsed = Math.max(0, now - startAt);
  for (let index = 0; index < plan.phases.length; index++) {
    const phase = plan.phases[index];
    const length = phase.seconds * 1000;
    if (elapsed < length) return { done: false, index, phase, remaining: Math.ceil((length - elapsed) / 1000) };
    elapsed -= length;
  }
  return { done: true };
}

/** The end of a rest: pips for its last 3 seconds, then "go". Only beeps still to come. */
export function restBeeps(endsAt: number, now: number): Beep[] {
  return [
    { at: endsAt - 3000, tone: "pip" as const },
    { at: endsAt - 2000, tone: "pip" as const },
    { at: endsAt - 1000, tone: "pip" as const },
    { at: endsAt, tone: "go" as const },
  ].filter((b) => b.at > now);
}

/** A duration as people say it: "40 s", "20 min", "1:30". */
export function spokenDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  if (seconds % 60 === 0) return `${seconds / 60} min`;
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
