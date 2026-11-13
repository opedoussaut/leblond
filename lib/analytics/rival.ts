import { gradeToScore, scoreToGrade } from "@/lib/grading/ordering";
import { sessionTitle } from "@/lib/training/programme";
import { mondayOf } from "@/lib/training/sessions";
import {
  boulderPace, climberLedger, egoDays, egoLedger, egoSchedule, egoSessionLedger, pactClock, standing,
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

/**
 * GOAL level: the boulder grade the rival climbs this week, on a straight line
 * from the pact's start grade to its goal grade on the goal date. A pace the
 * climber chose, never a prediction. Other levels use the pact's own pace.
 */
export function rivalBoulderGrade(pact: Pact, settings: Pick<RivalSettings, "level" | "goalDate">, today: string): string | null {
  const clock = pactClock(pact, today);
  const week = Math.max(0, Math.floor((dayNumber(clock) - dayNumber(mondayOf(pact.startDate))) / 7));
  if (settings.level !== "GOAL" || !settings.goalDate) return boulderPace(pact, Math.min(week, pact.horizonWeeks));
  if (!pact.startBoulderGrade || !pact.targetBoulderGrade) return null;
  const from = gradeToScore("FONT", pact.startBoulderGrade), to = gradeToScore("FONT", pact.targetBoulderGrade);
  if (from === null || to === null || to < from) return null;
  const weeks = Math.max(1, Math.ceil((dayNumber(settings.goalDate) - dayNumber(mondayOf(pact.startDate))) / 7));
  return scoreToGrade("FONT", Math.round(from + (to - from) * Math.min(1, week / weeks)));
}

export type RivalMessage = "skipped" | "passedYou" | "youPassed" | "beforeSession" | "monday";

export type FeedItem =
  | { kind: "session"; date: string; time: string; title: string; minutes: number; effort: number }
  | { kind: "message"; date: string; time: string; message: RivalMessage; vars: Record<string, string | number> }
  | { kind: "send"; date: string; time: string; grade: string; tries: number; board: { name: string; angle: number } | null }
  | { kind: "project"; date: string; time: string; project: string }
  | { kind: "duel"; date: string; time: string; week: number; you: number; rival: number; winner: "you" | "rival" | "level" };

/** A believable time: early morning or evening, fixed for a given day. */
function timeOf(key: string, evening = seeded(key + "|ampm") < 0.6): string {
  const minutes = evening ? 18 * 60 + Math.floor(seeded(key + "|t") * 150) : 6 * 60 + 30 + Math.floor(seeded(key + "|t") * 105);
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

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

export type FeedInput = {
  pact: Pact; settings: RivalSettings; work: ClimberWork[]; today: string;
  /** Names of the climber's open projects, offered only when the rival may chase them. */
  projects: string[];
  /** The climber's boards and the angle used most, so the rival climbs there too. */
  board: { name: string; angle: number } | null;
  /** Weekday names, Monday first, for the messages. */
  weekdays: readonly string[];
  days?: number;
};

/**
 * What the rival did and said over the last days, newest first. When the
 * pact is paused or over, it goes quiet. Pain never stops the race: the climber decides.
 */
export function rivalFeed(input: FeedInput): FeedItem[] {
  const { pact, settings, work, today, weekdays } = input;
  const days = input.days ?? 7;
  if (pact.status !== "ACTIVE") return [];

  const from = addDays(today, -(days - 1));
  const items: FeedItem[] = [];
  const done = new Set(work.filter((w) => w.status === "COMPLETED").map((w) => w.date));
  // The schedule runs on the pact clock; paused days push it later in real dates.
  const scheduled = egoSchedule(pact).map((s) => ({ ...s, date: addDays(s.date, pact.pausedDays) }))
    .filter((s) => s.date >= from && s.date <= today);
  const dayName = (date: string) => weekdays[(new Date(date + "T12:00:00Z").getUTCDay() + 6) % 7] ?? date;

  for (const s of scheduled) {
    const key = pact.id + "|" + s.date;
    if (s.date === today) {
      if (!done.has(today)) items.push({ kind: "message", date: today, time: "07:45", message: "beforeSession", vars: { name: pact.displayName, title: sessionTitle(s.session) } });
      continue;
    }
    items.push({ kind: "session", date: s.date, time: timeOf(key), title: sessionTitle(s.session),
      minutes: egoSessionLedger(s, pact.progression).minutes, effort: 6 + Math.floor(seeded(key + "|e") * 4) });
    if (!done.has(s.date)) items.push({ kind: "message", date: addDays(s.date, 1), time: "07:58", message: "skipped", vars: { name: pact.displayName, day: dayName(s.date) } });
  }

  // Who passed whom, from one evening to the next.
  let previous: Standing["state"] | null = null;
  for (let d = addDays(from, -1); d <= today; d = addDays(d, 1)) {
    const until = work.filter((w) => w.date <= d);
    const state = rivalStanding(pact, settings, until, addDays(d, 1)).state;
    if (previous !== null && state !== previous && d >= from && d < today) {
      if (state === "behind") items.push({ kind: "message", date: d, time: "21:30", message: "passedYou", vars: { name: pact.displayName } });
      if (state === "ahead") items.push({ kind: "message", date: d, time: "21:30", message: "youPassed", vars: { name: pact.displayName } });
    }
    previous = state;
  }

  // Monday: last week's match and the season.
  const duels = weeklyDuels(pact, settings, work, today);
  for (const duel of duels) {
    const date = addDays(duel.monday, 7);
    if (date < from || date > today) continue;
    const s = season(duels.filter((x) => x.week <= duel.week));
    items.push({ kind: "duel", date, time: "07:30", week: duel.week, you: duel.points.you, rival: duel.points.rival, winner: duel.winner });
    items.push({ kind: "message", date, time: "07:31", message: "monday", vars: { name: pact.displayName, week: duel.week, you: s.you, rival: s.rival } });
  }

  // It climbs too: one send a week at its grade, on the climber's board when there is one.
  const grade = rivalBoulderGrade(pact, settings, today);
  const climbingDays = scheduled.filter((s) => s.date < today);
  if (grade && climbingDays.length) {
    const s = climbingDays[Math.floor(seeded(pact.id + "|send|" + mondayOf(today)) * climbingDays.length)];
    items.push({ kind: "send", date: s.date, time: timeOf(pact.id + "|send|" + s.date, true), grade,
      tries: 1 + Math.floor(seeded(pact.id + "|tries|" + s.date) * 4), board: input.board });
  }
  // And, if allowed, it goes after one of the climber's projects once a week.
  if (settings.chaseProjects && input.projects.length && climbingDays.length) {
    const s = climbingDays[climbingDays.length - 1];
    const project = input.projects[Math.floor(seeded(pact.id + "|project|" + mondayOf(today)) * input.projects.length)];
    items.push({ kind: "project", date: s.date, time: timeOf(pact.id + "|project|" + s.date, true), project });
  }

  return items.filter((i) => i.date >= from && i.date <= today)
    .sort((a, b) => (b.date + b.time).localeCompare(a.date + a.time));
}

/** The race in the player, once the climber has finished: positive when the climber beat the rival by that many seconds. */
export function raceMargin(rivalTotalSeconds: number, yourSeconds: number): number {
  return Math.round(rivalTotalSeconds - yourSeconds);
}
