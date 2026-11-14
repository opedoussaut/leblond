import { FRENCH_ROUTE_GRADES } from "@/lib/grading/route-grades";
import { gradeToScore, scoreToGrade } from "@/lib/grading/ordering";
import { templateFor, type ExerciseTemplate } from "@/lib/training/session-templates";
import { dateForPlanDay, mondayOf, type TrainingStatus } from "@/lib/training/sessions";
import type { PlanSession } from "@/lib/training/plans";

/**
 * The alter ego: a fictional training partner who follows the plan the climber
 * signed, exactly as written, every scheduled day. It is a scenario to race
 * against, never a forecast. Everything here is derived from the pact and the
 * date, so nothing runs in the background and nothing is stored.
 */

export const PACT_STATUSES = ["ACTIVE", "PAUSED", "FINISHED", "ABANDONED"] as const;
export type PactStatus = (typeof PACT_STATUSES)[number];

export type Progression = {
  version: number; weeklyGain: number; maxGain: number; deloadEvery: number; deloadFactor: number;
};

/** Editorial assumption, stored in each pact so later changes never rewrite a signed one. */
export const PROGRESSION_V1: Progression = { version: 1, weeklyGain: 0.025, maxGain: 0.5, deloadEvery: 4, deloadFactor: 0.85 };

export type Pact = {
  id: string; displayName: string; planName: string; plan: PlanSession[]; progression: Progression;
  startDate: string; horizonWeeks: number; status: PactStatus;
  pausedSince: string | null; pausedDays: number;
  startBoulderGrade: string | null; targetBoulderGrade: string | null;
  startRouteGrade: string | null; targetRouteGrade: string | null;
};

const DAY_MS = 86_400_000;
const dayNumber = (date: string) => Date.parse(date + "T00:00:00Z") / DAY_MS;
const addDays = (date: string, days: number) => new Date((dayNumber(date) + days) * DAY_MS).toISOString().slice(0, 10);

/** The climber's date with paused time taken out; it stands still during a pause. */
export function pactClock(pact: Pick<Pact, "pausedSince" | "pausedDays">, today: string): string {
  return addDays(pact.pausedSince ?? today, -pact.pausedDays);
}

/** Whole days a pause lasted, added to `pausedDays` when the pact resumes. */
export function pauseLength(pausedSince: string, today: string): number {
  return Math.max(0, dayNumber(today) - dayNumber(pausedSince));
}

/** Zero-based plan week of a pact-clock date. */
export function pactWeek(pact: Pick<Pact, "startDate" | "horizonWeeks">, clock: string): number {
  const days = dayNumber(clock) - dayNumber(mondayOf(pact.startDate));
  return Math.max(0, Math.min(pact.horizonWeeks - 1, Math.floor(days / 7)));
}

export function pactIsOver(pact: Pick<Pact, "startDate" | "horizonWeeks">, clock: string): boolean {
  return dayNumber(clock) >= dayNumber(mondayOf(pact.startDate)) + pact.horizonWeeks * 7;
}

/** How much the ego adds to scalable targets in a given week; every fourth week backs off. */
export function loadFactor(week: number, p: Progression = PROGRESSION_V1): number {
  const gain = 1 + Math.min(p.maxGain, p.weeklyGain * Math.max(0, week));
  const deload = (week + 1) % p.deloadEvery === 0;
  return deload ? Math.max(1, gain * p.deloadFactor) : gain;
}

/** Never scaled: finger loading and maximal work, whatever the week. */
const FIXED_METHODS = new Set(["max-hangs", "repeaters", "campus", "limit-bouldering"]);

export type WorkTarget = Pick<ExerciseTemplate,
  "block" | "methodId" | "modality" | "targetSets" | "targetReps" | "targetSeconds" | "restSeconds">;

export function isScalable(e: Pick<WorkTarget, "block" | "methodId" | "modality">): boolean {
  if (e.block !== "MAIN") return false;
  if (e.methodId && FIXED_METHODS.has(e.methodId)) return false;
  return e.modality === "REPS" || e.modality === "HOLD" || e.modality === "TIME" || e.modality === "ROUTES";
}

/** The ego's version of an exercise for a given load. Rest is never shortened. */
export function scaleTarget<T extends WorkTarget>(e: T, factor: number): T {
  if (!isScalable(e)) return e;
  return {
    ...e,
    targetReps: e.targetReps === null ? null : Math.round(e.targetReps * factor),
    targetSeconds: e.targetSeconds === null ? null : Math.round(e.targetSeconds * factor),
  };
}

const SECONDS_PER_REP = 3, SECONDS_PER_ROUTE = 45, INTERVAL_RECOVERY = 3, BETWEEN_EXERCISES = 60;

function setSeconds(e: WorkTarget): number {
  const reps = e.targetReps ?? 0, seconds = e.targetSeconds ?? 0;
  switch (e.modality) {
    case "REPS": return reps * SECONDS_PER_REP;
    case "ROUTES": return reps * SECONDS_PER_ROUTE;
    case "INTERVALS": return Math.max(0, reps * (seconds + INTERVAL_RECOVERY) - INTERVAL_RECOVERY);
    default: return seconds;
  }
}

export type Phase = {
  kind: "WORK" | "REST"; exercise: number; set: number; sets: number;
  start: number; seconds: number; reps: number | null;
};

/** The ego's session laid out second by second. */
export function egoTimeline(exercises: WorkTarget[], factor: number): Phase[] {
  const phases: Phase[] = [];
  let clock = 0;
  const push = (phase: Omit<Phase, "start">) => { phases.push({ ...phase, start: clock }); clock += phase.seconds; };
  exercises.forEach((raw, exercise) => {
    const e = scaleTarget(raw, factor);
    const sets = e.targetSets ?? 1;
    for (let set = 1; set <= sets; set++) {
      const seconds = setSeconds(e);
      const counted = e.modality === "REPS" || e.modality === "ROUTES" || e.modality === "INTERVALS";
      if (seconds > 0) push({ kind: "WORK", exercise, set, sets, seconds, reps: counted ? e.targetReps : null });
      if (set < sets && e.restSeconds) push({ kind: "REST", exercise, set, sets, seconds: e.restSeconds, reps: null });
    }
    if (exercise < exercises.length - 1) push({ kind: "REST", exercise, set: sets, sets, seconds: BETWEEN_EXERCISES, reps: null });
  });
  return phases;
}

export const timelineSeconds = (phases: Phase[]) => {
  const last = phases[phases.length - 1];
  return last ? last.start + last.seconds : 0;
};

export type EgoPosition = {
  done: boolean; phase: Phase | null; remaining: number; repsDone: number | null; fraction: number;
};

/** Where the ego is after `elapsed` seconds of the shared session. */
export function positionAt(phases: Phase[], elapsed: number): EgoPosition {
  const total = timelineSeconds(phases);
  const phase = phases.find((p) => elapsed < p.start + p.seconds) ?? null;
  if (!phase) return { done: true, phase: null, remaining: 0, repsDone: null, fraction: 1 };
  const into = Math.max(0, elapsed - phase.start);
  const repsDone = phase.reps === null ? null : Math.min(phase.reps, Math.floor((into / phase.seconds) * phase.reps));
  return { done: false, phase, remaining: Math.ceil(phase.seconds - into), repsDone, fraction: total ? Math.max(0, elapsed) / total : 0 };
}

export type EgoSession = { date: string; week: number; session: PlanSession };

/** Every session of the signed plan, in order. Days before the start date are not owed. */
export function egoSchedule(pact: Pick<Pact, "plan" | "startDate" | "horizonWeeks">): EgoSession[] {
  const firstMonday = mondayOf(pact.startDate);
  const out: EgoSession[] = [];
  for (let week = 0; week < pact.horizonWeeks; week++) {
    const monday = addDays(firstMonday, week * 7);
    for (const session of pact.plan) {
      const date = dateForPlanDay(monday, session.day);
      if (date >= pact.startDate) out.push({ date, week, session });
    }
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

export type Ledger = { sessions: number; reps: number; minutes: number };

const countsReps = (e: Pick<WorkTarget, "modality">) => e.modality === "REPS" || e.modality === "ROUTES" || e.modality === "INTERVALS";

/** The work one scheduled ego session adds to the ledger. */
export function egoSessionLedger(s: EgoSession, progression: Progression): Ledger {
  const factor = loadFactor(s.week, progression);
  const exercises = templateFor(s.session.methodId, s.session.minutes);
  const phases = egoTimeline(exercises, factor);
  const reps = exercises.map((e) => scaleTarget(e, factor))
    .reduce((n, e) => n + (countsReps(e) ? (e.targetSets ?? 1) * (e.targetReps ?? 0) : 0), 0);
  return { sessions: 1, reps, minutes: Math.round(timelineSeconds(phases) / 60) };
}

const emptyLedger = (): Ledger => ({ sessions: 0, reps: 0, minutes: 0 });
const add = (a: Ledger, b: Ledger): Ledger => ({ sessions: a.sessions + b.sessions, reps: a.reps + b.reps, minutes: a.minutes + b.minutes });

export type ClimberWork = {
  status: TrainingStatus; date: string; actualMinutes: number | null; pain: number | null; reps: number;
  /** The séance's exercises, which the ego raced alongside in the player. */
  targets?: WorkTarget[];
};

export type EgoDay = { date: string; week: number; ledger: Ledger };

/** The ego's version of a séance it raced alongside the climber: the same exercises at its week's load. */
export function racedLedger(targets: WorkTarget[], factor: number): Ledger {
  const reps = targets.map((e) => scaleTarget(e, factor))
    .reduce((n, e) => n + (countsReps(e) ? (e.targetSets ?? 1) * (e.targetReps ?? 0) : 0), 0);
  return { sessions: 1, reps, minutes: Math.round(timelineSeconds(egoTimeline(targets, factor)) / 60) };
}

/**
 * What the ego has done, day by day. A day the climber completed séances, the
 * ego raced each of them alongside (the lane in the player), so it counts
 * them as soon as they are recorded, at its week's load. A plan day without a
 * séance from the climber, it did the plan's séance alone, counted once the
 * day is over. `clock` is the pact clock; climber dates are real dates.
 */
export function egoDays(
  pact: Pick<Pact, "plan" | "progression" | "startDate" | "horizonWeeks" | "pausedDays">,
  clock: string, work: ClimberWork[] = [],
): EgoDay[] {
  const today = addDays(clock, pact.pausedDays ?? 0);
  const plan = new Map(egoSchedule(pact).map((s) => [addDays(s.date, pact.pausedDays ?? 0), s] as const));
  const raced = new Map<string, ClimberWork[]>();
  for (const w of work) {
    if (w.status !== "COMPLETED" || w.date < pact.startDate || w.date > today) continue;
    raced.set(w.date, [...(raced.get(w.date) ?? []), w]);
  }
  const out: EgoDay[] = [];
  for (const [date, sessions] of raced) {
    const week = pactWeek(pact, addDays(date, -(pact.pausedDays ?? 0)));
    const factor = loadFactor(week, pact.progression);
    for (const w of sessions) {
      if (w.targets?.length) out.push({ date, week, ledger: racedLedger(w.targets, factor) });
    }
    // Séances without exercises (nothing to race): the plan's séance of that day, if any, stands in.
    const planned = plan.get(date);
    if (!sessions.some((w) => w.targets?.length) && planned && planned.date < clock) {
      out.push({ date, week: planned.week, ledger: egoSessionLedger(planned, pact.progression) });
    }
  }
  for (const [date, s] of plan) {
    if (s.date < clock && !raced.has(date)) out.push({ date, week: s.week, ledger: egoSessionLedger(s, pact.progression) });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** What the ego has done by a pact-clock date (see egoDays). Without the climber's work, only the plan counts. */
export function egoLedger(
  pact: Pick<Pact, "plan" | "progression" | "startDate" | "horizonWeeks"> & { pausedDays?: number },
  clock: string, work: ClimberWork[] = [],
): Ledger {
  return egoDays({ ...pact, pausedDays: pact.pausedDays ?? 0 }, clock, work).map((d) => d.ledger).reduce(add, emptyLedger());
}

/** The climber's completed training since signing. Only recorded work counts. */
export function climberLedger(work: ClimberWork[], startDate: string): Ledger {
  return work.filter((w) => w.status === "COMPLETED" && w.date >= startDate)
    .map((w) => ({ sessions: 1, reps: w.reps, minutes: w.actualMinutes ?? 0 })).reduce(add, emptyLedger());
}

export type Standing = { you: Ledger; ego: Ledger; gap: Ledger; state: "ahead" | "level" | "behind" };

/** The score. It shows the gap and stops there: it never prescribes extra work to close it. */
export function standing(you: Ledger, ego: Ledger): Standing {
  const gap = { sessions: you.sessions - ego.sessions, reps: you.reps - ego.reps, minutes: you.minutes - ego.minutes };
  const lead = gap.sessions || gap.reps;
  return { you, ego, gap, state: lead > 0 ? "ahead" : lead < 0 ? "behind" : "level" };
}

/** A reported pain of 3 or more switches the race framing off until a later session clears it. */
export const PAIN_STOP = 3;
export function shouldEaseOff(work: ClimberWork[]): boolean {
  const latest = work.filter((w) => w.status === "COMPLETED" && w.pain !== null)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  return (latest?.pain ?? 0) >= PAIN_STOP;
}

/** Linear position between two ordered grades. A pace the climber chose, not a prediction. */
function paceIndex(from: number, to: number, week: number, horizon: number): number {
  return Math.round(from + (to - from) * Math.min(1, Math.max(0, week) / horizon));
}

export function boulderPace(pact: Pick<Pact, "startBoulderGrade" | "targetBoulderGrade" | "horizonWeeks">, week: number): string | null {
  if (!pact.startBoulderGrade || !pact.targetBoulderGrade) return null;
  const from = gradeToScore("FONT", pact.startBoulderGrade), to = gradeToScore("FONT", pact.targetBoulderGrade);
  if (from === null || to === null || to < from) return null;
  return scoreToGrade("FONT", paceIndex(from, to, week, pact.horizonWeeks));
}

export function routePace(pact: Pick<Pact, "startRouteGrade" | "targetRouteGrade" | "horizonWeeks">, week: number): string | null {
  if (!pact.startRouteGrade || !pact.targetRouteGrade) return null;
  const grades: readonly string[] = FRENCH_ROUTE_GRADES;
  const from = grades.indexOf(pact.startRouteGrade), to = grades.indexOf(pact.targetRouteGrade);
  if (from < 0 || to < from) return null;
  return grades[paceIndex(from, to, week, pact.horizonWeeks)] ?? null;
}

export type PactProgress = {
  week: number; over: boolean; standing: Standing; easeOff: boolean;
  next: (Omit<EgoSession, "date"> & { date: string }) | null;
  boulderPace: string | null; routePace: string | null;
};

/** Everything the screens show about a pact on a given day. */
export function pactProgress(pact: Pact, work: ClimberWork[], today: string): PactProgress {
  const clock = pactClock(pact, today);
  const week = pactWeek(pact, clock);
  const next = egoSchedule(pact).find((s) => s.date >= clock);
  return {
    week, over: pactIsOver(pact, clock),
    standing: standing(climberLedger(work, pact.startDate), egoLedger(pact, clock, work)),
    easeOff: shouldEaseOff(work),
    next: next ? { ...next, date: addDays(next.date, pact.pausedDays) } : null,
    boulderPace: boulderPace(pact, week), routePace: routePace(pact, week),
  };
}

export type PactAction = "pause" | "resume" | "finish" | "abandon";
export type PactUpdate = { status: PactStatus; paused_since: string | null; paused_days: number };

/** The only changes a signed pact allows, or null when the action does not apply. */
export function pactTransition(pact: Pick<Pact, "status" | "pausedSince" | "pausedDays" | "startDate" | "horizonWeeks">, action: PactAction, today: string): PactUpdate | null {
  const open = pact.status === "ACTIVE" || pact.status === "PAUSED";
  const closed = (status: PactStatus): PactUpdate => ({
    status, paused_since: null,
    paused_days: pact.pausedDays + (pact.pausedSince ? pauseLength(pact.pausedSince, today) : 0),
  });
  if (action === "pause") return pact.status === "ACTIVE" ? { status: "PAUSED", paused_since: today, paused_days: pact.pausedDays } : null;
  if (action === "resume") return pact.status === "PAUSED" ? closed("ACTIVE") : null;
  if (action === "abandon") return open ? closed("ABANDONED") : null;
  return open && pactIsOver(pact, pactClock(pact, today)) ? closed("FINISHED") : null;
}

/** Bounded, computed facts for Patrick. He receives the gap and never works it out himself. */
export function coachSummary(pact: Pact, today: string, s: Standing, easeOff: boolean) {
  const clock = pactClock(pact, today);
  return {
    name: pact.displayName, status: pact.status, week: pactWeek(pact, clock) + 1, horizonWeeks: pact.horizonWeeks,
    sessionsGap: s.gap.sessions, repsGap: s.gap.reps, minutesGap: s.gap.minutes, state: s.state, easeOff,
  };
}
