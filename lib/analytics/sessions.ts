import type { StyleTag, WallAngle } from "@/lib/climbing/types";
import { calculateHighestFlashedGrade, calculateHighestSentGrade, type HighestGrade } from "./grades";
import { computeProblemOutcomes, countActivity, type ActivityCounts } from "./outcomes";
import { calculateStyleStats, calculateWallAngleStats, rankCategories, type CategoryStats } from "./styles";
import type { AttemptFact, ProblemFact, SessionFact, WearableFact } from "./types";

export interface SessionSummary extends ActivityCounts {
  sessionId: string;
  durationMinutes: number | null;
  highestSent: HighestGrade[];
  highestFlashed: HighestGrade[];
  mostSuccessfulStyle: CategoryStats<StyleTag> | null;
  hardestStyle: CategoryStats<StyleTag> | null;
  bestWallAngle: CategoryStats<WallAngle> | null;
  hardestWallAngle: CategoryStats<WallAngle> | null;
  wearable: WearableFact | null;
}

/** Minimum problems in a category before a session-level style verdict is shown. */
export const MIN_PROBLEMS_PER_STYLE_IN_SESSION = 2;

/** Elapsed minutes between start and end (or `now` for a live session). */
export function sessionElapsedMinutes(session: SessionFact, now: Date = new Date()): number {
  const end = session.endedAt ?? now;
  return Math.max(0, Math.round((end.getTime() - session.startedAt.getTime()) / 60_000));
}

/**
 * End-of-session summary. Only problems attempted IN this session are used;
 * fields with no data stay null so the UI can omit them.
 */
export function summarizeSession(
  session: SessionFact,
  problems: ProblemFact[],
  allAttempts: AttemptFact[],
): SessionSummary {
  const attempts = allAttempts.filter((a) => a.sessionId === session.id);
  const outcomes = computeProblemOutcomes(attempts);
  const sessionProblems = problems.filter((p) => outcomes.has(p.id));
  const styles = rankCategories(
    calculateStyleStats(sessionProblems, outcomes),
    MIN_PROBLEMS_PER_STYLE_IN_SESSION,
  );
  const angles = rankCategories(
    calculateWallAngleStats(sessionProblems, outcomes),
    MIN_PROBLEMS_PER_STYLE_IN_SESSION,
    ["UNKNOWN"],
  );
  return {
    sessionId: session.id,
    ...countActivity(attempts),
    durationMinutes: session.durationMinutes ?? (session.endedAt ? sessionElapsedMinutes(session) : null),
    highestSent: calculateHighestSentGrade(sessionProblems, outcomes),
    highestFlashed: calculateHighestFlashedGrade(sessionProblems, outcomes),
    mostSuccessfulStyle: styles.strongest,
    hardestStyle: styles.weakest,
    bestWallAngle: angles.strongest,
    hardestWallAngle: angles.weakest,
    wearable: session.wearable ?? null,
  };
}
