import { isSend } from "@/lib/climbing/types";
import { DAY_MS, ratio, type AttemptFact, type ProblemOutcome, type Ratio } from "./types";

/** Keep attempts whose timestamp falls in [from, to). */
export function attemptsInWindow(attempts: AttemptFact[], from: Date, to: Date): AttemptFact[] {
  const a = from.getTime();
  const b = to.getTime();
  return attempts.filter((x) => {
    const t = x.createdAt.getTime();
    return t >= a && t < b;
  });
}

/** Attempts in the `days` days before `now` (inclusive of now). */
export function attemptsInLastDays(attempts: AttemptFact[], days: number, now: Date): AttemptFact[] {
  return attemptsInWindow(attempts, new Date(now.getTime() - days * DAY_MS), new Date(now.getTime() + 1));
}

/**
 * Collapse attempts into one outcome per problem.
 * - sent: at least one TOP or FLASH
 * - flashed: an attempt was explicitly classified FLASH (only valid on attempt #1)
 * - attemptsToSend: global attempt number of the first send
 */
export function computeProblemOutcomes(attempts: AttemptFact[]): Map<string, ProblemOutcome> {
  const byProblem = new Map<string, AttemptFact[]>();
  for (const a of attempts) {
    const list = byProblem.get(a.problemId);
    if (list) list.push(a);
    else byProblem.set(a.problemId, [a]);
  }
  const out = new Map<string, ProblemOutcome>();
  for (const [problemId, list] of byProblem) {
    list.sort((x, y) => x.attemptNumber - y.attemptNumber || x.createdAt.getTime() - y.createdAt.getTime());
    const firstSend = list.find((a) => isSend(a.result));
    out.set(problemId, {
      problemId,
      attempts: list.length,
      sent: firstSend !== undefined,
      flashed: list.some((a) => a.result === "FLASH"),
      attemptsToSend: firstSend ? firstSend.attemptNumber : null,
      firstAttemptAt: list[0].createdAt,
      lastAttemptAt: list[list.length - 1].createdAt,
    });
  }
  return out;
}

/** Share of attempted problems that were sent. */
export function calculateSendRate(outcomes: Iterable<ProblemOutcome>): Ratio {
  let total = 0;
  let sent = 0;
  for (const o of outcomes) {
    total++;
    if (o.sent) sent++;
  }
  return ratio(sent, total);
}

/** Share of attempted problems that were flashed. */
export function calculateFlashRate(outcomes: Iterable<ProblemOutcome>): Ratio {
  let total = 0;
  let flashed = 0;
  for (const o of outcomes) {
    total++;
    if (o.flashed) flashed++;
  }
  return ratio(flashed, total);
}

/**
 * Mean number of attempts needed to send, over sent problems.
 * Uses the global attempt number of the first send (so a problem sent on the
 * 3rd try across two sessions counts as 3).
 */
export function calculateAttemptsPerSend(outcomes: Iterable<ProblemOutcome>): {
  value: number | null;
  sends: number;
  attempts: number;
} {
  let sends = 0;
  let attempts = 0;
  for (const o of outcomes) {
    if (o.attemptsToSend !== null) {
      sends++;
      attempts += o.attemptsToSend;
    }
  }
  return { value: sends > 0 ? attempts / sends : null, sends, attempts };
}

export interface ActivityCounts {
  problems: number;
  attempts: number;
  tops: number;
  flashes: number;
}

/** Raw activity counts: attempts are rows; tops/flashes count distinct problems. */
export function countActivity(attempts: AttemptFact[]): ActivityCounts {
  const outcomes = computeProblemOutcomes(attempts);
  let tops = 0;
  let flashes = 0;
  for (const o of outcomes.values()) {
    if (o.sent) tops++;
    if (o.flashed) flashes++;
  }
  return { problems: outcomes.size, attempts: attempts.length, tops, flashes };
}
