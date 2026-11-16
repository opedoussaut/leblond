import { FONT_SCALE, isReliable, resolveNormalized } from "@/lib/grading";
import { FRENCH_ROUTE_GRADES } from "@/lib/grading/route-grades";
import { gradeToScore } from "@/lib/grading/ordering";
import { utcToZoned } from "@/lib/time";
import { calculateWorkingGrade } from "./working-grade";
import { routeWorkingGrade, type RouteAscentFact } from "./routes";
import type { AttemptFact, ProblemFact } from "./types";
import { egoSchedule, loadFactor, type ClimberWork, type Pact, type WorkKind } from "./alter-ego";

/**
 * The twin: the rival as the climber themself, starting at the climber's
 * measured level on the day the pact began and following the signed plan to
 * the letter. Both the twin and the climber run through the same model; the
 * twin gets the plan exactly as written, the climber gets what they really
 * recorded. So the gap between them only comes from what the climber did
 * differently.
 *
 * The model, in three parts:
 * - Training load: every séance adds minutes × intensity (by method or kind).
 * - Fitness and fatigue (Banister's impulse-response model, as used for
 *   training-stress balance): a slow average of load (42 days) and a fast one
 *   (7 days). Their difference is the day's form: tired after a heavy week,
 *   fresh after an easy one. Form only colours a day; it never adds grades.
 * - Adaptation: each day adds a small grade gain that depends on the last
 *   seven days' load (with diminishing returns), shrinks when that load jumps
 *   well above the previous four weeks (acute:chronic ratio), and slows as the
 *   grade gets harder.
 *
 * The rates are editorial assumptions, stored with a version, not measured
 * physiology. The climber's own progress tunes them (`calibration`): when the
 * climber's observed working grade has moved faster or slower than the model
 * expected for the work they recorded, the twin gets the same correction.
 * It is a scenario to race against, never a prediction.
 */

export type TwinModel = {
  version: number;
  /** Days of the slow (fitness) and fast (fatigue) load averages. */
  fitnessDays: number; fatigueDays: number;
  /** A solid week: about three 60-minute séances of hard climbing (minutes × intensity). */
  referenceWeeklyLoad: number;
  /** Font sub-grades gained per week at the reference load, at 6A. */
  baseRate: number;
  /** Each sub-grade above 6A makes progress this much slower (and each below, faster). */
  slowdown: number;
  /** A week above this multiple of the previous four weeks' average counts as overreaching… */
  overreachRatio: number;
  /** …and adapts this much less. */
  overreachFactor: number;
  /** Bounds of the correction learnt from the climber's progress, and how many weeks the prior weighs. */
  minCalibration: number; maxCalibration: number; priorWeeks: number;
};

export const TWIN_MODEL_V1: TwinModel = {
  version: 1, fitnessDays: 42, fatigueDays: 7, referenceWeeklyLoad: 150,
  // 6A → 7A at the reference load takes about two years: 10, 12, 16, 20, 24 and 30 weeks per sub-grade.
  baseRate: 0.1, slowdown: 1.25, overreachRatio: 1.5, overreachFactor: 0.6,
  minCalibration: 0.5, maxCalibration: 2, priorWeeks: 8,
};

/** Load per minute by Atlas method: finger and limit work count most, mobility least. */
const METHOD_INTENSITY: Record<string, number> = {
  "limit-bouldering": 1, "max-hangs": 1, campus: 1, repeaters: 0.9, "four-by-four": 0.9, hangboard: 0.9,
  "training-board": 0.9, periodized: 0.8, lattice: 0.8, "power-company": 0.8, crimpd: 0.8, hoopers: 0.8,
  "strength-conditioning": 0.7, technique: 0.6, constraints: 0.6, "easy-volume": 0.5,
  mental: 0.3, mobility: 0.15, "hip-mobility": 0.15,
};
const KIND_INTENSITY: Record<Exclude<WorkKind, "TRAINING">, number> = { BOARD: 0.9, BOULDER: 0.8, ROUTE: 0.7 };
const DEFAULT_INTENSITY = 0.6;
const DEFAULT_MINUTES = 60;

export function methodIntensity(methodId: string | null | undefined): number {
  return (methodId ? METHOD_INTENSITY[methodId] : undefined) ?? DEFAULT_INTENSITY;
}

/** Load of one piece of the climber's recorded work. */
export function workLoad(w: ClimberWork): number {
  const minutes = w.actualMinutes && w.actualMinutes > 0 ? Math.min(w.actualMinutes, 300) : DEFAULT_MINUTES;
  const kind = w.kind ?? "TRAINING";
  if (kind !== "TRAINING") return minutes * KIND_INTENSITY[kind];
  const methods = (w.targets ?? []).filter((t) => t.block === "MAIN").map((t) => methodIntensity(t.methodId));
  const intensity = methods.length ? methods.reduce((a, b) => a + b, 0) / methods.length : DEFAULT_INTENSITY;
  return minutes * intensity;
}

const DAY_MS = 86_400_000;
const dayNumber = (date: string) => Date.parse(date + "T00:00:00Z") / DAY_MS;
const addDays = (date: string, days: number) => new Date((dayNumber(date) + days) * DAY_MS).toISOString().slice(0, 10);

/** The climber's daily load, keyed by date (completed work only). */
export function climberLoads(work: ClimberWork[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const w of work) if (w.status === "COMPLETED") out.set(w.date, (out.get(w.date) ?? 0) + workLoad(w));
  return out;
}

/**
 * The twin's daily load: before the pact it is the climber (same history, same
 * start); from the start date it is the signed plan, every planned day, at the
 * plan's weekly load factor. Paused days push the plan later, as in the feed.
 */
export function twinLoads(pact: Pick<Pact, "plan" | "progression" | "startDate" | "horizonWeeks" | "pausedDays">, work: ClimberWork[], today: string): Map<string, number> {
  const out = new Map<string, number>();
  for (const [date, load] of climberLoads(work)) if (date < pact.startDate) out.set(date, load);
  for (const s of egoSchedule(pact)) {
    const date = addDays(s.date, pact.pausedDays);
    if (date > today) continue;
    const minutes = s.session.minutes > 0 ? s.session.minutes : DEFAULT_MINUTES;
    out.set(date, (out.get(date) ?? 0) + minutes * methodIntensity(s.session.methodId) * loadFactor(s.week, pact.progression));
  }
  return out;
}

/** Font sub-grades the model adds in one day, at a level (Font ordinal), from the last week's and previous four weeks' load. */
export function dailyGain(level: number, week: number, previousFour: number, m: TwinModel = TWIN_MODEL_V1): number {
  if (week <= 0) return 0;
  const effect = (1 - Math.exp(-week / m.referenceWeeklyLoad)) / (1 - Math.exp(-1));
  const chronic = previousFour / 4;
  const overreach = chronic > 0 && week / chronic > m.overreachRatio ? m.overreachFactor : 1;
  const above6A = level - FONT_6A;
  return (m.baseRate * Math.pow(m.slowdown, -above6A) * effect * overreach) / 7;
}
const FONT_6A = (FONT_SCALE as readonly string[]).indexOf("6A");

/** Grade gain (Font sub-grades) from `from` to `to` inclusive for a load series, starting at `level`. */
export function adaptation(loads: Map<string, number>, from: string, to: string, level: number, calibration = 1, m: TwinModel = TWIN_MODEL_V1): number {
  const at = (d: string) => loads.get(d) ?? 0;
  let gained = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) {
    let week = 0, previous = 0;
    for (let i = 0; i < 7; i++) week += at(addDays(d, -i));
    for (let i = 7; i < 35; i++) previous += at(addDays(d, -i));
    gained += calibration * dailyGain(level + gained, week, previous, m);
  }
  return gained;
}

export type Form = "fresh" | "normal" | "tired";

/** Training-stress balance going into a day (load up to the day before): (fitness − fatigue) ÷ fitness, from the two load averages. */
export function formIndex(loads: Map<string, number>, day: string, m: TwinModel = TWIN_MODEL_V1): number {
  let fitness = 0, fatigue = 0;
  const a = 1 / m.fitnessDays, b = 1 / m.fatigueDays;
  for (let d = addDays(day, -120); d < day; d = addDays(d, 1)) {
    const load = loads.get(d) ?? 0;
    fitness += a * (load - fitness);
    fatigue += b * (load - fatigue);
  }
  return fitness > 0.5 ? (fitness - fatigue) / fitness : 0;
}

export function formOf(index: number): Form {
  return index < -0.3 ? "tired" : index > 0.1 ? "fresh" : "normal";
}

export type Calibration = { factor: number; weeks: number; observedGain: number | null; modelGain: number };

/**
 * What the climber's own progress says about the model: observed working-grade
 * gain since the start against the gain the model gives for the work they
 * recorded, weighted by the weeks elapsed against a prior of 1. Needs a
 * measured working grade at both ends and at least four weeks.
 */
export function calibrate(observedStart: number | null, observedNow: number | null, modelGain: number, weeks: number, m: TwinModel = TWIN_MODEL_V1): Calibration {
  if (observedStart === null || observedNow === null || weeks < 4 || modelGain < 0.05) {
    return { factor: 1, weeks, observedGain: observedStart !== null && observedNow !== null ? observedNow - observedStart : null, modelGain };
  }
  const observedGain = observedNow - observedStart;
  const ratio = Math.min(m.maxCalibration, Math.max(m.minCalibration, observedGain / modelGain));
  const factor = (weeks * ratio + m.priorWeeks) / (weeks + m.priorWeeks);
  return { factor, weeks, observedGain, modelGain };
}

export type TwinGrade = { score: number; grade: string; next: string | null; towardsNext: number };

const fontScale: readonly string[] = FONT_SCALE;
const routeScale: readonly string[] = FRENCH_ROUTE_GRADES;

function onScale(scale: readonly string[], score: number): TwinGrade {
  const i = Math.max(0, Math.min(scale.length - 1, Math.floor(score + 1e-9)));
  return { score, grade: scale[i], next: scale[i + 1] ?? null, towardsNext: scale[i + 1] ? Math.max(0, Math.min(0.99, score - i)) : 0 };
}

export type TwinState = {
  model: TwinModel;
  /** The twin's level today, from where the climber measured on the start date. Null without a start grade. */
  boulder: TwinGrade | null; route: TwinGrade | null;
  /** The climber run through the same model with the same correction: where their recorded work leads. */
  youModel: { boulder: TwinGrade | null; route: TwinGrade | null };
  /** The start grades, and where they came from: the measured working grade, or the grade written in the pact. */
  start: { boulder: string | null; route: string | null };
  startSource: { boulder: "measured" | "pact" | null; route: "measured" | "pact" | null };
  form: { twin: Form; you: Form; twinIndex: number };
  calibration: Calibration;
  /** Twin minus the climber in the same model, in sub-grades (one decimal): what the climber did differently. */
  gap: number | null;
  /** Plan séances owed so far and how many days the climber trained on. */
  adherence: { planned: number; done: number; twinLoad: number; youLoad: number };
};

export type TwinInput = {
  pact: Pact; work: ClimberWork[]; today: string;
  /** Working grades measured on the start date and today (Font boulder, French route), or null when not enough data. */
  measuredStart: { boulder: string | null; route: string | null };
  measuredNow: { boulder: string | null; route: string | null };
  model?: TwinModel;
};

/** The twin and the climber on a given day. Pure and deterministic. */
export function twinState(input: TwinInput): TwinState {
  const { pact, work, today } = input;
  const m = input.model ?? TWIN_MODEL_V1;
  const until = today < pact.startDate ? pact.startDate : today;
  const end = pact.pausedSince && pact.pausedSince < until ? pact.pausedSince : until;
  const twin = twinLoads(pact, work, end);
  const you = climberLoads(work.filter((w) => w.date <= end));

  const fontScore = (g: string | null) => (g ? gradeToScore("FONT", g) : null);
  const routeScore = (g: string | null) => (g && routeScale.includes(g) ? routeScale.indexOf(g) : null);
  const startBoulder = fontScore(input.measuredStart.boulder) ?? fontScore(pact.startBoulderGrade);
  const startRoute = routeScore(input.measuredStart.route) ?? routeScore(pact.startRouteGrade);

  // Calibration on the boulder working grade (the measured one), falling back to the route grade.
  const weeks = Math.max(0, Math.floor((dayNumber(end) - dayNumber(pact.startDate)) / 7));
  const measuredBoulder = fontScore(input.measuredStart.boulder);
  const calibrationStart = measuredBoulder ?? startBoulder ?? FONT_6A;
  const youRaw = adaptation(you, pact.startDate, end, calibrationStart, 1, m);
  const calibration = measuredBoulder !== null
    ? calibrate(measuredBoulder, fontScore(input.measuredNow.boulder), youRaw, weeks, m)
    : calibrate(routeScore(input.measuredStart.route), routeScore(input.measuredNow.route), youRaw, weeks, m);

  // Route gains use the same sub-grade steps, from the boulder level when known (the body is the same).
  const gains = (loads: Map<string, number>) => {
    const level = startBoulder ?? FONT_6A;
    return adaptation(loads, pact.startDate, end, level, calibration.factor, m);
  };
  const twinGain = gains(twin), youGain = gains(you);
  const grade = (start: number | null, gain: number, scale: readonly string[]) => (start === null ? null : onScale(scale, start + gain));
  const twinIndex = formIndex(twin, end, m);

  const owed = egoSchedule(pact).filter((s) => addDays(s.date, pact.pausedDays) <= end && addDays(s.date, pact.pausedDays) < today);
  const trainedDays = new Set(work.filter((w) => w.status === "COMPLETED" && w.date >= pact.startDate && w.date < today).map((w) => w.date));
  const sum = (loads: Map<string, number>) => [...loads].filter(([d]) => d >= pact.startDate && d <= end).reduce((a, [, l]) => a + l, 0);

  const lead = startBoulder ?? startRoute;
  return {
    model: m,
    gap: lead === null ? null : Math.round((twinGain - youGain) * 10) / 10,
    boulder: grade(startBoulder, twinGain, fontScale),
    route: grade(startRoute, twinGain, routeScale),
    youModel: { boulder: grade(startBoulder, youGain, fontScale), route: grade(startRoute, youGain, routeScale) },
    start: {
      boulder: startBoulder === null ? null : fontScale[startBoulder] ?? null,
      route: startRoute === null ? null : routeScale[startRoute] ?? null,
    },
    startSource: {
      boulder: measuredBoulder !== null ? "measured" : startBoulder !== null ? "pact" : null,
      route: routeScore(input.measuredStart.route) !== null ? "measured" : startRoute !== null ? "pact" : null,
    },
    form: { twin: formOf(twinIndex), you: formOf(formIndex(you, end, m)), twinIndex },
    calibration,
    adherence: { planned: owed.length, done: trainedDays.size, twinLoad: Math.round(sum(twin)), youLoad: Math.round(sum(you)) },
  };
}

/** Working grades as they were measured on a date (boulder Font, route French), from the climber's logged climbing only. */
export function measuredAt(problems: ProblemFact[], attempts: AttemptFact[], routes: RouteAscentFact[], date: Date): { boulder: string | null; route: string | null } {
  return {
    boulder: calculateWorkingGrade(problems, attempts, date).level,
    route: routeWorkingGrade(routes.filter((a) => a.createdAt.getTime() <= date.getTime()), date).grade,
  };
}


/** The climber's hardest boulder send per day (reliable Font estimates only), from a date on. */
export function bestSendByDay(problems: ProblemFact[], attempts: AttemptFact[], from: string): Map<string, string> {
  const grade = new Map<string, string>();
  for (const p of problems) {
    const est = resolveNormalized(p);
    if (isReliable(est)) grade.set(p.id, est.grade);
  }
  const out = new Map<string, string>();
  for (const a of attempts) {
    if (a.result !== "TOP" && a.result !== "FLASH") continue;
    const g = grade.get(a.problemId);
    const day = utcToZoned(a.createdAt).date;
    if (!g || day < from) continue;
    const best = out.get(day);
    if (!best || (gradeToScore("FONT", g) ?? -1) > (gradeToScore("FONT", best) ?? -1)) out.set(day, g);
  }
  return out;
}

/**
 * The twin day by day over the last `days` days (and the day before), with
 * its boulder grade and form, and the whole weeks since its grade last moved.
 */
export function twinTimeline(input: TwinInput, days: number): { days: { date: string; grade: string | null; form: Form }[]; plateauWeeks: number } {
  const out: { date: string; grade: string | null; form: Form }[] = [];
  for (let i = days; i >= 0; i--) {
    const date = addDays(input.today, -i);
    if (date < input.pact.startDate) continue;
    const s = twinState({ ...input, today: date });
    out.push({ date, grade: s.boulder?.grade ?? null, form: s.form.twin });
  }
  const now = out.length ? out[out.length - 1].grade : null;
  let plateauWeeks = 0;
  for (let w = 1; w <= 12 && now; w++) {
    const date = addDays(input.today, -7 * w);
    if (date < input.pact.startDate) break;
    if (twinState({ ...input, today: date }).boulder?.grade !== now) break;
    plateauWeeks = w;
  }
  return { days: out, plateauWeeks };
}
