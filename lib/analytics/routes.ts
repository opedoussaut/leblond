import { ROUTE_RESULTS, isClean, isTopped, routeGradeIndex, type RouteResult, type RouteStyle } from "@/lib/climbing/routes";
import { DAY_MS, ratio, type Ratio } from "./types";
import type { LevelPoint, PyramidRow } from "./charts";
import { startOfIsoWeekUtc, type WeekBucket } from "./progress";

/**
 * Route-climbing analytics. Pure functions over route ascents only — they
 * never read boulder problems, and bouldering analytics never read these.
 */
export interface RouteAscentFact {
  id: string;
  sessionId: string;
  grade: string;
  style: RouteStyle;
  result: RouteResult;
  falls: number | null;
  createdAt: Date;
  /** Climbed at a crag (the séance's site is an outdoor one). Absent: indoors. */
  outdoor?: boolean;
}

export interface RouteSummary {
  ascents: number;
  topped: number;
  clean: number;
  onsights: number;
  flashes: number;
  redpoints: number;
  lead: number;
  toprope: number;
  autobelay: number;
  cleanRate: Ratio;
  /** Highest clean ascent on lead (the reference for sport grades). */
  highestLeadClean: string | null;
  /** Highest clean ascent in any style, with its style. */
  highestClean: { grade: string; style: RouteStyle } | null;
  highestOnsight: string | null;
  /** Clean ascents per grade, hardest first. */
  pyramid: Array<{ grade: string; clean: number; lead: number }>;
}

function hardest<T extends { grade: string }>(list: T[]): T | null {
  return list.reduce<T | null>((best, a) => (!best || routeGradeIndex(a.grade) > routeGradeIndex(best.grade) ? a : best), null);
}

export function summarizeRoutes(ascents: RouteAscentFact[]): RouteSummary {
  const clean = ascents.filter((a) => isClean(a.result));
  const leadClean = clean.filter((a) => a.style === "LEAD");
  const counts = new Map<string, { clean: number; lead: number }>();
  for (const a of clean) {
    const c = counts.get(a.grade) ?? { clean: 0, lead: 0 };
    c.clean++;
    if (a.style === "LEAD") c.lead++;
    counts.set(a.grade, c);
  }
  const best = hardest(clean);
  return {
    ascents: ascents.length,
    topped: ascents.filter((a) => isTopped(a.result)).length,
    clean: clean.length,
    onsights: ascents.filter((a) => a.result === "ONSIGHT").length,
    flashes: ascents.filter((a) => a.result === "FLASH").length,
    redpoints: ascents.filter((a) => a.result === "REDPOINT").length,
    lead: ascents.filter((a) => a.style === "LEAD").length,
    toprope: ascents.filter((a) => a.style === "TOPROPE").length,
    autobelay: ascents.filter((a) => a.style === "AUTOBELAY").length,
    cleanRate: ratio(clean.length, ascents.length),
    highestLeadClean: hardest(leadClean)?.grade ?? null,
    highestClean: best ? { grade: best.grade, style: best.style } : null,
    highestOnsight: hardest(ascents.filter((a) => a.result === "ONSIGHT"))?.grade ?? null,
    pyramid: [...counts.entries()]
      .map(([grade, c]) => ({ grade, ...c }))
      .sort((a, b) => routeGradeIndex(b.grade) - routeGradeIndex(a.grade)),
  };
}

export const ROUTE_WORKING_WINDOW_DAYS = 60;
export const ROUTE_WORKING_MIN_ASCENTS = 6;

/**
 * Observed route working grade: the hardest grade climbed cleanly on LEAD at
 * least twice in the last 60 days. Reported as null (insufficient data) when
 * fewer than 6 ascents were logged in that window. Top-rope and auto-belay
 * ascents are excluded because they are not comparable with lead.
 */
export function routeWorkingGrade(ascents: RouteAscentFact[], now: Date): { grade: string | null; sampleSize: number } {
  const recent = ascents.filter((a) => a.createdAt.getTime() >= now.getTime() - ROUTE_WORKING_WINDOW_DAYS * DAY_MS);
  if (recent.length < ROUTE_WORKING_MIN_ASCENTS) return { grade: null, sampleSize: recent.length };
  const byGrade = new Map<string, number>();
  for (const a of recent) if (a.style === "LEAD" && isClean(a.result)) byGrade.set(a.grade, (byGrade.get(a.grade) ?? 0) + 1);
  const eligible = [...byGrade.entries()].filter(([, n]) => n >= 2).map(([grade]) => ({ grade }));
  return { grade: hardest(eligible)?.grade ?? null, sampleSize: recent.length };
}

export function routeAscentsInLastDays(ascents: RouteAscentFact[], days: number, now: Date): RouteAscentFact[] {
  return ascents.filter((a) => a.createdAt.getTime() >= now.getTime() - days * DAY_MS);
}

export interface RouteProjectProgress {
  ascents: number;
  sessions: number;
  bestResult: RouteResult | null;
  /** Falls on the first and the latest ascent that recorded them (null when unknown). */
  firstFalls: number | null;
  latestFalls: number | null;
  firstDate: string | null;
  latestDate: string | null;
}

/** Progress on one route project, from its linked ascents only. */
export function routeProjectProgress(ascents: RouteAscentFact[]): RouteProjectProgress {
  const sorted = [...ascents].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  const withFalls = sorted.filter((a) => a.falls !== null && !isClean(a.result));
  const best = sorted.reduce<RouteResult | null>((acc, a) =>
    acc === null || ROUTE_RESULTS.indexOf(a.result) < ROUTE_RESULTS.indexOf(acc) ? a.result : acc, null);
  return {
    ascents: sorted.length,
    sessions: new Set(sorted.map((a) => a.sessionId)).size,
    bestResult: best,
    firstFalls: withFalls[0]?.falls ?? null,
    latestFalls: withFalls.at(-1)?.falls ?? null,
    firstDate: sorted[0]?.createdAt.toISOString().slice(0, 10) ?? null,
    latestDate: sorted.at(-1)?.createdAt.toISOString().slice(0, 10) ?? null,
  };
}

// ── Diagrams shared with bouldering (same shapes as lib/analytics/charts) ──


/**
 * The hardest route climbed cleanly each week, as a French route grade index
 * (the same shape as the boulder level curve). Weeks without a clean ascent
 * are left out.
 */
export function routeWeeklyHardest(ascents: readonly RouteAscentFact[], now: Date, days: number | null): LevelPoint[] {
  const since = days === null ? -Infinity : now.getTime() - days * DAY_MS;
  const weeks = new Map<string, LevelPoint>();
  for (const a of ascents) {
    const score = routeGradeIndex(a.grade);
    if (!isClean(a.result) || score < 0 || a.createdAt.getTime() < since || a.createdAt > now) continue;
    const week = startOfIsoWeekUtc(a.createdAt).toISOString().slice(0, 10);
    const cur = weeks.get(week);
    if (!cur) weeks.set(week, { weekStart: week, grade: a.grade, score, sends: 1 });
    else weeks.set(week, { ...cur, sends: cur.sends + 1, ...(score > cur.score ? { grade: a.grade, score } : {}) });
  }
  return [...weeks.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
}

/**
 * Route ascents in the period by grade, hardest first, as in the boulder
 * pyramid: onsight/flash, other clean ascents (redpoint) and tries not yet
 * clean (falls or rests). Routes carry no identity, so each ascent counts once.
 */
export function routePyramid(ascents: readonly RouteAscentFact[], now: Date, days: number | null): PyramidRow[] {
  const since = days === null ? -Infinity : now.getTime() - days * DAY_MS;
  const rows = new Map<string, PyramidRow>();
  for (const a of ascents) {
    const score = routeGradeIndex(a.grade);
    if (score < 0 || a.createdAt.getTime() < since || a.createdAt > now) continue;
    const row = rows.get(a.grade) ?? { grade: a.grade, score, sent: 0, flashed: 0, tried: 0 };
    if (isClean(a.result)) row.sent += 1; else row.tried += 1;
    if (a.result === "ONSIGHT" || a.result === "FLASH") row.flashed += 1;
    rows.set(a.grade, row);
  }
  return [...rows.values()].sort((a, b) => b.score - a.score);
}

/** Route activity per week, oldest first, empty weeks included: sessions, ascents, clean ascents, onsight/flash. */
export function routeWeeklyActivity(ascents: readonly RouteAscentFact[], now: Date, weeks = 12): WeekBucket[] {
  const current = startOfIsoWeekUtc(now);
  return Array.from({ length: weeks }, (_, k) => {
    const start = new Date(current.getTime() - (weeks - 1 - k) * 7 * DAY_MS);
    const end = start.getTime() + 7 * DAY_MS;
    const inWeek = ascents.filter((a) => a.createdAt.getTime() >= start.getTime() && a.createdAt.getTime() < end);
    return {
      weekStart: start.toISOString().slice(0, 10),
      sessions: new Set(inWeek.map((a) => a.sessionId)).size,
      attempts: inWeek.length,
      tops: inWeek.filter((a) => isClean(a.result)).length,
      flashes: inWeek.filter((a) => a.result === "ONSIGHT" || a.result === "FLASH").length,
    };
  });
}
