import { gradeToScore, scoreToGrade } from "@/lib/grading/ordering";
import { sessionTitle } from "@/lib/training/programme";
import { methodIntensity } from "./twin";
import { mondayOf } from "@/lib/training/sessions";
import { utcToZoned } from "@/lib/time";
import {
  PAIN_STOP, boulderPace, climberLedger, egoDays, egoLedger, egoSchedule, egoSessionLedger, pactClock, standing,
  type ClimberWork, type Ledger, type Pact, type Standing,
} from "./alter-ego";

/**
 * The rival: the alter ego with a face, a voice and a level. Its séances,
 * messages, sends and weekly duels are all derived from the pact, the
 * climber's recorded work and the date, so nothing is stored and nothing runs
 * in the background. Times and efforts come from a fixed hash of the date, so
 * the feed reads the same every time it is opened.
 *
 * Safety, whatever the tone or level: it never asks for more load or shorter rests than the programme,
 * and it never comments on a body or an injury.
 */

export const RIVAL_PORTRAITS = ["p1", "p2", "p3", "p4", "p5", "p6"] as const;
export type RivalPortrait = (typeof RIVAL_PORTRAITS)[number];
export const RIVAL_TONES = ["SYMPA", "PIQUANT", "SANS_PITIE"] as const;
export type RivalTone = (typeof RIVAL_TONES)[number];
/** REACH stays at most one séance and 10 % ahead; RELENTLESS follows the programme exactly; GOAL climbs at the pace that reaches the goal grade on its date. */
export const RIVAL_LEVELS = ["REACH", "RELENTLESS", "GOAL"] as const;
export type RivalLevel = (typeof RIVAL_LEVELS)[number];

export type RivalSettings = {
  portrait: RivalPortrait; tone: RivalTone; level: RivalLevel; chaseProjects: boolean; goalDate: string | null;
};
/** The defaults the climber approved: sharp, within reach, may go after projects. */
export const RIVAL_DEFAULTS: RivalSettings = { portrait: "p1", tone: "PIQUANT", level: "REACH", chaseProjects: true, goalDate: null };

export function rivalSettingsFromRow(row: Partial<Record<"portrait" | "tone" | "level" | "chase_projects" | "goal_date", unknown>>): RivalSettings {
  const pick = <T extends string>(list: readonly T[], v: unknown, fallback: T): T => (list as readonly unknown[]).includes(v) ? (v as T) : fallback;
  const level = pick(RIVAL_LEVELS, row.level, RIVAL_DEFAULTS.level);
  const goalDate = typeof row.goal_date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(row.goal_date) ? row.goal_date : null;
  return {
    portrait: pick(RIVAL_PORTRAITS, row.portrait, RIVAL_DEFAULTS.portrait),
    tone: pick(RIVAL_TONES, row.tone, RIVAL_DEFAULTS.tone),
    level: level === "GOAL" && !goalDate ? "REACH" : level,
    chaseProjects: typeof row.chase_projects === "boolean" ? row.chase_projects : RIVAL_DEFAULTS.chaseProjects,
    goalDate,
  };
}

const DAY_MS = 86_400_000;
const dayNumber = (date: string) => Date.parse(date + "T00:00:00Z") / DAY_MS;
const addDays = (date: string, days: number) => new Date((dayNumber(date) + days) * DAY_MS).toISOString().slice(0, 10);

/** A stable number in [0, 1) for a key (FNV-1a). */
export function seeded(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return (h >>> 0) / 0x100000000;
}

/** REACH: never more than one séance and 10 % ahead of the climber, and never more than the programme. */
export const REACH_MARGIN = 0.1;
export function levelLedger(level: RivalLevel, plan: Ledger, you: Ledger): Ledger {
  if (level !== "REACH") return plan;
  return {
    sessions: Math.min(plan.sessions, you.sessions + 1),
    // Integer arithmetic: 50 × 1.1 must be 55, not 55.000…1 rounded up to 56.
    reps: Math.min(plan.reps, Math.ceil((you.reps * Math.round(100 * (1 + REACH_MARGIN))) / 100)),
    minutes: Math.min(plan.minutes, Math.ceil((you.minutes * Math.round(100 * (1 + REACH_MARGIN))) / 100)),
  };
}

/** The score against the rival at its level. */
export function rivalStanding(pact: Pact, settings: Pick<RivalSettings, "level">, work: ClimberWork[], today: string): Standing {
  const you = climberLedger(work, pact.startDate);
  return standing(you, levelLedger(settings.level, egoLedger(pact, pactClock(pact, today), work), you));
}

export type RacePoint = { week: number; you: number; rival: number };

/**
 * The race so far, for the duel diagram: séances done since signing, by you
 * and by the rival at its level, at the end of each pact week (the current
 * week up to today, exactly as the score card shows it).
 */
export function duelRace(pact: Pact, settings: Pick<RivalSettings, "level">, work: ClimberWork[], today: string): RacePoint[] {
  const first = mondayOf(pact.startDate);
  const out: RacePoint[] = [];
  for (let week = 0; week < pact.horizonWeeks; week++) {
    const end = addDays(first, (week + 1) * 7);
    const current = end > today;
    const s = current
      ? rivalStanding(pact, settings, work.filter((w) => w.date <= today), today)
      : rivalStanding(pact, settings, work.filter((w) => w.date < end), end);
    out.push({ week: week + 1, you: s.you.sessions, rival: s.ego.sessions });
    if (current) break;
  }
  return out;
}

/**
 * GOAL level: the boulder grade the rival climbs this week, on a straight line
 * from the pact's start grade to its goal grade on the goal date. A pace the
 * climber chose, never a prediction. Other levels climb at the twin's level
 * when it is given, else at the pact's own pace.
 */
export function rivalBoulderGrade(pact: Pact, settings: Pick<RivalSettings, "level" | "goalDate">, today: string, twin?: string | null): string | null {
  const clock = pactClock(pact, today);
  const week = Math.max(0, Math.floor((dayNumber(clock) - dayNumber(mondayOf(pact.startDate))) / 7));
  // The twin's level (lib/analytics/twin) when known: the climber, following the plan to the letter.
  if (settings.level !== "GOAL" || !settings.goalDate) return twin !== undefined ? twin : boulderPace(pact, Math.min(week, pact.horizonWeeks));
  if (!pact.startBoulderGrade || !pact.targetBoulderGrade) return null;
  const from = gradeToScore("FONT", pact.startBoulderGrade), to = gradeToScore("FONT", pact.targetBoulderGrade);
  if (from === null || to === null || to < from) return null;
  const weeks = Math.max(1, Math.ceil((dayNumber(settings.goalDate) - dayNumber(mondayOf(pact.startDate))) / 7));
  return scoreToGrade("FONT", Math.round(from + (to - from) * Math.min(1, week / weeks)));
}

export const RIVAL_MESSAGES = [
  "skipped", "passedYou", "youPassed", "beforeSession", "monday",
  "restDay", "sessionReport", "sessionTired", "sessionFresh", "sawSession", "sawSend", "newGrade", "plateau",
] as const;
export type RivalMessage = (typeof RIVAL_MESSAGES)[number];

export type FeedItem =
  | { kind: "session"; date: string; time: string; title: string; minutes: number; effort: number }
  | { kind: "message"; date: string; time: string; message: RivalMessage; variant: number; vars: Record<string, string | number> }
  | { kind: "send"; date: string; time: string; grade: string; tries: number; board: { name: string; angle: number } | null }
  | { kind: "attempt"; date: string; time: string; grade: string; board: { name: string; angle: number } | null }
  | { kind: "project"; date: string; time: string; project: string; sent: boolean }
  | { kind: "duel"; date: string; time: string; week: number; you: number; rival: number; winner: "you" | "rival" | "level" };

const hhmm = (minutes: number) => {
  const m = Math.max(0, Math.min(23 * 60 + 59, Math.round(minutes)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};
const minutesOf = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));

/** A believable time: around the climber's usual training time (else early morning or evening), fixed for a given day. */
function timeOf(key: string, usual: string | null, evening = seeded(key + "|ampm") < 0.6): string {
  if (usual) return hhmm(minutesOf(usual) - 45 + seeded(key + "|t") * 90);
  return hhmm(evening ? 18 * 60 + seeded(key + "|t") * 150 : 6 * 60 + 30 + seeded(key + "|t") * 105);
}

/**
 * Which wording of a message: each kind of message walks through its wordings
 * one day after the other, so the same sentence never comes back within as
 * many days as there are wordings.
 */
export function variantOf(message: RivalMessage, date: string, count: number): number {
  if (count <= 1) return 0;
  const offset = Math.floor(seeded("variant|" + message) * count);
  return (((dayNumber(date) + offset) % count) + count) % count;
}

/** Methods of the plan where the rival actually climbs (and may send something). */
const CLIMBING_METHODS = new Set([
  "limit-bouldering", "four-by-four", "technique", "constraints", "easy-volume", "training-board", "periodized",
  "lattice", "power-company", "crimpd", "hoopers", "campus",
]);

export type Duel = { week: number; monday: string; you: Ledger; rival: Ledger; points: { you: number; rival: number }; winner: "you" | "rival" | "level" };

const weekOf = (work: ClimberWork[], monday: string): Ledger =>
  climberLedger(work.filter((w) => w.date >= monday && w.date < addDays(monday, 7)), monday);

/**
 * Each finished week is a match on séances, active minutes and counted reps:
 * one point per category won. The pact is the season.
 */
export function weeklyDuels(pact: Pact, settings: Pick<RivalSettings, "level">, work: ClimberWork[], today: string): Duel[] {
  const clock = pactClock(pact, today);
  const first = mondayOf(pact.startDate);
  const days = egoDays(pact, clock, work);
  const out: Duel[] = [];
  for (let week = 0; week < pact.horizonWeeks; week++) {
    const monday = addDays(first, week * 7);
    if (addDays(monday, 7) > clock) break;
    const plan = days.filter((d) => d.week === week).map((d) => d.ledger)
      .reduce((a, b) => ({ sessions: a.sessions + b.sessions, reps: a.reps + b.reps, minutes: a.minutes + b.minutes }), { sessions: 0, reps: 0, minutes: 0 });
    const you = weekOf(work.filter((w) => w.date >= pact.startDate), monday);
    const rival = levelLedger(settings.level, plan, you);
    const points = { you: 0, rival: 0 };
    for (const k of ["sessions", "minutes", "reps"] as const) {
      if (you[k] > rival[k]) points.you += 1; else if (rival[k] > you[k]) points.rival += 1;
    }
    out.push({ week: week + 1, monday, you, rival, points,
      winner: points.you > points.rival ? "you" : points.rival > points.you ? "rival" : "level" });
  }
  return out;
}

export function season(duels: Duel[]): { you: number; rival: number } {
  return { you: duels.filter((d) => d.winner === "you").length, rival: duels.filter((d) => d.winner === "rival").length };
}

/** The twin on one day (lib/analytics/twin): its boulder grade and its form. */
export type TwinDay = { date: string; grade: string | null; form: "fresh" | "normal" | "tired" };

/** What the climber logged on a day, for the rival's reactions. */
export type YourDay = { date: string; time: string | null; pain: number | null; best: string | null; hard: boolean };

export type FeedInput = {
  pact: Pact; settings: RivalSettings; work: ClimberWork[]; today: string;
  /** Names of the climber's open projects, offered only when the rival may chase them. */
  projects: string[];
  /** The climber's boards and the angle used most, so the rival climbs there too. */
  board: { name: string; angle: number } | null;
  /** Weekday names, Monday first, for the messages. */
  weekdays: readonly string[];
  days?: number;
  /** The twin day by day over the window and the day before, oldest first. */
  twin?: TwinDay[];
  /** Whole weeks since the twin's boulder grade last changed (a plateau from four). */
  plateauWeeks?: number;
  /** The climber's logged days over the window, with their hardest send and whether it was at their level or above. */
  yours?: YourDay[];
  /** The climber's usual training time (HH:MM), which the rival keeps to. */
  usualTime?: string | null;
  /** How many wordings each message has in the climber's language and tone. */
  wordings?: Partial<Record<RivalMessage, number>>;
};

/** The climber's usual training time: the median end time of their logged work, an hour earlier. Null under three times. */
export function usualTrainingTime(endTimes: string[]): string | null {
  const sorted = endTimes.filter((t) => /^\d{2}:\d{2}$/.test(t)).map(minutesOf).sort((a, b) => a - b);
  if (sorted.length < 3) return null;
  return hhmm(sorted[Math.floor(sorted.length / 2)] - 60);
}

/**
 * What the rival did and said over the last days, newest first. It speaks
 * every day: before and after its séances, on some rest days, when the
 * climber logs something, when one passes the other, on Mondays, and when its
 * level moves or stalls. When the pact is paused or over, it goes quiet. It
 * never comments on a body or on pain: after a séance with reported pain it
 * simply says nothing about it.
 */
export function rivalFeed(input: FeedInput): FeedItem[] {
  const { pact, settings, work, today, weekdays } = input;
  const days = input.days ?? 7;
  if (pact.status !== "ACTIVE") return [];

  const from = addDays(today, -(days - 1));
  const items: FeedItem[] = [];
  const usual = input.usualTime ?? null;
  const count = (m: RivalMessage) => input.wordings?.[m] ?? 1;
  const say = (date: string, time: string, message: RivalMessage, vars: Record<string, string | number> = {}) =>
    items.push({ kind: "message", date, time, message, variant: variantOf(message, date, count(message)), vars: { name: pact.displayName, ...vars } });
  const done = new Set(work.filter((w) => w.status === "COMPLETED").map((w) => w.date));
  const twinDays = input.twin ?? [];
  const twinOn = new Map(twinDays.map((d) => [d.date, d] as const));
  // The schedule runs on the pact clock; paused days push it later in real dates.
  const all = egoSchedule(pact).map((s) => ({ ...s, date: addDays(s.date, pact.pausedDays) }));
  const scheduled = all.filter((s) => s.date >= from && s.date <= today);
  const planDays = new Set(all.map((s) => s.date));
  const dayName = (date: string) => weekdays[(new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7] ?? date;
  const fallbackGrade = rivalBoulderGrade(pact, settings, today, twinDays.length ? twinDays[twinDays.length - 1].grade : undefined);

  for (const s of scheduled) {
    const key = pact.id + "|" + s.date;
    const title = sessionTitle(s.session);
    if (s.date === today) {
      if (!done.has(today)) say(today, hhmm(7 * 60 + 5 + seeded(key + "|m") * 70), "beforeSession", { title });
      continue;
    }
    const twin = twinOn.get(s.date);
    const form = twin?.form ?? "normal";
    const time = timeOf(key, usual);
    const minutes = egoSessionLedger(s, pact.progression).minutes;
    const base = 4 + Math.round(methodIntensity(s.session.methodId) * 3);
    const effort = Math.max(3, Math.min(9, base + (form === "tired" ? 1 : form === "fresh" ? -1 : 0) + (seeded(key + "|e") < 0.3 ? 1 : 0)));
    items.push({ kind: "session", date: s.date, time, title, minutes, effort });
    say(s.date, hhmm(minutesOf(time) + minutes + 10 + seeded(key + "|r") * 40),
      form === "tired" ? "sessionTired" : form === "fresh" ? "sessionFresh" : "sessionReport", { title, effort });
    if (!done.has(s.date)) say(addDays(s.date, 1), hhmm(7 * 60 + 40 + seeded(key + "|s") * 40), "skipped", { day: dayName(s.date) });

    // On climbing days it goes for something at its level: it goes or it doesn't, more often when fresh.
    const grade = twin?.grade ?? fallbackGrade;
    if (grade && s.session.methodId && CLIMBING_METHODS.has(s.session.methodId)) {
      const board = s.session.methodId === "training-board" || s.session.methodId === "campus" || s.session.methodId === "limit-bouldering" ? input.board : null;
      const chance = form === "fresh" ? 0.5 : form === "tired" ? 0.15 : 0.32;
      const at = hhmm(minutesOf(time) + minutes * 0.6);
      if (seeded(key + "|go") < chance) items.push({ kind: "send", date: s.date, time: at, grade, tries: 2 + Math.floor(seeded(key + "|tries") * 5), board });
      else items.push({ kind: "attempt", date: s.date, time: at, grade, board });
    }
  }

  // Rest days: a word on some of them.
  for (let d = from; d < today; d = addDays(d, 1)) {
    if (planDays.has(d) || seeded(pact.id + "|rest|" + d) >= 0.6) continue;
    say(d, hhmm(10 * 60 + seeded(pact.id + "|restt|" + d) * 9 * 60), "restDay", { day: dayName(d) });
  }

  // It reacts to what the climber logged, the same evening; nothing after reported pain.
  for (const y of input.yours ?? []) {
    if (y.date < from || y.date > today || (y.pain ?? 0) >= PAIN_STOP) continue;
    const t = hhmm((y.time ? minutesOf(y.time) : 20 * 60) + 20 + seeded(pact.id + "|saw|" + y.date) * 50);
    if (y.best && y.hard) say(y.date, t, "sawSend", { grade: y.best });
    else say(y.date, t, "sawSession");
  }

  // Its level: a word the day it reaches a new grade.
  for (let i = 1; i < twinDays.length; i++) {
    const d = twinDays[i], prev = twinDays[i - 1];
    if (d.date < from || d.date > today || !d.grade || !prev.grade || d.grade === prev.grade) continue;
    say(d.date, hhmm(20 * 60 + 30 + seeded(pact.id + "|grade|" + d.date) * 60), "newGrade", { grade: d.grade });
  }

  // Who passed whom, from one evening to the next.
  let previous: Standing["state"] | null = null;
  for (let d = addDays(from, -1); d <= today; d = addDays(d, 1)) {
    const until = work.filter((w) => w.date <= d);
    const state = rivalStanding(pact, settings, until, addDays(d, 1)).state;
    if (previous !== null && state !== previous && d >= from && d < today) {
      const time = hhmm(21 * 60 + 15 + seeded(pact.id + "|pass|" + d) * 50);
      if (state === "behind") say(d, time, "passedYou");
      if (state === "ahead") say(d, time, "youPassed");
    }
    previous = state;
  }

  // Monday: last week's match and the season, and a word when its level has stalled for four weeks.
  const duels = weeklyDuels(pact, settings, work, today);
  for (const duel of duels) {
    const date = addDays(duel.monday, 7);
    if (date < from || date > today) continue;
    const s = season(duels.filter((x) => x.week <= duel.week));
    items.push({ kind: "duel", date, time: "07:30", week: duel.week, you: duel.points.you, rival: duel.points.rival, winner: duel.winner });
    say(date, "07:31", "monday", { week: duel.week, you: s.you, rival: s.rival });
  }
  const monday = mondayOf(today);
  if ((input.plateauWeeks ?? 0) >= 4 && monday >= from && fallbackGrade) {
    say(monday, "08:10", "plateau", { grade: fallbackGrade, weeks: input.plateauWeeks ?? 4 });
  }

  // And, if allowed, it goes after one of the climber's projects once a week; it rarely sends it.
  const climbingDays = scheduled.filter((s) => s.date < today && s.session.methodId && CLIMBING_METHODS.has(s.session.methodId));
  if (settings.chaseProjects && input.projects.length && climbingDays.length) {
    const s = climbingDays[climbingDays.length - 1];
    const project = input.projects[Math.floor(seeded(pact.id + "|project|" + monday) * input.projects.length)];
    items.push({ kind: "project", date: s.date, time: hhmm(minutesOf(timeOf(pact.id + "|" + s.date, usual)) + 50), project,
      sent: seeded(pact.id + "|projectsent|" + monday) < 0.25 });
  }

  return items.filter((i) => i.date >= from && i.date <= today)
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}

/** The climber's logged days from a date on: when they finished, the worst reported pain, and their hardest send (hard when at their working grade or above). */
export function yourDays(work: ClimberWork[], best: Map<string, string>, level: string | null, from: string): YourDay[] {
  const byDay = new Map<string, YourDay>();
  const levelScore = level ? gradeToScore("FONT", level) : null;
  for (const w of work) {
    if (w.status !== "COMPLETED" || w.date < from) continue;
    const day = byDay.get(w.date) ?? { date: w.date, time: null, pain: null, best: best.get(w.date) ?? null, hard: false };
    const time = w.endedAt ? utcToZoned(w.endedAt).time : null;
    if (time && (!day.time || time > day.time)) day.time = time;
    if (w.pain !== null && (day.pain === null || w.pain > day.pain)) day.pain = w.pain;
    const score = day.best ? gradeToScore("FONT", day.best) : null;
    day.hard = score !== null && levelScore !== null && score >= levelScore;
    byDay.set(w.date, day);
  }
  return [...byDay.values()].sort((a, b) => a.date.localeCompare(b.date));
}

/** End times (HH:MM) of the climber's logged work over the last 60 days, for their usual training time. */
export function recentEndTimes(work: ClimberWork[], today: string): string[] {
  const from = addDays(today, -60);
  return work.filter((w) => w.status === "COMPLETED" && w.date >= from && w.endedAt).map((w) => utcToZoned(w.endedAt!).time);
}

/** The race in the player, once the climber has finished: positive when the climber beat the rival by that many seconds. */
export function raceMargin(rivalTotalSeconds: number, yourSeconds: number): number {
  return Math.round(rivalTotalSeconds - yourSeconds);
}
