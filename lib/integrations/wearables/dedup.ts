import { createHash } from "node:crypto";

/**
 * De-duplication of the same workout arriving from several sources
 * (e.g. Garmin + Strava, or a FIT file + a provider sync).
 *
 * 1. Exact: (user, provider, provider_activity_id) is unique in the database.
 * 2. Cross-provider: a stable key derived from start minute + duration bucket,
 *    then a tolerance check (start within 2 min, duration within 5% or 60 s).
 */
export const START_TOLERANCE_SECONDS = 120;
export const DURATION_TOLERANCE_RATIO = 0.05;
export const DURATION_TOLERANCE_MIN_SECONDS = 60;

export interface DedupCandidate {
  startedAt: Date;
  durationSeconds: number;
}

/** Hash of stable metadata; equal keys are almost certainly the same workout. */
export function computeDedupKey(w: DedupCandidate): string {
  const startMinute = Math.floor(w.startedAt.getTime() / 60_000);
  const durationBucket = Math.round(w.durationSeconds / 60);
  return createHash("sha256").update(`${startMinute}:${durationBucket}`).digest("hex").slice(0, 32);
}

export function isLikelySameWorkout(a: DedupCandidate, b: DedupCandidate): boolean {
  const startDiff = Math.abs(a.startedAt.getTime() - b.startedAt.getTime()) / 1000;
  const durDiff = Math.abs(a.durationSeconds - b.durationSeconds);
  const durTol = Math.max(DURATION_TOLERANCE_MIN_SECONDS, Math.max(a.durationSeconds, b.durationSeconds) * DURATION_TOLERANCE_RATIO);
  return startDiff <= START_TOLERANCE_SECONDS && durDiff <= durTol;
}

export function findDuplicate<T extends DedupCandidate>(candidate: DedupCandidate, existing: T[]): T | null {
  return existing.find((e) => isLikelySameWorkout(candidate, e)) ?? null;
}

/** Sessions whose time window overlaps the workout (used to suggest a link). */
export function overlapsSession(
  w: DedupCandidate,
  session: { startedAt: Date; endedAt: Date | null },
  slackMinutes = 30,
): boolean {
  const ws = w.startedAt.getTime();
  const we = ws + w.durationSeconds * 1000;
  const ss = session.startedAt.getTime() - slackMinutes * 60_000;
  const se = (session.endedAt ?? new Date(session.startedAt.getTime() + 4 * 3_600_000)).getTime() + slackMinutes * 60_000;
  return ws < se && we > ss;
}
