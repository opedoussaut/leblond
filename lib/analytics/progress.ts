import type { GradeSystem } from "@/lib/climbing/types";
import { gradeToScore, isOrderedSystem, isReliable, resolveNormalized } from "@/lib/grading";
import { attemptsInWindow, computeProblemOutcomes, countActivity } from "./outcomes";
import { DAY_MS, type AttemptFact, type ProblemFact, type SessionFact } from "./types";

/* ───────────────────────── Recent trend ───────────────────────── */

export type TrendDirection = "improving" | "stable" | "declining" | "insufficient_data";

export interface TrendRule {
  windowDays: number;
  topN: number;
  minSendsPerWindow: number;
  /** Minimum change in mean ordinal (grade steps) to call a direction. */
  threshold: number;
}

export const DEFAULT_TREND_RULE: TrendRule = { windowDays: 30, topN: 5, minSendsPerWindow: 3, threshold: 0.5 };

export interface TrendResult {
  scale: GradeSystem | "FONT_NORMALIZED";
  direction: TrendDirection;
  /** Mean ordinal of the top-N sends in the recent window (grade steps). */
  recentScore: number | null;
  previousScore: number | null;
  recentSends: number;
  previousSends: number;
  rule: TrendRule;
}

function topNMean(scores: number[], n: number): number | null {
  if (scores.length === 0) return null;
  const top = [...scores].sort((a, b) => b - a).slice(0, n);
  return top.reduce((s, x) => s + x, 0) / top.length;
}

function sentScores(
  attempts: AttemptFact[],
  scoreOf: Map<string, number>,
): number[] {
  const outcomes = computeProblemOutcomes(attempts.filter((a) => scoreOf.has(a.problemId)));
  return [...outcomes.values()].filter((o) => o.sent).map((o) => scoreOf.get(o.problemId)!);
}

/**
 * Compares the hardest sends of the last `windowDays` with the preceding
 * window of the same length, on one grading scale. A direction is only called
 * when both windows have enough sends and the change exceeds the threshold.
 */
export function calculateRecentTrend(
  scale: GradeSystem | "FONT_NORMALIZED",
  problems: ProblemFact[],
  attempts: AttemptFact[],
  now: Date,
  rule: TrendRule = DEFAULT_TREND_RULE,
): TrendResult {
  const scoreOf = new Map<string, number>();
  for (const p of problems) {
    if (scale === "FONT_NORMALIZED") {
      const est = resolveNormalized(p);
      if (isReliable(est)) scoreOf.set(p.id, gradeToScore("FONT", est.grade)!);
    } else if (p.nativeGradeSystem === scale && isOrderedSystem(scale)) {
      const s = gradeToScore(scale, p.nativeGrade);
      if (s !== null) scoreOf.set(p.id, s);
    }
  }
  const end = new Date(now.getTime() + 1);
  const mid = new Date(now.getTime() - rule.windowDays * DAY_MS);
  const start = new Date(now.getTime() - 2 * rule.windowDays * DAY_MS);
  const recent = sentScores(attemptsInWindow(attempts, mid, end), scoreOf);
  const previous = sentScores(attemptsInWindow(attempts, start, mid), scoreOf);
  const recentScore = topNMean(recent, rule.topN);
  const previousScore = topNMean(previous, rule.topN);

  let direction: TrendDirection = "insufficient_data";
  if (
    recent.length >= rule.minSendsPerWindow &&
    previous.length >= rule.minSendsPerWindow &&
    recentScore !== null &&
    previousScore !== null
  ) {
    const delta = recentScore - previousScore;
    direction = delta >= rule.threshold ? "improving" : delta <= -rule.threshold ? "declining" : "stable";
  }
  return {
    scale,
    direction,
    recentScore,
    previousScore,
    recentSends: recent.length,
    previousSends: previous.length,
    rule,
  };
}

/* ───────────────────────── Sessions over time ───────────────────────── */

export interface WeekBucket {
  /** Monday 00:00 UTC of the week, ISO date string (YYYY-MM-DD). */
  weekStart: string;
  sessions: number;
  attempts: number;
  tops: number;
  flashes: number;
}

export function startOfIsoWeekUtc(d: Date): Date {
  const day = (d.getUTCDay() + 6) % 7; // Monday = 0
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - day));
}

/** Weekly activity for the last `weeks` weeks, oldest first, including empty weeks. */
export function calculateWeeklyActivity(
  sessions: SessionFact[],
  attempts: AttemptFact[],
  now: Date,
  weeks = 12,
): WeekBucket[] {
  const currentWeek = startOfIsoWeekUtc(now);
  const buckets: WeekBucket[] = [];
  for (let i = weeks - 1; i >= 0; i--) {
    const start = new Date(currentWeek.getTime() - i * 7 * DAY_MS);
    const end = new Date(start.getTime() + 7 * DAY_MS);
    const weekAttempts = attemptsInWindow(attempts, start, end);
    const activity = countActivity(weekAttempts);
    buckets.push({
      weekStart: start.toISOString().slice(0, 10),
      sessions: sessions.filter((s) => s.startedAt >= start && s.startedAt < end).length,
      attempts: activity.attempts,
      tops: activity.tops,
      flashes: activity.flashes,
    });
  }
  return buckets;
}

export interface SessionTops {
  sessionId: string;
  startedAt: Date;
  tops: number;
  attempts: number;
}

/** Tops (problems sent in that session) per session, plus the mean over completed sessions. */
export function calculateTopsPerSession(
  sessions: SessionFact[],
  attempts: AttemptFact[],
): { perSession: SessionTops[]; mean: number | null } {
  const perSession = sessions
    .filter((s) => s.endedAt !== null)
    .map((s) => {
      const sa = attempts.filter((a) => a.sessionId === s.id);
      return { sessionId: s.id, startedAt: s.startedAt, tops: countActivity(sa).tops, attempts: sa.length };
    })
    .sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  const mean = perSession.length ? perSession.reduce((s, x) => s + x.tops, 0) / perSession.length : null;
  return { perSession, mean };
}
