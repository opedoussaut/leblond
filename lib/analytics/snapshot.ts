import {
  attemptsInLastDays,
  calculateAllNativeWorkingLevels,
  calculateAttemptsPerSend,
  calculateCrossGymComparison,
  calculateFlashRate,
  calculateGymBreakdown,
  calculateHighestFlashedGrade,
  calculateHighestSentGrade,
  calculateHighestSentNormalized,
  calculateNativeDistribution,
  calculateRecentTrend,
  calculateRoadToTarget,
  calculateSendRate,
  calculateStyleStats,
  calculateTopsPerSession,
  calculateWallAngleStats,
  calculateWearableSessionTrend,
  calculateWeeklyActivity,
  calculateWorkingGrade,
  computeProblemOutcomes,
  countActivity,
  DAY_MS,
  rankCategories,
  type ClimbingDataset,
} from "@/lib/analytics";
import type { GradeSystem } from "@/lib/climbing/types";
import { isOrderedSystem } from "@/lib/grading";

/**
 * One deterministic analytics snapshot for a climber, shared by Home,
 * Progress and Patrick's context so every surface shows the same numbers.
 * Pure function of (dataset, target, now, period).
 */
export function computeSnapshot(
  data: ClimbingDataset,
  target: { grade: string; system: GradeSystem },
  now: Date,
  periodDays: number | null,
) {
  const attempts = periodDays ? attemptsInLastDays(data.attempts, periodDays, now) : data.attempts;
  const sessions = periodDays
    ? data.sessions.filter((s) => s.startedAt.getTime() >= now.getTime() - periodDays * DAY_MS)
    : data.sessions;
  const outcomes = computeProblemOutcomes(attempts);
  const activeProblems = data.problems.filter((p) => outcomes.has(p.id));

  const styleStats = calculateStyleStats(activeProblems, outcomes);
  const wallAngleStats = calculateWallAngleStats(activeProblems, outcomes);
  const systems = [...new Set(data.problems.map((p) => p.nativeGradeSystem))].filter(isOrderedSystem);

  const latestWearableSession = [...data.sessions]
    .filter((s) => s.wearable?.avgHeartRate != null)
    .sort((a, b) => b.startedAt.getTime() - a.startedAt.getTime())[0];

  return {
    periodDays,
    generatedAt: now.toISOString(),
    counts: { sessions: sessions.length, ...countActivity(attempts) },
    sendRate: calculateSendRate(outcomes.values()),
    flashRate: calculateFlashRate(outcomes.values()),
    attemptsPerSend: calculateAttemptsPerSend(outcomes.values()),
    topsPerSession: calculateTopsPerSession(sessions, attempts),
    weekly: calculateWeeklyActivity(data.sessions, data.attempts, now, 12),
    highestSent: calculateHighestSentGrade(activeProblems, outcomes),
    highestFlashed: calculateHighestFlashedGrade(activeProblems, outcomes),
    highestSentNormalized: calculateHighestSentNormalized(activeProblems, outcomes),
    // Working level/grade always use their own fixed 60-day rule window.
    workingLevels: calculateAllNativeWorkingLevels(data.problems, data.attempts, now),
    workingGrade: calculateWorkingGrade(data.problems, data.attempts, now),
    trends: [
      ...systems.map((s) => calculateRecentTrend(s, data.problems, data.attempts, now)),
      calculateRecentTrend("FONT_NORMALIZED", data.problems, data.attempts, now),
    ],
    nativeDistribution: calculateNativeDistribution(activeProblems, outcomes),
    crossGym: calculateCrossGymComparison(data, attempts),
    gymBreakdown: calculateGymBreakdown(data, attempts),
    styleStats,
    wallAngleStats,
    focus: {
      styles: rankCategories(styleStats),
      wallAngles: rankCategories(wallAngleStats, undefined, ["UNKNOWN"]),
    },
    roadToTarget: calculateRoadToTarget(target.grade, target.system, data.problems, data.attempts, now),
    wearable: {
      sessions: sessions
        .filter((s) => s.wearable)
        .map((s) => ({
          sessionId: s.id,
          startedAt: s.startedAt.toISOString(),
          durationMinutes: s.durationMinutes,
          avgHeartRate: s.wearable!.avgHeartRate,
          maxHeartRate: s.wearable!.maxHeartRate,
          trainingLoad: s.wearable!.trainingLoad,
          provider: s.wearable!.provider,
        })),
      latestTrend: latestWearableSession ? calculateWearableSessionTrend(latestWearableSession.id, data.sessions) : null,
    },
  };
}

export type Snapshot = ReturnType<typeof computeSnapshot>;
