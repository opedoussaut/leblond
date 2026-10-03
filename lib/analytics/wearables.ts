import type { SessionFact } from "./types";

/**
 * Wearable context for climbing sessions. These are PERSONAL comparisons
 * (the climber against their own recent sessions), never physiological
 * diagnoses. See docs/wearables.md.
 */

export interface WearableSessionTrend {
  sessionId: string;
  avgHeartRate: number;
  /** Mean avg HR of comparable earlier sessions (similar duration). */
  baselineAvgHeartRate: number | null;
  comparableSessions: number;
  difference: number | null;
  direction: "higher" | "similar" | "lower" | "insufficient_data";
}

export interface WearableTrendRule {
  /** How many earlier comparable sessions to use. */
  baselineSessions: number;
  /** Relative duration tolerance for "similar duration". */
  durationTolerance: number;
  /** Minimum absolute bpm difference to call higher/lower. */
  thresholdBpm: number;
}

export const DEFAULT_WEARABLE_TREND_RULE: WearableTrendRule = {
  baselineSessions: 3,
  durationTolerance: 0.25,
  thresholdBpm: 5,
};

function sessionDurationMinutes(s: SessionFact): number | null {
  if (s.wearable?.durationSeconds) return s.wearable.durationSeconds / 60;
  return s.durationMinutes;
}

/**
 * Compare a session's recorded average heart rate with the climber's previous
 * sessions of similar duration (default: the previous 3 within ±25%).
 */
export function calculateWearableSessionTrend(
  sessionId: string,
  sessions: SessionFact[],
  rule: WearableTrendRule = DEFAULT_WEARABLE_TREND_RULE,
): WearableSessionTrend | null {
  const target = sessions.find((s) => s.id === sessionId);
  const avg = target?.wearable?.avgHeartRate;
  if (!target || avg == null) return null;
  const duration = sessionDurationMinutes(target);

  const comparable = sessions
    .filter((s) => s.id !== sessionId && s.startedAt < target.startedAt && s.wearable?.avgHeartRate != null)
    .filter((s) => {
      if (duration == null) return false;
      const d = sessionDurationMinutes(s);
      return d != null && Math.abs(d - duration) <= duration * rule.durationTolerance;
    })
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())
    .slice(0, rule.baselineSessions);

  if (comparable.length < rule.baselineSessions) {
    return {
      sessionId,
      avgHeartRate: avg,
      baselineAvgHeartRate: null,
      comparableSessions: comparable.length,
      difference: null,
      direction: "insufficient_data",
    };
  }
  const baseline = comparable.reduce((s, x) => s + (x.wearable!.avgHeartRate as number), 0) / comparable.length;
  const difference = avg - baseline;
  return {
    sessionId,
    avgHeartRate: avg,
    baselineAvgHeartRate: baseline,
    comparableSessions: comparable.length,
    difference,
    direction: difference >= rule.thresholdBpm ? "higher" : difference <= -rule.thresholdBpm ? "lower" : "similar",
  };
}
