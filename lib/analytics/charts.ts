import type { GradeSystem } from "@/lib/climbing/types";
import { gradeToScore } from "@/lib/grading/ordering";
import { SUPPORT_METHOD_IDS } from "@/lib/training/assessment";
import { computeProblemOutcomes } from "./outcomes";
import { startOfIsoWeekUtc } from "./progress";
import { DAY_MS, type AttemptFact, type ProblemFact } from "./types";

/**
 * Figures for the Progress diagrams. Only recorded sends on the grade the
 * climber logged (native grades, no estimate), so a diagram never shows more
 * than the log says.
 */

const isSend = (r: AttemptFact["result"]) => r === "TOP" || r === "FLASH";

export type LevelPoint = { weekStart: string; grade: string; score: number; sends: number };

/**
 * The hardest boulder sent each week, on one grading system. Weeks without a
 * send on that system are left out (a gap, not a drop to zero). A problem
 * counts in the week of its first send.
 */
export function weeklyHardest(
  problems: readonly ProblemFact[], attempts: readonly AttemptFact[], system: GradeSystem, now: Date, days: number | null,
): LevelPoint[] {
  const graded = new Map<string, { grade: string; score: number }>();
  for (const p of problems) {
    if (p.nativeGradeSystem !== system) continue;
    const score = gradeToScore(system, p.nativeGrade);
    if (score !== null) graded.set(p.id, { grade: p.nativeGrade, score });
  }
  const since = days === null ? -Infinity : now.getTime() - days * DAY_MS;
  const firstSend = new Map<string, Date>();
  for (const a of [...attempts].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())) {
    if (graded.has(a.problemId) && isSend(a.result) && !firstSend.has(a.problemId)) firstSend.set(a.problemId, a.createdAt);
  }
  const weeks = new Map<string, LevelPoint>();
  for (const [id, at] of firstSend) {
    if (at.getTime() < since || at > now) continue;
    const week = startOfIsoWeekUtc(at).toISOString().slice(0, 10);
    const g = graded.get(id)!;
    const cur = weeks.get(week);
    if (!cur) weeks.set(week, { weekStart: week, grade: g.grade, score: g.score, sends: 1 });
    else weeks.set(week, { ...cur, sends: cur.sends + 1, ...(g.score > cur.score ? { grade: g.grade, score: g.score } : {}) });
  }
  return [...weeks.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

export type PyramidRow = { grade: string; score: number; sent: number; flashed: number; tried: number };

/**
 * Sends per grade, hardest first: sent (of which flashed) and tried but not
 * sent yet, on one grading system, over problems attempted in the period.
 */
export function gradePyramid(
  problems: readonly ProblemFact[], attempts: readonly AttemptFact[], system: GradeSystem, now: Date, days: number | null,
): PyramidRow[] {
  const since = days === null ? -Infinity : now.getTime() - days * DAY_MS;
  const inPeriod = attempts.filter((a) => a.createdAt.getTime() >= since && a.createdAt <= now);
  const outcomes = computeProblemOutcomes(inPeriod);
  const rows = new Map<string, PyramidRow>();
  for (const p of problems) {
    if (p.nativeGradeSystem !== system) continue;
    const o = outcomes.get(p.id);
    const score = gradeToScore(system, p.nativeGrade);
    if (!o || score === null) continue;
    const row = rows.get(p.nativeGrade) ?? { grade: p.nativeGrade, score, sent: 0, flashed: 0, tried: 0 };
    if (o.sent) row.sent += 1; else row.tried += 1;
    if (o.flashed) row.flashed += 1;
    rows.set(p.nativeGrade, row);
  }
  return [...rows.values()].sort((a, b) => b.score - a.score);
}

export type TopLevelWeek = { weekStart: string; tried: number; sent: number };
export type TopLevelWindow = { tried: number; sent: number; rate: number | null };
export type TopLevelSeries = {
  system: GradeSystem;
  /** The climber's two hardest grades with a send in the period, hardest first (one when nothing easier was tried). */
  levels: string[];
  /** Every week of the period, oldest first: problems tried at those grades that week, and how many were sent that week. */
  weeks: TopLevelWeek[];
  /** For each of those weeks, the send rate over the four weeks ending with it (null without a try); smoother than week by week. */
  rolling: Array<number | null>;
  /** The last four weeks and the four before, counted per problem. */
  recent: TopLevelWindow; previous: TopLevelWindow;
  /** up / down when both windows have TOP_LEVEL_MIN problems and the rate moved by 10 points or more. */
  direction: "up" | "flat" | "down" | "insufficient";
};

/** Problems a window needs before its rate is compared; and the move in send rate that counts. */
export const TOP_LEVEL_MIN = 5;
export const TOP_LEVEL_MOVE = 0.1;

/**
 * The send rate at the climber's top two grades, week by week, on each native
 * scale: coarse colour circuits show progress here even when the hardest
 * grade sent stays the same (Rouge 3/10 → 6/10). Grades are never merged or
 * converted; the two grades are fixed for the whole period so the weeks compare.
 */
export function topLevelRates(
  problems: readonly ProblemFact[], attempts: readonly AttemptFact[], systems: readonly GradeSystem[], now: Date, weeks: number,
): TopLevelSeries[] {
  const currentWeek = startOfIsoWeekUtc(now).getTime();
  const firstWeek = currentWeek - (weeks - 1) * 7 * DAY_MS;
  const inPeriod = attempts.filter((a) => a.createdAt.getTime() >= firstWeek && a.createdAt <= now);
  const byId = new Map(problems.map((p) => [p.id, p]));
  const out: TopLevelSeries[] = [];
  for (const system of systems) {
    const score = new Map<string, number>();
    const gradeAt = new Map<number, string>();
    for (const a of inPeriod) {
      const p = byId.get(a.problemId);
      if (!p || p.nativeGradeSystem !== system || score.has(p.id)) continue;
      const s = gradeToScore(system, p.nativeGrade);
      if (s !== null) { score.set(p.id, s); gradeAt.set(s, p.nativeGrade); }
    }
    const mine = inPeriod.filter((a) => score.has(a.problemId));
    const sentScores = mine.filter((a) => isSend(a.result)).map((a) => score.get(a.problemId)!);
    if (!sentScores.length) continue;
    const top = Math.max(...sentScores);
    const below = [...new Set(score.values())].filter((s) => s < top).sort((a, b) => b - a)[0];
    const keep = new Set(below === undefined ? [top] : [top, below]);
    const atLevel = mine.filter((a) => keep.has(score.get(a.problemId)!));
    const weekOf = (a: AttemptFact) => startOfIsoWeekUtc(a.createdAt).getTime();
    const list: TopLevelWeek[] = Array.from({ length: weeks }, (_, i) => {
      const start = firstWeek + i * 7 * DAY_MS;
      const these = atLevel.filter((a) => weekOf(a) === start);
      return { weekStart: new Date(start).toISOString().slice(0, 10), tried: new Set(these.map((a) => a.problemId)).size,
        sent: new Set(these.filter((a) => isSend(a.result)).map((a) => a.problemId)).size };
    });
    const window = (fromWeek: number, toWeek: number): TopLevelWindow => {
      const these = atLevel.filter((a) => weekOf(a) >= fromWeek && weekOf(a) <= toWeek);
      const tried = new Set(these.map((a) => a.problemId)).size;
      const sent = new Set(these.filter((a) => isSend(a.result)).map((a) => a.problemId)).size;
      return { tried, sent, rate: tried ? sent / tried : null };
    };
    const recent = window(currentWeek - 3 * 7 * DAY_MS, currentWeek);
    const previous = window(currentWeek - 7 * 7 * DAY_MS, currentWeek - 4 * 7 * DAY_MS);
    const rolling = list.map((_, i) => window(firstWeek + (i - 3) * 7 * DAY_MS, firstWeek + i * 7 * DAY_MS).rate);
    let direction: TopLevelSeries["direction"] = "insufficient";
    if (weeks >= 8 && recent.tried >= TOP_LEVEL_MIN && previous.tried >= TOP_LEVEL_MIN) {
      const move = recent.rate! - previous.rate!;
      direction = move >= TOP_LEVEL_MOVE ? "up" : move <= -TOP_LEVEL_MOVE ? "down" : "flat";
    }
    out.push({ system, levels: [...keep].sort((a, b) => b - a).map((s) => gradeAt.get(s)!), weeks: list, rolling, recent, previous, direction });
  }
  return out.sort((a, b) => b.weeks.reduce((s, w) => s + w.tried, 0) - a.weeks.reduce((s, w) => s + w.tried, 0));
}

/** The system most of the period's attempted problems are graded on, among those with an order. */
export function mainSystem(problems: readonly ProblemFact[], attempts: readonly AttemptFact[], candidates: readonly GradeSystem[]): GradeSystem | null {
  const tried = new Set(attempts.map((a) => a.problemId));
  const count = new Map<GradeSystem, number>();
  for (const p of problems) {
    if (tried.has(p.id) && candidates.includes(p.nativeGradeSystem)) count.set(p.nativeGradeSystem, (count.get(p.nativeGradeSystem) ?? 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

export type WeekTotal = { weekStart: string; sessions: number; minutes: number };

/**
 * Sessions and minutes per week (Monday, local dates), oldest first, ending
 * with the current week; empty weeks included so gaps show as gaps.
 */
export function weeklyTotals(items: ReadonlyArray<{ date: string; minutes: number | null }>, today: string, weeks: number): WeekTotal[] {
  const day = (date: string) => Date.parse(date + "T00:00:00Z");
  const monday = (date: string) => {
    const d = new Date(day(date));
    d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
    return d.toISOString().slice(0, 10);
  };
  const current = monday(today);
  const out: WeekTotal[] = Array.from({ length: weeks }, (_, i) => ({
    weekStart: new Date(day(current) - (weeks - 1 - i) * 7 * DAY_MS).toISOString().slice(0, 10), sessions: 0, minutes: 0,
  }));
  const index = new Map(out.map((w, i) => [w.weekStart, i]));
  for (const item of items) {
    const i = index.get(monday(item.date));
    if (i === undefined || item.date > today) continue;
    out[i].sessions += 1;
    out[i].minutes += item.minutes ?? 0;
  }
  return out;
}

/**
 * Whether a training session is mobility work: its own method is a support
 * method (stretching, hip mobility), or it has no method of its own (a coach
 * session) and at least half of its exercises are support work.
 */
export function isMobilityWork(sessionMethodId: string | null, exerciseMethodIds: readonly (string | null)[]): boolean {
  if (sessionMethodId) return SUPPORT_METHOD_IDS.has(sessionMethodId);
  if (!exerciseMethodIds.length) return false;
  const support = exerciseMethodIds.filter((id) => id !== null && SUPPORT_METHOD_IDS.has(id)).length;
  return support * 2 >= exerciseMethodIds.length;
}
