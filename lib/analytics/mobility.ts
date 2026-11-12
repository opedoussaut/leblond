import {
  MOBILITY_TESTS, SUPPORTS, TEST_BY_ID, type MobilityConditions, type MobilityResult, type Side, type Support, type WarningFlag,
} from "@/lib/training/hip-mobility/assessment";
import { EXERCISE_BY_ID, type Level, type TestId } from "@/lib/training/hip-mobility/content";
import {
  RULES, VARIANT_RANK, summarizePerformance, type MobilitySessionRecord, type Variant,
} from "@/lib/training/hip-mobility/prescription";
import { mondayOf } from "@/lib/training/sessions";

/**
 * Hip-mobility follow-up. Pure functions over recorded sessions and repeated
 * assessments. Measured values (tape measure, counts), observed session records,
 * self-reported discomfort and the stage LABEL are kept apart: nothing here
 * merges them into one score, and two assessments are only compared on a test
 * when that test's conditions were similar.
 */

export type AssessmentPoint = {
  id: string;
  date: string;
  protocolVersion: number;
  conditions: MobilityConditions | null;
  results: readonly MobilityResult[];
  /** The internal training stage shown at the time (a label, not a measurement). */
  stage: Level;
  rulesVersion: number;
};

/** Why two assessments cannot be compared on a test. */
export type ConditionDifference = "protocol" | "conditionsMissing" | "warmUp" | "cushion" | "wallMissing" | "wallKind" | "wallAngle" | "spacing";
/** Comparable, but worth keeping in mind. */
export type ConditionCaveat = "timeOfDay";

/** Tolerances under which conditions count as similar (editorial). */
export const SIMILAR = { cushionCm: 2, wallAngleDeg: 5, spacingCm: 5 } as const;

export function comparability(a: AssessmentPoint, b: AssessmentPoint, test: TestId): {
  comparable: boolean; differences: ConditionDifference[]; caveats: ConditionCaveat[];
} {
  const differences: ConditionDifference[] = [];
  const caveats: ConditionCaveat[] = [];
  if (a.protocolVersion !== b.protocolVersion) differences.push("protocol");
  const ca = a.conditions, cb = b.conditions;
  if (!ca || !cb) differences.push("conditionsMissing");
  else {
    if (ca.warmedUp !== cb.warmedUp) differences.push("warmUp");
    if (ca.timeOfDay !== cb.timeOfDay) caveats.push("timeOfDay");
    if (test === "A" && Math.abs(ca.cushionCm - cb.cushionCm) > SIMILAR.cushionCm) differences.push("cushion");
    if (test === "D") {
      if (!ca.wall || !cb.wall) differences.push("wallMissing");
      else {
        if (ca.wall.kind !== cb.wall.kind) differences.push("wallKind");
        if (Math.abs(ca.wall.angleDeg - cb.wall.angleDeg) > SIMILAR.wallAngleDeg) differences.push("wallAngle");
        if (Math.abs(ca.wall.spacingCm - cb.wall.spacingCm) > SIMILAR.spacingCm) differences.push("spacing");
      }
    }
  }
  return { comparable: differences.length === 0, differences, caveats };
}

export type SideOutcome = {
  done: boolean; skipReason: MobilityResult["skipReason"]; level: number | null; value: number | null;
  support: Support; discomfort: number; flags: readonly WarningFlag[]; active: boolean;
};
export type Direction = "better" | "same" | "worse";
export type TestChange = {
  test: TestId; side: Side; since: string; until: string;
  before: SideOutcome; after: SideOutcome;
  comparable: boolean; differences: ConditionDifference[]; caveats: ConditionCaveat[];
  /** Null when not comparable or when one of the two was not done. */
  direction: Direction | null;
};

function outcome(r: MobilityResult): SideOutcome {
  return { done: r.done, skipReason: r.skipReason, level: r.level, value: r.value, support: r.support, discomfort: r.discomfort, flags: r.flags, active: r.active };
}

const SUPPORT_RANK: Record<Support, number> = Object.fromEntries(SUPPORTS.map((s, i) => [s, i])) as Record<Support, number>;

/** Better = a higher level; at the same level, less support; then a better measured value. */
export function direction(test: TestId, side: Side, before: SideOutcome, after: SideOutcome): Direction | null {
  if (!before.done || !after.done) return null;
  const def = TEST_BY_ID.get(test)!;
  const spec = side === "BOTH" ? def.both : def.value;
  const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);
  const byLevel = side === "BOTH" ? 0 : sign((after.level ?? 0) - (before.level ?? 0));
  if (byLevel) return byLevel > 0 ? "better" : "worse";
  const bySupport = sign(SUPPORT_RANK[before.support] - SUPPORT_RANK[after.support]);
  if (bySupport) return bySupport > 0 ? "better" : "worse";
  if (spec && before.value !== null && after.value !== null) {
    const byValue = sign((after.value - before.value) * (spec.higherIsBetter ? 1 : -1));
    if (byValue) return byValue > 0 ? "better" : "worse";
  }
  return "same";
}

/** Test-by-test change between two assessments (only sides recorded in both). */
export function compareAssessments(before: AssessmentPoint, after: AssessmentPoint): TestChange[] {
  const out: TestChange[] = [];
  for (const def of MOBILITY_TESTS) {
    const c = comparability(before, after, def.id);
    for (const side of ["LEFT", "RIGHT", "BOTH"] as const) {
      const b = before.results.find((r) => r.test === def.id && r.side === side);
      const a = after.results.find((r) => r.test === def.id && r.side === side);
      if (!a || !b) continue;
      const before_ = outcome(b), after_ = outcome(a);
      out.push({
        test: def.id, side, since: before.date, until: after.date, before: before_, after: after_,
        comparable: c.comparable, differences: c.differences, caveats: c.caveats,
        direction: c.comparable ? direction(def.id, side, before_, after_) : null,
      });
    }
  }
  return out;
}

const byDateDesc = <T extends { date: string }>(list: readonly T[]) => [...list].sort((a, b) => b.date.localeCompare(a.date));

/**
 * The latest assessment against the FIRST earlier one taken in similar
 * conditions, test by test ("since you started"). Tests with no comparable
 * earlier assessment are listed with their condition differences.
 */
export function changesSinceBaseline(points: readonly AssessmentPoint[]): TestChange[] {
  const [latest, ...earlier] = byDateDesc(points);
  if (!latest || earlier.length === 0) return [];
  const oldestFirst = [...earlier].reverse();
  const out: TestChange[] = [];
  for (const def of MOBILITY_TESTS) {
    const base = oldestFirst.find((p) => comparability(p, latest, def.id).comparable) ?? earlier[0];
    out.push(...compareAssessments(base, latest).filter((c) => c.test === def.id));
  }
  return out;
}

export type SeriesPoint = { date: string; level: number | null; value: number | null; support: Support; done: boolean; comparableWithFirst: boolean };

/** One test side across every assessment, oldest first, flagged when not comparable with the first. */
export function assessmentSeries(points: readonly AssessmentPoint[], test: TestId, side: Side): SeriesPoint[] {
  const ordered = [...points].sort((a, b) => a.date.localeCompare(b.date));
  const first = ordered.find((p) => p.results.some((r) => r.test === test && r.side === side));
  return ordered.flatMap((p) => {
    const r = p.results.find((x) => x.test === test && x.side === side);
    if (!r || !first) return [];
    return [{ date: p.date, level: r.level, value: r.value, support: r.support, done: r.done, comparableWithFirst: comparability(first, p, test).comparable }];
  });
}

export type PeriodCount = { start: string; sessions: number; minutes: number };

function monthOf(date: string) { return date.slice(0, 7) + "-01"; }
function shiftMonth(month: string, by: number) {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + by, 1));
  return d.toISOString().slice(0, 10);
}
function shiftDays(date: string, by: number) {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + by)).toISOString().slice(0, 10);
}

/** Sessions done per week (or month), oldest first, ending with the current one; empty periods included. */
export function mobilityPeriods(records: readonly MobilitySessionRecord[], today: string, unit: "week" | "month", count: number): PeriodCount[] {
  const current = unit === "week" ? mondayOf(today) : monthOf(today);
  const starts = Array.from({ length: count }, (_, i) => unit === "week" ? shiftDays(current, -7 * (count - 1 - i)) : shiftMonth(current, -(count - 1 - i)));
  return starts.map((start) => {
    const inPeriod = records.filter((r) => (unit === "week" ? mondayOf(r.date) : monthOf(r.date)) === start);
    return { start, sessions: inPeriod.length, minutes: inPeriod.reduce((n, r) => n + (r.minutes ?? 0), 0) };
  });
}

export type ExercisePoint = {
  date: string; sessionId: string; variant: Variant | null;
  reps: { left: number | null; right: number | null; both: number | null };
  /** Share of completed sets done with control (null when control was not recorded). */
  controlledShare: number | null;
  maxDiscomfort: number; flags: WarningFlag[]; done: boolean;
};

/** One exercise across sessions, oldest first: the version done, reps per side, control and discomfort. */
export function exerciseProgress(records: readonly MobilitySessionRecord[], exerciseId: string): ExercisePoint[] {
  const ex = EXERCISE_BY_ID.get(exerciseId);
  if (!ex) return [];
  return [...records].sort((a, b) => a.date.localeCompare(b.date)).flatMap((r) => r.exercises
    .filter((e) => e.exerciseId === exerciseId)
    .map((e) => {
      const s = summarizePerformance(ex, e);
      const done = e.sets.filter((x) => x.completed && (x.reps ?? 0) > 0);
      const repsOn = (side: Side) => {
        const list = done.filter((x) => (x.side ?? "BOTH") === side).map((x) => x.reps ?? 0);
        return list.length ? Math.max(...list) : null;
      };
      const known = done.filter((x) => x.controlled !== null);
      return {
        date: r.date, sessionId: r.id, variant: s.dose?.variant ?? null,
        reps: { left: repsOn("LEFT"), right: repsOn("RIGHT"), both: repsOn("BOTH") },
        controlledShare: known.length ? known.filter((x) => x.controlled).length / known.length : null,
        maxDiscomfort: s.maxDiscomfort, flags: s.flags, done: s.done,
      };
    }));
}

export type SideStats = { sets: number; averageReps: number | null; easierShare: number; averageDiscomfort: number | null; uncontrolled: number };
export type SideComparison = { exerciseId: string; sessions: number; left: SideStats; right: SideStats; harderSide: "LEFT" | "RIGHT" | null };

/**
 * Left versus right on one-sided exercises over the last `window` sessions.
 * `harderSide` is the side that needed the easier version more often, more
 * uncontrolled reps or more discomfort; null when they look alike.
 */
export function sideComparison(records: readonly MobilitySessionRecord[], window = 5): SideComparison[] {
  const recent = byDateDesc(records).slice(0, window);
  const ids = [...new Set(recent.flatMap((r) => r.exercises.map((e) => e.exerciseId)))];
  return ids.filter((id) => EXERCISE_BY_ID.get(id)?.perSide).flatMap((id) => {
    const sets = recent.flatMap((r) => r.exercises.filter((e) => e.exerciseId === id).flatMap((e) =>
      e.sets.filter((s) => s.completed).map((s) => ({ ...s, variant: s.variant ?? e.prescribed?.variant ?? null }))));
    const stats = (side: "LEFT" | "RIGHT"): SideStats => {
      const list = sets.filter((s) => s.side === side);
      const reps = list.map((s) => s.reps ?? 0);
      const pain = list.map((s) => s.discomfort).filter((d): d is number => d !== null);
      return {
        sets: list.length,
        averageReps: reps.length ? Math.round((reps.reduce((a, b) => a + b, 0) / reps.length) * 10) / 10 : null,
        easierShare: list.length ? list.filter((s) => s.variant === "EASIER").length / list.length : 0,
        averageDiscomfort: pain.length ? Math.round((pain.reduce((a, b) => a + b, 0) / pain.length) * 10) / 10 : null,
        uncontrolled: list.filter((s) => s.controlled === false).length,
      };
    };
    const left = stats("LEFT"), right = stats("RIGHT");
    if (left.sets === 0 && right.sets === 0) return [];
    const strain = (s: SideStats) => s.easierShare * 2 + s.uncontrolled + (s.averageDiscomfort ?? 0) / 2;
    const gap = strain(left) - strain(right);
    const harderSide = left.sets && right.sets && Math.abs(gap) >= 1 ? (gap > 0 ? "LEFT" : "RIGHT") : null;
    return [{ exerciseId: id, sessions: recent.filter((r) => r.exercises.some((e) => e.exerciseId === id)).length, left, right, harderSide }];
  });
}

export type DiscomfortReport = { date: string; sessionId: string; exerciseId: string | null; side: Side | null; discomfort: number; flags: WarningFlag[] };

/** Every recorded discomfort ≥ `threshold` or warning sign, most recent first (self-reported). */
export function discomfortReports(records: readonly MobilitySessionRecord[], threshold = 3, limit = 20): DiscomfortReport[] {
  const out: DiscomfortReport[] = [];
  for (const r of byDateDesc(records)) {
    if ((r.pain ?? 0) >= threshold) out.push({ date: r.date, sessionId: r.id, exerciseId: null, side: null, discomfort: r.pain!, flags: [] });
    for (const e of r.exercises) for (const s of e.sets) {
      if ((s.discomfort ?? 0) >= threshold || s.flags.length) {
        out.push({ date: r.date, sessionId: r.id, exerciseId: e.exerciseId, side: s.side, discomfort: s.discomfort ?? 0, flags: [...s.flags] });
      }
    }
  }
  return out.slice(0, limit);
}

/**
 * The movement that is still hardest over the last `window` sessions: the one
 * most often done in its easier version, uncontrolled, skipped or uncomfortable.
 * Null when nothing stands out.
 */
export function hardestMovement(records: readonly MobilitySessionRecord[], window = 5): { exerciseId: string; strain: number } | null {
  const recent = byDateDesc(records).slice(0, window);
  const scores = new Map<string, number>();
  for (const r of recent) for (const e of r.exercises) {
    const ex = EXERCISE_BY_ID.get(e.exerciseId);
    if (!ex) continue;
    const s = summarizePerformance(ex, e);
    const strain = (!s.done ? 2 : 0) + (s.dose?.variant === "EASIER" ? 1 : 0) + s.uncontrolledShare * 2
      + (s.maxDiscomfort >= RULES.persistentDiscomfort ? 2 : s.maxDiscomfort >= 3 ? 1 : 0) + s.flags.length * 2;
    scores.set(e.exerciseId, (scores.get(e.exerciseId) ?? 0) + strain);
  }
  const best = [...scores.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0];
  return best && best[1] >= 2 ? { exerciseId: best[0], strain: Math.round(best[1] * 10) / 10 } : null;
}

export type MobilityOverview = {
  sessionsTotal: number; sessionsLast28: number; lastSession: string | null;
  assessments: number; latestStage: Level | null; latestAssessment: string | null;
};

export function mobilityOverview(records: readonly MobilitySessionRecord[], points: readonly AssessmentPoint[], today: string): MobilityOverview {
  const since = shiftDays(today, -27);
  const latest = byDateDesc(points)[0];
  return {
    sessionsTotal: records.length,
    sessionsLast28: records.filter((r) => r.date >= since && r.date <= today).length,
    lastSession: byDateDesc(records)[0]?.date ?? null,
    assessments: points.length,
    latestStage: latest?.stage ?? null,
    latestAssessment: latest?.date ?? null,
  };
}

/** Exported for tests and the UI: the variant order used in progress charts. */
export const variantRank = (v: Variant | null) => (v ? VARIANT_RANK[v] : null);
