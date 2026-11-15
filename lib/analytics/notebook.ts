import type { GradeSystem } from "@/lib/climbing/types";
import { gradeRank, isBoardSend, type Board, type BoardScale } from "@/lib/climbing/boards";
import { isClean, routeGradeIndex, type RouteStyle } from "@/lib/climbing/routes";
import { gradeToScore } from "@/lib/grading/ordering";
import type { BoardAscentFact } from "./boards";
import type { RouteAscentFact } from "./routes";
import { startOfIsoWeekUtc } from "./progress";
import { DAY_MS, type AttemptFact, type ProblemFact } from "./types";

/**
 * The Progress notebook: best recorded performances, weekly series that can be
 * laid one above the other, and what the climber said held them back. Native
 * grades only, never converted between scales.
 */

const isSend = (r: AttemptFact["result"]) => r === "TOP" || r === "FLASH";
const day = (d: Date) => d.toISOString().slice(0, 10);

// ── Best performances ──────────────────────────────────────────────────────

export type BoulderBest = { system: GradeSystem; grade: string; date: string; flash: boolean; sends: number };

/** Hardest boulder sent on each ordered grading system, with the day of its first send. Most used system first. */
export function boulderBests(problems: readonly ProblemFact[], attempts: readonly AttemptFact[]): BoulderBest[] {
  const byId = new Map(problems.map((p) => [p.id, p]));
  const firstSend = new Map<string, AttemptFact>();
  for (const a of [...attempts].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())) {
    if (isSend(a.result) && !firstSend.has(a.problemId)) firstSend.set(a.problemId, a);
  }
  const bySystem = new Map<GradeSystem, { best: BoulderBest; score: number }>();
  const counts = new Map<GradeSystem, number>();
  for (const [problemId, a] of firstSend) {
    const p = byId.get(problemId);
    if (!p) continue;
    const score = gradeToScore(p.nativeGradeSystem, p.nativeGrade);
    if (score === null) continue;
    counts.set(p.nativeGradeSystem, (counts.get(p.nativeGradeSystem) ?? 0) + 1);
    const cur = bySystem.get(p.nativeGradeSystem);
    if (!cur || score > cur.score) {
      bySystem.set(p.nativeGradeSystem, { score, best: { system: p.nativeGradeSystem, grade: p.nativeGrade, date: day(a.createdAt), flash: a.result === "FLASH", sends: 0 } });
    }
  }
  return [...bySystem.values()].map(({ best }) => ({ ...best, sends: counts.get(best.system) ?? 0 }))
    .sort((a, b) => b.sends - a.sends);
}

export type RouteBest = { grade: string; style: RouteStyle; result: RouteAscentFact["result"]; date: string };

/** Hardest route climbed cleanly (lead preferred on equal grade), or null. */
export function routeBest(ascents: readonly RouteAscentFact[]): RouteBest | null {
  let best: RouteAscentFact | null = null;
  for (const a of ascents) {
    if (!isClean(a.result)) continue;
    const better = !best || routeGradeIndex(a.grade) > routeGradeIndex(best.grade)
      || (routeGradeIndex(a.grade) === routeGradeIndex(best.grade) && a.style === "LEAD" && best.style !== "LEAD");
    if (better) best = a;
  }
  return best ? { grade: best.grade, style: best.style, result: best.result, date: day(best.createdAt) } : null;
}

export type BoardBest = { board: Board; grade: string; scale: BoardScale; angle: number; date: string };

/** Hardest board climb sent on each board, in the scale the board used most. */
export function boardBests(facts: readonly BoardAscentFact[]): BoardBest[] {
  const out: BoardBest[] = [];
  const boards = [...new Set(facts.map((f) => f.board))];
  for (const board of boards) {
    const sends = facts.filter((f) => f.board === board && isBoardSend(f.result));
    if (!sends.length) continue;
    const scaleCount = new Map<BoardScale, number>();
    for (const f of sends) scaleCount.set(f.gradeScale, (scaleCount.get(f.gradeScale) ?? 0) + 1);
    const scale = [...scaleCount.entries()].sort((a, b) => b[1] - a[1])[0][0];
    const best = sends.filter((f) => f.gradeScale === scale)
      .sort((a, b) => gradeRank(scale, b.grade) - gradeRank(scale, a.grade) || a.climbedAt.getTime() - b.climbedAt.getTime())[0];
    out.push({ board, grade: best.grade, scale, angle: best.angle, date: day(best.climbedAt) });
  }
  return out.sort((a, b) => a.board.localeCompare(b.board));
}

export type HangSet = { loadKg: number; edgeMm: number | null; seconds: number | null; date: string };
export type HangBest = HangSet & { sets: number };

/** The edge the climber hangs on most, so loads are compared on one edge only. */
export function mainEdge(sets: readonly HangSet[]): number | null {
  const counts = new Map<number | null, number>();
  for (const s of sets) counts.set(s.edgeMm, (counts.get(s.edgeMm) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

/** Heaviest load held on the main edge (added weight, as recorded), with the number of sets on that edge. */
export function hangBest(sets: readonly HangSet[]): HangBest | null {
  if (!sets.length) return null;
  const edge = mainEdge(sets);
  const onEdge = sets.filter((s) => s.edgeMm === edge);
  const best = [...onEdge].sort((a, b) => b.loadKg - a.loadKg || a.date.localeCompare(b.date))[0];
  return { ...best, sets: onEdge.length };
}

// ── Weekly series ──────────────────────────────────────────────────────────

/** One value per week (weeks without data are left out); `week` counts from the first week of the period. */
export type WeeklyPoint = { week: number; value: number; label: string };

/** Week index of a day inside a period of `weeks` ISO weeks ending with today's week, or null outside it. */
export function weekIndex(date: string, today: string, weeks: number): number | null {
  const last = startOfIsoWeekUtc(new Date(today + "T12:00:00Z")).getTime();
  const at = startOfIsoWeekUtc(new Date(date + "T12:00:00Z")).getTime();
  const i = weeks - 1 - Math.round((last - at) / (7 * DAY_MS));
  return i >= 0 && i < weeks ? i : null;
}

/** The highest value of each week (a grade score, a load). */
export function weeklyMax(items: readonly { date: string; value: number; label: string }[], today: string, weeks: number): WeeklyPoint[] {
  const best = new Map<number, WeeklyPoint>();
  for (const it of items) {
    const w = weekIndex(it.date, today, weeks);
    if (w === null) continue;
    const cur = best.get(w);
    if (!cur || it.value > cur.value) best.set(w, { week: w, value: it.value, label: it.label });
  }
  return [...best.values()].sort((a, b) => a.week - b.week);
}

/** Route grades sent cleanly each week, as a route grade index. */
export function weeklyRouteLevel(ascents: readonly RouteAscentFact[], today: string, weeks: number): WeeklyPoint[] {
  return weeklyMax(ascents.filter((a) => isClean(a.result))
    .map((a) => ({ date: day(a.createdAt), value: routeGradeIndex(a.grade), label: a.grade })), today, weeks);
}

/** Heaviest load per week on the main edge. */
export function weeklyHang(sets: readonly HangSet[], today: string, weeks: number): WeeklyPoint[] {
  const edge = mainEdge(sets);
  return weeklyMax(sets.filter((s) => s.edgeMm === edge)
    .map((s) => ({ date: s.date, value: s.loadKg, label: `${s.loadKg > 0 ? "+" : ""}${s.loadKg} kg` })), today, weeks);
}

// ── What held the climber back ─────────────────────────────────────────────

export const LIMITERS = ["STRENGTH", "ENDURANCE", "TECHNIQUE", "FLEXIBILITY", "MOBILITY", "ENGAGEMENT", "PAIN", "FATIGUE"] as const;
export type Limiter = (typeof LIMITERS)[number];

export const isLimiter = (v: unknown): v is Limiter => (LIMITERS as readonly unknown[]).includes(v);

export type LimiterCount = { limiter: Limiter; sessions: number };

/** In how many climbing sessions since `since` each limiter was ticked, most frequent first (unticked ones left out). */
export function limiterCounts(sessions: readonly { date: string; limiters: readonly string[] }[], since: string): { rows: LimiterCount[]; sessions: number } {
  const recent = sessions.filter((s) => s.date >= since);
  const rows = LIMITERS.map((limiter) => ({ limiter, sessions: recent.filter((s) => s.limiters.includes(limiter)).length }))
    .filter((r) => r.sessions > 0)
    .sort((a, b) => b.sessions - a.sessions || LIMITERS.indexOf(a.limiter) - LIMITERS.indexOf(b.limiter));
  return { rows, sessions: recent.filter((s) => s.limiters.some(isLimiter)).length };
}

// ── Hips ───────────────────────────────────────────────────────────────────

export type HipLevels = { date: string; levels: Record<"A" | "B" | "C", number | null> };

/** The latest hip assessment: each core test's level on the weaker side (self-reported, 0–4), or null without one. */
export function latestHipLevels(points: readonly { date: string; results: readonly { test: string; level: number | null }[] }[]): HipLevels | null {
  const latest = [...points].sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!latest) return null;
  const weaker = (test: "A" | "B" | "C") => {
    const levels = latest.results.filter((r) => r.test === test && r.level !== null).map((r) => r.level!);
    return levels.length ? Math.min(...levels) : null;
  };
  return { date: latest.date, levels: { A: weaker("A"), B: weaker("B"), C: weaker("C") } };
}
