import type { AttemptResult, GradeSystem, StyleTag, WallAngle } from "@/lib/climbing/types";
import type { AttemptFact, ProblemFact, SessionFact } from "@/lib/analytics";

export const NOW = new Date("2026-10-01T18:00:00Z");
export const daysAgo = (d: number, hour = 0) => new Date(NOW.getTime() - d * 86_400_000 + hour * 3_600_000);

let seq = 0;
const id = (p: string) => `${p}-${++seq}`;

export function problem(
  nativeGrade: string,
  system: GradeSystem = "ARKOSE_COLOR",
  extra: Partial<ProblemFact> = {},
): ProblemFact {
  return {
    id: id("p"),
    gymId: "gym-a",
    nativeGrade,
    nativeGradeSystem: system,
    wallAngle: "VERTICAL" as WallAngle,
    tags: [] as StyleTag[],
    ...extra,
  };
}

/**
 * Build the attempt history for one problem from a compact pattern,
 * e.g. ["ATTEMPT", "ATTEMPT", "TOP"] → three attempts numbered 1..3.
 */
export function attemptsFor(
  p: ProblemFact,
  results: AttemptResult[],
  when: Date = daysAgo(1),
  sessionId = "s-1",
): AttemptFact[] {
  return results.map((result, i) => ({
    id: id("a"),
    problemId: p.id,
    sessionId,
    result,
    attemptNumber: i + 1,
    createdAt: new Date(when.getTime() + i * 60_000),
  }));
}

export function session(idValue: string, startedAt: Date, minutes: number, extra: Partial<SessionFact> = {}): SessionFact {
  return {
    id: idValue,
    gymId: "gym-a",
    startedAt,
    endedAt: new Date(startedAt.getTime() + minutes * 60_000),
    durationMinutes: minutes,
    ...extra,
  };
}
