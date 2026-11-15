import type { GradeSystem } from "@/lib/climbing/types";
import { gradeRank, isBoardSend, type Board, type BoardScale } from "@/lib/climbing/boards";
import { isClean, routeGradeIndex } from "@/lib/climbing/routes";
import { gradeToScore } from "@/lib/grading/ordering";
import type { BoardAscentFact } from "./boards";
import type { HangSet } from "./notebook";
import type { RouteAscentFact } from "./routes";
import { DAY_MS, type AttemptFact, type ProblemFact } from "./types";

/**
 * Training load and progression: how much stress the climber puts on the
 * body day after day (session-RPE load, Foster 2001), the fitness–fatigue
 * picture built from it (Banister's model as popularised by CTL/ATL/TSB, 42-
 * and 7-day exponential averages), the acute:chronic ratio with its band
 * (0.8–1.3, danger above 1.5, Gabbett 2016 — debated, see the page), and a
 * verdict that also looks at performance in each native scale.
 *
 * Climbing sessions carry no RPE: their intensity is estimated from the
 * discipline, how close the attempts were to the climber's own best in the
 * same scale, and the fatigue noted after the session. Every estimate is
 * flagged so the page can say so.
 */

// ── Thresholds ─────────────────────────────────────────────────────────────

export const LOAD_THRESHOLDS = {
  /** Chronic (fitness) and acute (fatigue) time constants, days. */
  chronicDays: 42,
  acuteDays: 7,
  /** Acute:chronic band where fitness builds without a spike (Gabbett 2016). */
  low: 0.8,
  high: 1.3,
  /** Above this ratio injury risk rose clearly in team-sport cohorts (Hulin 2016, Gabbett 2016). */
  danger: 1.5,
  /** Days of history before the ratio is shown: the chronic load needs about four weeks (Gabbett 2016). */
  calibrationDays: 28,
  /** Weekly monotony above 2 went with illness and overreaching (Foster 1998). */
  monotony: 2,
} as const;

// ── Session load ───────────────────────────────────────────────────────────

export type LoadSource = "BOULDER" | "ROUTE" | "BOARD" | "TRAINING" | "MOBILITY";
export const LOAD_SOURCES: readonly LoadSource[] = ["BOULDER", "ROUTE", "BOARD", "TRAINING", "MOBILITY"];
export type Discipline = "BOULDER" | "ROUTE" | "BOARD";

export type ClimbSessionFact = {
  id: string; discipline: Discipline; date: string;
  startedAt: Date; endedAt: Date | null; durationMinutes: number | null;
  /** Fatigue noted after the session, 1–5, or null. */
  fatigue: number | null;
  /** Attempts logged in the session, and how many were close to the climber's best (see nearLimitCounts). */
  attempts: number; nearLimit: number;
};

export type TrainingLoadFact = {
  id: string; date: string; completed: boolean;
  actualMinutes: number | null; plannedMinutes: number | null;
  rpe: number | null; pain: number | null; mobility: boolean;
  /** A guided session done as a climbing session (board): the climbing session carries the load. */
  climbingSessionId: string | null;
};

export type MobilityRecordFact = { date: string; minutes: number | null; rpe?: number | null };

export type SessionLoad = {
  date: string; source: LoadSource; minutes: number; intensity: number; load: number;
  estimated: { minutes: boolean; intensity: boolean };
};

/** Base intensity on the CR-10 scale when nothing better is known. */
const BASE_INTENSITY: Record<LoadSource, number> = { BOULDER: 6, ROUTE: 5, BOARD: 7, TRAINING: 6, MOBILITY: 2 };
/** Minutes assumed when a session has no duration at all. */
const DEFAULT_MINUTES: Record<LoadSource, number> = { BOULDER: 90, ROUTE: 90, BOARD: 60, TRAINING: 45, MOBILITY: 20 };
/** Minutes per logged attempt (try + rest), used when a climbing session has no duration. */
export const MINUTES_PER_ATTEMPT = 4;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const round1 = (v: number) => Math.round(v * 10) / 10;

/** Duration of a climbing session: recorded, else its start–end span, else estimated from attempts. */
export function climbMinutes(s: ClimbSessionFact): { minutes: number; estimated: boolean } {
  if (s.durationMinutes && s.durationMinutes > 0) return { minutes: Math.min(s.durationMinutes, 360), estimated: false };
  if (s.endedAt) {
    const span = Math.round((s.endedAt.getTime() - s.startedAt.getTime()) / 60_000);
    if (span >= 5 && span <= 360) return { minutes: span, estimated: false };
  }
  if (s.attempts > 0) return { minutes: clamp(s.attempts * MINUTES_PER_ATTEMPT, 20, 180), estimated: true };
  return { minutes: DEFAULT_MINUTES[s.discipline], estimated: true };
}

/**
 * Estimated intensity (CR-10) of a climbing session: the discipline's base,
 * up to +2 when every attempt was close to the climber's best, ±1 from the
 * fatigue noted after it (3 = neutral). Kept between 3 and 9.
 */
export function climbIntensity(s: Pick<ClimbSessionFact, "discipline" | "attempts" | "nearLimit" | "fatigue">): number {
  const share = s.attempts > 0 ? s.nearLimit / s.attempts : 0;
  const fatigue = s.fatigue === null ? 0 : (clamp(s.fatigue, 1, 5) - 3) * 0.5;
  return round1(clamp(BASE_INTENSITY[s.discipline] + 2 * share + fatigue, 3, 9));
}

/**
 * Every session as a load in arbitrary units (intensity × minutes). A guided
 * session linked to a climbing session is not counted twice: its RPE, when
 * recorded, replaces the climbing session's estimate.
 */
export function sessionLoads(
  climbs: readonly ClimbSessionFact[], training: readonly TrainingLoadFact[], mobility: readonly MobilityRecordFact[],
): SessionLoad[] {
  const out: SessionLoad[] = [];
  const linkedRpe = new Map<string, number>();
  for (const t of training) if (t.completed && t.climbingSessionId && t.rpe !== null) linkedRpe.set(t.climbingSessionId, t.rpe);
  const climbIds = new Set(climbs.map((c) => c.id));
  for (const c of climbs) {
    const m = climbMinutes(c);
    const rpe = linkedRpe.get(c.id);
    const intensity = rpe ?? climbIntensity(c);
    out.push({ date: c.date, source: c.discipline, minutes: m.minutes, intensity, load: Math.round(intensity * m.minutes),
      estimated: { minutes: m.estimated, intensity: rpe === undefined } });
  }
  for (const t of training) {
    if (!t.completed || (t.climbingSessionId && climbIds.has(t.climbingSessionId))) continue;
    const source: LoadSource = t.mobility ? "MOBILITY" : "TRAINING";
    const recorded = t.actualMinutes && t.actualMinutes > 0 ? t.actualMinutes : null;
    const minutes = recorded ?? (t.plannedMinutes && t.plannedMinutes > 0 ? t.plannedMinutes : DEFAULT_MINUTES[source]);
    const intensity = t.rpe ?? BASE_INTENSITY[source];
    out.push({ date: t.date, source, minutes, intensity, load: Math.round(intensity * minutes),
      estimated: { minutes: recorded === null, intensity: t.rpe === null } });
  }
  for (const r of mobility) {
    const recorded = r.minutes && r.minutes > 0 ? r.minutes : null;
    const minutes = recorded ?? DEFAULT_MINUTES.MOBILITY;
    const intensity = r.rpe ?? BASE_INTENSITY.MOBILITY;
    out.push({ date: r.date, source: "MOBILITY", minutes, intensity, load: Math.round(intensity * minutes),
      estimated: { minutes: recorded === null, intensity: r.rpe == null } });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Share of sessions in a list whose minutes or intensity were estimated, per source. */
export function estimateShares(loads: readonly SessionLoad[]): { source: LoadSource; sessions: number; minutes: number; intensity: number }[] {
  return LOAD_SOURCES.flatMap((source) => {
    const list = loads.filter((l) => l.source === source);
    if (!list.length) return [];
    return [{ source, sessions: list.length,
      minutes: list.filter((l) => l.estimated.minutes).length / list.length,
      intensity: list.filter((l) => l.estimated.intensity).length / list.length }];
  });
}

// ── Attempts close to the climber's limit ──────────────────────────────────

/** One attempt (or a board climb's tries) on a scale, for nearLimitCounts. */
export type ScaledAttempt = { sessionId: string; scale: string; score: number; at: Date; sent: boolean; tries: number; tolerance: number };

/**
 * For each session, attempts made within `tolerance` grade steps of the
 * climber's best send on the same scale over the previous 90 days (that day
 * included). Scales are never mixed: a colour circuit, Font, the French route
 * scale and each board scale each have their own best.
 */
export function nearLimitCounts(items: readonly ScaledAttempt[], windowDays = 90): Map<string, { attempts: number; nearLimit: number }> {
  const sends = new Map<string, { at: number; score: number }[]>();
  for (const it of items) if (it.sent) {
    const list = sends.get(it.scale) ?? [];
    list.push({ at: it.at.getTime(), score: it.score });
    sends.set(it.scale, list);
  }
  const out = new Map<string, { attempts: number; nearLimit: number }>();
  for (const it of items) {
    const t = it.at.getTime();
    const endOfDay = t - (t % DAY_MS) + DAY_MS;
    let best = -Infinity;
    for (const s of sends.get(it.scale) ?? []) if (s.at < endOfDay && s.at >= t - windowDays * DAY_MS && s.score > best) best = s.score;
    const cur = out.get(it.sessionId) ?? { attempts: 0, nearLimit: 0 };
    cur.attempts += it.tries;
    if (best > -Infinity && it.score >= best - it.tolerance) cur.nearLimit += it.tries;
    out.set(it.sessionId, cur);
  }
  return out;
}

const isSend = (r: AttemptFact["result"]) => r === "TOP" || r === "FLASH";

/** Boulder attempts on ordered systems, as scaled attempts (one grade of tolerance). */
export function boulderScaledAttempts(problems: readonly ProblemFact[], attempts: readonly AttemptFact[]): ScaledAttempt[] {
  const byId = new Map(problems.map((p) => [p.id, p]));
  return attempts.flatMap((a) => {
    const p = byId.get(a.problemId);
    const score = p ? gradeToScore(p.nativeGradeSystem, p.nativeGrade) : null;
    if (!p || score === null) return [];
    return [{ sessionId: a.sessionId, scale: `B:${p.nativeGradeSystem}`, score, at: a.createdAt, sent: isSend(a.result), tries: 1, tolerance: 1 }];
  });
}

/** Route ascents as scaled attempts on the French scale (two sub-grades of tolerance: 6a+ and 6b are near a 6b best). */
export function routeScaledAttempts(ascents: readonly RouteAscentFact[]): ScaledAttempt[] {
  return ascents.flatMap((a) => {
    const score = routeGradeIndex(a.grade);
    return score < 0 ? [] : [{ sessionId: a.sessionId, scale: "R", score, at: a.createdAt, sent: isClean(a.result), tries: 1, tolerance: 2 }];
  });
}

/** Board climbs as scaled attempts, one scale per board and grading scale, weighted by tries. */
export function boardScaledAttempts(facts: readonly BoardAscentFact[]): ScaledAttempt[] {
  return facts.flatMap((f) => {
    const score = gradeRank(f.gradeScale, f.grade);
    return score < 0 ? [] : [{ sessionId: f.sessionId, scale: `K:${f.board}:${f.gradeScale}`, score, at: f.climbedAt,
      sent: isBoardSend(f.result), tries: Math.max(1, f.tries), tolerance: 1 }];
  });
}

// ── Daily series and the fitness–fatigue model ─────────────────────────────

const addDays = (date: string, n: number) => new Date(Date.parse(date + "T00:00:00Z") + n * DAY_MS).toISOString().slice(0, 10);
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b + "T00:00:00Z") - Date.parse(a + "T00:00:00Z")) / DAY_MS);

export type LoadDay = {
  date: string; load: number;
  /** Chronic load (42-day exponential average): "fitness". */
  fitness: number;
  /** Acute load (7-day exponential average): "fatigue". */
  fatigue: number;
  /** Fitness − fatigue: positive = fresh, negative = tired. */
  form: number;
  /** Acute ÷ chronic, null while calibrating or without chronic load. */
  ratio: number | null;
};

/**
 * Day-by-day load model from the first recorded day to `today` (empty days
 * count as zero load). Exponential averages as in Banister's model:
 * value += (load − value) / timeConstant.
 */
export function loadModel(loads: readonly SessionLoad[], today: string): LoadDay[] {
  const valid = loads.filter((l) => l.date <= today);
  if (!valid.length) return [];
  const byDay = new Map<string, number>();
  for (const l of valid) byDay.set(l.date, (byDay.get(l.date) ?? 0) + l.load);
  const first = valid.reduce((m, l) => (l.date < m ? l.date : m), valid[0].date);
  const days = daysBetween(first, today);
  const out: LoadDay[] = [];
  let fitness = 0, fatigue = 0;
  for (let i = 0; i <= days; i++) {
    const date = addDays(first, i);
    const load = byDay.get(date) ?? 0;
    fitness += (load - fitness) / LOAD_THRESHOLDS.chronicDays;
    fatigue += (load - fatigue) / LOAD_THRESHOLDS.acuteDays;
    const calibrated = i + 1 >= LOAD_THRESHOLDS.calibrationDays && fitness > 0.5;
    out.push({ date, load, fitness: round1(fitness), fatigue: round1(fatigue), form: round1(fitness - fatigue),
      ratio: calibrated ? Math.round((fatigue / fitness) * 100) / 100 : null });
  }
  return out;
}

export type LoadZone = "calibrating" | "under" | "optimal" | "high" | "danger";

/** Where an acute:chronic ratio sits in the band. */
export function loadZone(ratio: number | null): LoadZone {
  if (ratio === null) return "calibrating";
  if (ratio < LOAD_THRESHOLDS.low) return "under";
  if (ratio <= LOAD_THRESHOLDS.high) return "optimal";
  if (ratio <= LOAD_THRESHOLDS.danger) return "high";
  return "danger";
}

/**
 * The next `days` days if the climber keeps the average daily load of the
 * last 28 days: fitness and fatigue carried forward with the same model.
 */
export function projectLoad(model: readonly LoadDay[], days = 14): { daily: number; points: LoadDay[] } {
  const last = model.at(-1);
  if (!last) return { daily: 0, points: [] };
  const window = model.slice(-28);
  const daily = window.reduce((s, d) => s + d.load, 0) / window.length;
  let fitness = last.fitness, fatigue = last.fatigue;
  const points: LoadDay[] = [];
  for (let i = 1; i <= days; i++) {
    fitness += (daily - fitness) / LOAD_THRESHOLDS.chronicDays;
    fatigue += (daily - fatigue) / LOAD_THRESHOLDS.acuteDays;
    points.push({ date: addDays(last.date, i), load: round1(daily), fitness: round1(fitness), fatigue: round1(fatigue),
      form: round1(fitness - fatigue), ratio: fitness > 0.5 && last.ratio !== null ? Math.round((fatigue / fitness) * 100) / 100 : null });
  }
  return { daily: round1(daily), points };
}

export type WeeklyGuide = {
  /** Weekly load that keeps the ratio between the band's limits (about 7 × chronic × limit). */
  minLoad: number; maxLoad: number; dangerLoad: number;
  /** The same range in sessions like the climber's typical one (median of the last 42 days), or null. */
  typicalLoad: number | null; minSessions: number | null; maxSessions: number | null;
  /** Load already done in the last 7 days. */
  last7: number;
};

/** The week ahead, in load and in typical sessions, from today's chronic load. Null while calibrating. */
export function weeklyGuide(model: readonly LoadDay[], loads: readonly SessionLoad[], today: string): WeeklyGuide | null {
  const last = model.at(-1);
  if (!last || last.ratio === null) return null;
  const weekly = (k: number) => Math.round(7 * last.fitness * k);
  const since = addDays(today, -41);
  const recent = loads.filter((l) => l.date >= since && l.date <= today && l.source !== "MOBILITY").map((l) => l.load).sort((a, b) => a - b);
  const typical = recent.length ? recent[Math.floor((recent.length - 1) / 2)] : null;
  const last7 = model.slice(-7).reduce((s, d) => s + d.load, 0);
  const toSessions = (v: number) => (typical ? Math.round((v / typical) * 2) / 2 : null);
  return {
    minLoad: weekly(LOAD_THRESHOLDS.low), maxLoad: weekly(LOAD_THRESHOLDS.high), dangerLoad: weekly(LOAD_THRESHOLDS.danger),
    typicalLoad: typical, minSessions: toSessions(weekly(LOAD_THRESHOLDS.low)), maxSessions: toSessions(weekly(LOAD_THRESHOLDS.high)), last7,
  };
}

/** Foster's monotony over the last 7 days (mean ÷ standard deviation of daily load), null without load or variation. */
export function monotony(model: readonly LoadDay[]): number | null {
  const week = model.slice(-7).map((d) => d.load);
  if (week.length < 7) return null;
  const mean = week.reduce((s, v) => s + v, 0) / 7;
  if (mean <= 0) return null;
  const sd = Math.sqrt(week.reduce((s, v) => s + (v - mean) ** 2, 0) / 7);
  return sd === 0 ? null : Math.round((mean / sd) * 100) / 100;
}

// ── Performance in each native scale ───────────────────────────────────────

export type PerfKind = "boulder" | "route" | "board" | "hang";
export type PerfPoint = { date: string; score: number; display: string };
export type PerfSeries = {
  key: string; kind: PerfKind;
  system?: GradeSystem; board?: Board; scale?: BoardScale; edgeMm?: number | null;
  /** Change in the top-3 average needed to call it a real move (grade steps, or kg). */
  threshold: number;
  points: PerfPoint[];
};

/** First send of each boulder per ordered system, one series per system. */
export function boulderPerf(problems: readonly ProblemFact[], attempts: readonly AttemptFact[]): PerfSeries[] {
  const byId = new Map(problems.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const bySystem = new Map<GradeSystem, PerfPoint[]>();
  for (const a of [...attempts].sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime())) {
    if (!isSend(a.result) || seen.has(a.problemId)) continue;
    seen.add(a.problemId);
    const p = byId.get(a.problemId);
    const score = p ? gradeToScore(p.nativeGradeSystem, p.nativeGrade) : null;
    if (!p || score === null) continue;
    const list = bySystem.get(p.nativeGradeSystem) ?? [];
    list.push({ date: a.createdAt.toISOString().slice(0, 10), score, display: p.nativeGrade });
    bySystem.set(p.nativeGradeSystem, list);
  }
  return [...bySystem].map(([system, points]) => ({ key: `boulder:${system}`, kind: "boulder" as const, system, threshold: 0.5, points }));
}

/** Clean route ascents on the French scale. */
export function routePerf(ascents: readonly RouteAscentFact[]): PerfSeries[] {
  const points = ascents.filter((a) => isClean(a.result) && routeGradeIndex(a.grade) >= 0)
    .map((a) => ({ date: a.createdAt.toISOString().slice(0, 10), score: routeGradeIndex(a.grade), display: a.grade }));
  return points.length ? [{ key: "route", kind: "route", threshold: 1, points }] : [];
}

/** Board sends, one series per board and scale. */
export function boardPerf(facts: readonly BoardAscentFact[]): PerfSeries[] {
  const groups = new Map<string, PerfSeries>();
  for (const f of facts) {
    const score = gradeRank(f.gradeScale, f.grade);
    if (!isBoardSend(f.result) || score < 0) continue;
    const key = `board:${f.board}:${f.gradeScale}`;
    const g = groups.get(key) ?? { key, kind: "board" as const, board: f.board, scale: f.gradeScale, threshold: 0.5, points: [] };
    g.points.push({ date: f.climbedAt.toISOString().slice(0, 10), score, display: f.grade });
    groups.set(key, g);
  }
  return [...groups.values()];
}

/** Hang loads on the climber's main edge (added kg, as recorded). */
export function hangPerf(sets: readonly HangSet[], edgeMm: number | null): PerfSeries[] {
  const points = sets.filter((s) => s.edgeMm === edgeMm)
    .map((s) => ({ date: s.date, score: s.loadKg, display: `${s.loadKg > 0 ? "+" : ""}${s.loadKg} kg` }));
  return points.length ? [{ key: "hang", kind: "hang", edgeMm, threshold: 2, points }] : [];
}

export type PerfDirection = "up" | "flat" | "down" | "insufficient";
export type PerfTrend = {
  key: string; kind: PerfKind; series: PerfSeries;
  /** Average of the three best results in each window, in the series' own steps. */
  recent: number | null; previous: number | null;
  recentBest: PerfPoint | null; previousBest: PerfPoint | null;
  recentCount: number; previousCount: number;
  direction: PerfDirection;
};

const top3 = (pts: PerfPoint[]) => {
  const best = [...pts].sort((a, b) => b.score - a.score).slice(0, 3);
  return best.length ? best.reduce((s, p) => s + p.score, 0) / best.length : null;
};

/**
 * Each scale's last `windowDays` against the `windowDays` before: the average
 * of the three best results in each window. A scale needs at least one result
 * in both windows to have a direction.
 */
export function performanceTrends(series: readonly PerfSeries[], today: string, windowDays = 42): PerfTrend[] {
  const recentFrom = addDays(today, -(windowDays - 1));
  const previousFrom = addDays(today, -(2 * windowDays - 1));
  return series.map((s) => {
    const recentPts = s.points.filter((p) => p.date >= recentFrom && p.date <= today);
    const previousPts = s.points.filter((p) => p.date >= previousFrom && p.date < recentFrom);
    const recent = top3(recentPts), previous = top3(previousPts);
    const bestOf = (pts: PerfPoint[]) => [...pts].sort((a, b) => b.score - a.score || a.date.localeCompare(b.date))[0] ?? null;
    let direction: PerfDirection = "insufficient";
    if (recent !== null && previous !== null) {
      const delta = recent - previous;
      direction = delta >= s.threshold ? "up" : delta <= -s.threshold ? "down" : "flat";
    }
    return { key: s.key, kind: s.kind, series: s, recent: recent === null ? null : round1(recent), previous: previous === null ? null : round1(previous),
      recentBest: bestOf(recentPts), previousBest: bestOf(previousPts), recentCount: recentPts.length, previousCount: previousPts.length, direction };
  }).sort((a, b) => (b.recentCount + b.previousCount) - (a.recentCount + a.previousCount));
}

// ── Verdict ────────────────────────────────────────────────────────────────

export type Verdict = "progressing" | "stagnating" | "declining" | "insufficient";
export type VerdictResult = {
  verdict: Verdict;
  /** "performance" when at least one scale has a direction; otherwise the verdict rests on load alone. */
  basis: "performance" | "load" | "none";
  ups: PerfTrend[]; downs: PerfTrend[]; flats: PerfTrend[];
  /** Change of chronic load over the last 28 days (0.1 = +10 %), null without enough history. */
  fitnessChange: number | null;
  zone: LoadZone;
  flags: Array<"spike" | "high" | "under" | "monotony" | "pain">;
};

/** Thresholds the verdict uses on chronic load: building above +10 %, losing below −20 % over 28 days. */
export const FITNESS_RULE = { build: 0.1, loss: -0.2, days: 28 } as const;

/**
 * Progressing, stagnating or declining. Performance decides when it can: more
 * scales up than down is progress, more down than up is decline; a tie (or
 * all flat) is stagnation, unless chronic load also fell by more than 20 %.
 * Without any comparable performance, chronic load alone decides and the
 * page says so.
 */
export function progressVerdict(
  trends: readonly PerfTrend[], model: readonly LoadDay[], extra: { monotony: number | null; recentPain: number },
): VerdictResult {
  const last = model.at(-1);
  const before = model.length > FITNESS_RULE.days ? model[model.length - 1 - FITNESS_RULE.days] : null;
  const fitnessChange = last && before && before.fitness > 0.5 ? Math.round(((last.fitness - before.fitness) / before.fitness) * 100) / 100 : null;
  const zone = loadZone(last?.ratio ?? null);
  const flags: VerdictResult["flags"] = [];
  if (zone === "danger") flags.push("spike");
  if (zone === "high") flags.push("high");
  if (zone === "under") flags.push("under");
  if (extra.monotony !== null && extra.monotony > LOAD_THRESHOLDS.monotony) flags.push("monotony");
  if (extra.recentPain > 0) flags.push("pain");

  const ups = trends.filter((t) => t.direction === "up");
  const downs = trends.filter((t) => t.direction === "down");
  const flats = trends.filter((t) => t.direction === "flat");
  const judged = ups.length + downs.length + flats.length;
  let verdict: Verdict, basis: VerdictResult["basis"];
  if (judged > 0) {
    basis = "performance";
    if (ups.length > downs.length) verdict = "progressing";
    else if (downs.length > ups.length) verdict = "declining";
    else verdict = fitnessChange !== null && fitnessChange <= FITNESS_RULE.loss ? "declining" : "stagnating";
  } else if (fitnessChange !== null) {
    basis = "load";
    verdict = fitnessChange >= FITNESS_RULE.build ? "progressing" : fitnessChange <= FITNESS_RULE.loss ? "declining" : "stagnating";
  } else {
    basis = "none";
    verdict = "insufficient";
  }
  return { verdict, basis, ups, downs, flats, fitnessChange, zone, flags };
}

/** Training sessions in the last 7 days with pain at 3/10 or more. */
export function recentPainCount(training: readonly Pick<TrainingLoadFact, "date" | "completed" | "pain">[], today: string): number {
  const since = addDays(today, -6);
  return training.filter((t) => t.completed && t.date >= since && t.date <= today && (t.pain ?? 0) >= 3).length;
}

/** Load per source over the last `days` days, for the breakdown under the chart. */
export function loadBySource(loads: readonly SessionLoad[], today: string, days = 28): { source: LoadSource; load: number; sessions: number }[] {
  const since = addDays(today, -(days - 1));
  return LOAD_SOURCES.map((source) => {
    const list = loads.filter((l) => l.source === source && l.date >= since && l.date <= today);
    return { source, load: list.reduce((s, l) => s + l.load, 0), sessions: list.length };
  }).filter((r) => r.sessions > 0);
}

// ── The whole report, for the page and the coach ───────────────────────────

export type TrainingLoadInput = {
  today: string;
  climbs: ReadonlyArray<Omit<ClimbSessionFact, "attempts" | "nearLimit">>;
  scaledAttempts: readonly ScaledAttempt[];
  training: readonly TrainingLoadFact[];
  mobility: readonly MobilityRecordFact[];
  perf: readonly PerfSeries[];
};

export type TrainingLoadReport = {
  loads: SessionLoad[]; model: LoadDay[]; projection: ReturnType<typeof projectLoad>;
  guide: WeeklyGuide | null; monotony: number | null; trends: PerfTrend[]; verdict: VerdictResult;
  bySource: ReturnType<typeof loadBySource>;
  /** Share of the last 28 days' sessions whose minutes / intensity were estimated (0–1), null without sessions. */
  estimated: { minutes: number; intensity: number } | null;
  /** Days of history left before the ratio shows (0 once calibrated). */
  calibrationLeft: number;
};

/** Everything the load diagram shows, from plain facts. */
export function trainingLoadReport(input: TrainingLoadInput): TrainingLoadReport {
  const near = nearLimitCounts(input.scaledAttempts);
  const climbs = input.climbs.map((c) => ({ ...c, ...(near.get(c.id) ?? { attempts: 0, nearLimit: 0 }) }));
  const loads = sessionLoads(climbs, input.training, input.mobility);
  const model = loadModel(loads, input.today);
  const mono = monotony(model);
  const trends = performanceTrends(input.perf, input.today);
  const since = addDays(input.today, -27);
  const recent = loads.filter((l) => l.date >= since && l.date <= input.today);
  return {
    loads, model, projection: projectLoad(model), guide: weeklyGuide(model, loads, input.today), monotony: mono, trends,
    verdict: progressVerdict(trends, model, { monotony: mono, recentPain: recentPainCount(input.training, input.today) }),
    bySource: loadBySource(loads, input.today),
    estimated: recent.length ? {
      minutes: recent.filter((l) => l.estimated.minutes).length / recent.length,
      intensity: recent.filter((l) => l.estimated.intensity).length / recent.length,
    } : null,
    calibrationLeft: model.length ? Math.max(0, LOAD_THRESHOLDS.calibrationDays - model.length) : LOAD_THRESHOLDS.calibrationDays,
  };
}

export type WeeklyLoadRow = { weekStart: string; load: number; fitness: number; fatigue: number; form: number };

/** The model summed per ISO week (load) with end-of-week values, for the accessible table. */
export function weeklyLoadRows(model: readonly LoadDay[]): WeeklyLoadRow[] {
  const rows = new Map<string, WeeklyLoadRow>();
  for (const d of model) {
    const t = Date.parse(d.date + "T00:00:00Z");
    const dow = (new Date(t).getUTCDay() + 6) % 7;
    const weekStart = new Date(t - dow * DAY_MS).toISOString().slice(0, 10);
    const cur = rows.get(weekStart);
    rows.set(weekStart, { weekStart, load: (cur?.load ?? 0) + d.load, fitness: d.fitness, fatigue: d.fatigue, form: d.form });
  }
  return [...rows.values()];
}

export type LoadChartPoint = {
  date: string; projected: boolean; load: number; fitness: number; fatigue: number; form: number;
  /** The healthy fatigue band (0.8–1.3 × fitness) and the 1.5 line; null while calibrating. */
  bandLow: number | null; bandHigh: number | null; danger: number | null;
};

/** The days the diagram draws, from `from` to the end of the projection. */
export function loadChartPoints(model: readonly LoadDay[], projection: readonly LoadDay[], from: string): LoadChartPoint[] {
  const calibrated = model.at(-1)?.ratio !== null && model.length > 0;
  const point = (d: LoadDay, projected: boolean): LoadChartPoint => {
    const banded = projected ? calibrated : d.ratio !== null;
    return { date: d.date, projected, load: d.load, fitness: d.fitness, fatigue: d.fatigue, form: d.form,
      bandLow: banded ? round1(d.fitness * LOAD_THRESHOLDS.low) : null,
      bandHigh: banded ? round1(d.fitness * LOAD_THRESHOLDS.high) : null,
      danger: banded ? round1(d.fitness * LOAD_THRESHOLDS.danger) : null };
  };
  return [...model.filter((d) => d.date >= from).map((d) => point(d, false)), ...projection.map((d) => point(d, true))];
}
