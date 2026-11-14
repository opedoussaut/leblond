import type { GradeSystem } from "@/lib/climbing/types";
import { gradeToScore } from "@/lib/grading/ordering";
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

/** The system most of the period's attempted problems are graded on, among those with an order. */
export function mainSystem(problems: readonly ProblemFact[], attempts: readonly AttemptFact[], candidates: readonly GradeSystem[]): GradeSystem | null {
  const tried = new Set(attempts.map((a) => a.problemId));
  const count = new Map<GradeSystem, number>();
  for (const p of problems) {
    if (tried.has(p.id) && candidates.includes(p.nativeGradeSystem)) count.set(p.nativeGradeSystem, (count.get(p.nativeGradeSystem) ?? 0) + 1);
  }
  return [...count].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}
