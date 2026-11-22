import { FINGER_SOURCES, LOAD_SOURCES, LOAD_THRESHOLDS, type LoadSource, type SessionLoad } from "./training-load";
import { DAY_MS } from "./types";

/**
 * Training load in hours, the way TrainingPeaks, Suunto, Garmin and climbing
 * logs show it to people who are not sport scientists: hours per week stacked
 * by type, "ton habitude" (the weekly average of the 4 weeks before), and
 * where the last 7 days sit against it: too light, in your zone, too heavy.
 *
 * The zone counts climbing and training hours (bloc, voie, board,
 * entraînement). Mobility is drawn in the bars but left out of the zone: it
 * barely loads fingers and tendons, and a mobility programme would otherwise
 * read as "too heavy".
 *
 * The habit is the 4 weeks *before* the week judged (an "uncoupled" ratio):
 * a week can never be its own reference, so a first logged week does not
 * read as 4.0, and with less than 4 weeks of history, or almost no activity
 * in them, there is no habit at all ("pas encore assez d'historique")
 * instead of a misleading number.
 */

export const HABIT_DAYS = 28;
/** Weeks (7-day blocks) of the habit window that must hold some climbing or training. */
export const MIN_ACTIVE_HABIT_WEEKS = 2;
/** Below this weekly average (minutes) the habit is too thin to compare against. */
export const MIN_HABIT_MINUTES = 30;
/** Zone limits as multiples of the habit: the band used across the page (0.8–1.3). */
export const ZONE_LOW = LOAD_THRESHOLDS.low;
export const ZONE_HIGH = LOAD_THRESHOLDS.high;
/** Climbing and training sessions: the ones that count in the zone. */
export const EFFORT_SOURCES: readonly LoadSource[] = FINGER_SOURCES;

export type HoursZone = "light" | "zone" | "heavy";

export type Habit = {
  /** Average weekly climbing + training minutes over the 4 weeks before. */
  minutes: number;
  /** The zone in minutes: habit × 0.8 and habit × 1.3. */
  low: number; high: number;
};

/** Why there is no habit yet: history shorter than 4 weeks, or too little activity in those weeks. */
export type NoHabit = { reason: "history"; daysLeft: number } | { reason: "activity" };

const addDays = (date: string, n: number) => new Date(Date.parse(date + "T00:00:00Z") + n * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY_MS);
const isoWeekStart = (date: string) => {
  const t = Date.parse(date + "T00:00:00Z");
  return new Date(t - ((new Date(t).getUTCDay() + 6) % 7) * DAY_MS).toISOString().slice(0, 10);
};
const isEffort = (l: SessionLoad) => EFFORT_SOURCES.includes(l.source);

/** Daily minutes on or before `today`: climbing + training, and everything; plus the first day of history. */
type Days = { effort: Map<string, number>; first: string | null };
function dailyMinutes(loads: readonly SessionLoad[], today: string): Days {
  const effort = new Map<string, number>();
  let first: string | null = null;
  for (const l of loads) {
    if (l.date > today) continue;
    if (first === null || l.date < first) first = l.date;
    if (isEffort(l)) effort.set(l.date, (effort.get(l.date) ?? 0) + l.minutes);
  }
  return { effort, first };
}

const sumDays = (byDay: Map<string, number>, from: string, to: string) => {
  let s = 0;
  for (let d = from; d <= to; d = addDays(d, 1)) s += byDay.get(d) ?? 0;
  return s;
};

/**
 * The habit for a period starting on `start`: the 28 days before it. Null
 * (with the reason) when history does not reach back 28 days, when fewer
 * than 2 of its 4 weeks hold climbing or training, or when the average is
 * under 30 minutes a week.
 */
function habitBefore(days: Days, start: string): Habit | NoHabit {
  const from = addDays(start, -HABIT_DAYS);
  if (days.first === null) return { reason: "history", daysLeft: HABIT_DAYS };
  if (days.first > from) return { reason: "history", daysLeft: daysBetween(from, days.first) };
  let total = 0, active = 0;
  for (let w = 0; w < HABIT_DAYS / 7; w++) {
    const s = sumDays(days.effort, addDays(from, w * 7), addDays(from, w * 7 + 6));
    total += s;
    if (s > 0) active++;
  }
  const minutes = total / (HABIT_DAYS / 7);
  if (active < MIN_ACTIVE_HABIT_WEEKS || minutes < MIN_HABIT_MINUTES) return { reason: "activity" };
  return { minutes: Math.round(minutes), low: Math.round(minutes * ZONE_LOW), high: Math.round(minutes * ZONE_HIGH) };
}

export const isHabit = (h: Habit | NoHabit | null | undefined): h is Habit => !!h && "minutes" in h;

/** Where some minutes sit against a habit. */
export function hoursZone(minutes: number, habit: Habit): HoursZone {
  const r = minutes / habit.minutes;
  return r < ZONE_LOW ? "light" : r <= ZONE_HIGH ? "zone" : "heavy";
}

// ── Weekly bars ────────────────────────────────────────────────────────────

export type WeekHours = {
  weekStart: string;
  /** Minutes per type, in LOAD_SOURCES order (every type present, 0 when none). */
  bySource: Record<LoadSource, number>;
  /** All minutes, mobility included, and climbing + training minutes only (what the zone reads). */
  total: number; effort: number;
  sessions: number;
  /** The current week, still running: its bar is not judged. */
  partial: boolean;
  /** The habit before this week (null: not enough history). */
  habit: Habit | null;
  /** The finished week against its habit, as a zone and as climbing + training ÷ habit; null for the current week or without habit. */
  zone: HoursZone | null; ratio: number | null;
};

/** One row per ISO week from the week of `from` to the week of `today`, empty weeks included. */
export function weeklyHours(loads: readonly SessionLoad[], today: string, from: string): WeekHours[] {
  const days = dailyMinutes(loads, today);
  const current = isoWeekStart(today);
  const rows: WeekHours[] = [];
  for (let w = isoWeekStart(from); w <= current; w = addDays(w, 7)) {
    const end = addDays(w, 6);
    const list = loads.filter((l) => l.date >= w && l.date <= end && l.date <= today);
    const bySource = Object.fromEntries(LOAD_SOURCES.map((s) => [s, 0])) as Record<LoadSource, number>;
    for (const l of list) bySource[l.source] += l.minutes;
    const effort = list.filter(isEffort).reduce((s, l) => s + l.minutes, 0);
    const h = habitBefore(days, w);
    const habit = isHabit(h) ? h : null;
    const partial = w === current;
    rows.push({
      weekStart: w, bySource, total: list.reduce((s, l) => s + l.minutes, 0), effort, sessions: list.length, partial, habit,
      zone: habit && !partial ? hoursZone(effort, habit) : null,
      ratio: habit && !partial ? Math.round((effort / habit.minutes) * 100) / 100 : null,
    });
  }
  return rows;
}

// ── The headline: the last 7 days against the habit ────────────────────────

export type HoursStatus = {
  /** Climbing + training minutes over the last 7 days (today included), and mobility minutes on top. */
  last7: number; mobility7: number; sessions7: number;
  /** The 4 weeks before those 7 days, or why there is none. */
  habit: Habit | null; noHabit: NoHabit | null;
  zone: HoursZone | null;
};

export function hoursStatus(loads: readonly SessionLoad[], today: string): HoursStatus {
  const days = dailyMinutes(loads, today);
  const start = addDays(today, -6);
  const week = loads.filter((l) => l.date >= start && l.date <= today);
  const last7 = week.filter(isEffort).reduce((s, l) => s + l.minutes, 0);
  const h = habitBefore(days, start);
  const habit = isHabit(h) ? h : null;
  return {
    last7, mobility7: week.filter((l) => l.source === "MOBILITY").reduce((s, l) => s + l.minutes, 0),
    sessions7: week.filter(isEffort).length,
    habit, noHabit: isHabit(h) ? null : h, zone: habit ? hoursZone(last7, habit) : null,
  };
}

// ── The next 7 days, in séances ────────────────────────────────────────────

export type NextWeek = {
  /** Climbing + training minutes over the next 7 days that keep them in the zone (habit = the last 28 days). */
  minMinutes: number; maxMinutes: number;
  /** The climber's usual séance (median climbing/training séance of the last 6 weeks), and the range in séances like it. */
  typicalMinutes: number; minSessions: number; maxSessions: number;
};

/**
 * Guidance for the next 7 days: they will be compared to the last 28 days, so
 * the zone for them is 0.8–1.3 × that weekly average, turned into séances of
 * the climber's usual length. A rule of thumb, not a prediction. Null
 * without a habit.
 */
export function nextWeek(loads: readonly SessionLoad[], today: string): NextWeek | null {
  const days = dailyMinutes(loads, today);
  const h = habitBefore(days, addDays(today, 1));
  if (!isHabit(h)) return null;
  const since = addDays(today, -41);
  const recent = loads.filter((l) => l.date >= since && l.date <= today && isEffort(l)).map((l) => l.minutes).sort((a, b) => a - b);
  if (!recent.length) return null;
  const typical = recent[Math.floor((recent.length - 1) / 2)];
  const minSessions = Math.max(1, Math.round(h.low / typical));
  const maxSessions = Math.max(minSessions, Math.round(h.high / typical));
  return { minMinutes: h.low, maxMinutes: h.high, typicalMinutes: typical, minSessions, maxSessions };
}

// ── Details: the same comparison day by day ────────────────────────────────

export type ZoneDay = {
  date: string;
  /** Climbing + training minutes over the 7 days ending that day ÷ the habit before them; null without habit (not drawn). */
  ratio: number | null;
  last7: number; habit: number | null;
};

/** The headline's comparison for every day from `from` to `today`. Days without a habit are null, never 0. */
export function zoneDays(loads: readonly SessionLoad[], today: string, from: string): ZoneDay[] {
  const days = dailyMinutes(loads, today);
  if (days.first === null) return [];
  const out: ZoneDay[] = [];
  for (let d = from > days.first ? from : days.first; d <= today; d = addDays(d, 1)) {
    const start = addDays(d, -6);
    const last7 = sumDays(days.effort, start, d);
    const h = habitBefore(days, start);
    out.push({ date: d, last7, habit: isHabit(h) ? h.minutes : null, ratio: isHabit(h) ? Math.round((last7 / h.minutes) * 100) / 100 : null });
  }
  return out;
}

/** Minutes and séances per type over the last `days` days (today included), types without any left out. */
export function minutesBySource(loads: readonly SessionLoad[], today: string, days = HABIT_DAYS): { source: LoadSource; minutes: number; sessions: number }[] {
  const since = addDays(today, -(days - 1));
  return LOAD_SOURCES.map((source) => {
    const list = loads.filter((l) => l.source === source && l.date >= since && l.date <= today);
    return { source, minutes: list.reduce((s, l) => s + l.minutes, 0), sessions: list.length };
  }).filter((r) => r.sessions > 0);
}

export type HoursReport = {
  weeks: WeekHours[]; status: HoursStatus; next: NextWeek | null; days: ZoneDay[];
  bySource: ReturnType<typeof minutesBySource>;
};

/** Everything the "Charge" view draws, for weeks from `from`. */
export function hoursReport(loads: readonly SessionLoad[], today: string, from: string): HoursReport {
  return {
    weeks: weeklyHours(loads, today, from), status: hoursStatus(loads, today), next: nextWeek(loads, today), days: zoneDays(loads, today, from),
    bySource: minutesBySource(loads, today),
  };
}

/** Minutes rounded to the nearest 5 for display ("d'habitude 4 h", not "3 h 58"). */
export const roundMinutes5 = (minutes: number) => Math.round(minutes / 5) * 5;

export type GaugeGeometry = {
  /** Where the zone starts and ends, the habit and the last 7 days sit, as % of the gauge width. */
  low: number; high: number; habit: number; marker: number;
  /** The last 7 days run past the right end of the gauge (drawn at the end). */
  overflow: boolean;
};

/** The headline gauge: 0 to 1.8 × the habit, so the three zones keep the same widths for everyone. */
export function gaugeGeometry(last7: number, habit: Habit): GaugeGeometry {
  const top = habit.minutes * 1.8;
  const pct = (v: number) => Math.round(Math.min(100, Math.max(0, (v / top) * 100)) * 10) / 10;
  return { low: pct(habit.low), high: pct(habit.high), habit: pct(habit.minutes), marker: pct(last7), overflow: last7 > top };
}
