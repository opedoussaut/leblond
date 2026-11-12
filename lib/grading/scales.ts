import type { GradeSystem } from "@/lib/climbing/types";
import { zonedToUtc } from "@/lib/time";

/**
 * Which bouldering scales a gym uses, over time.
 *
 * A gym row carries (see migration 20261119000001_climbing_district_levels.sql):
 *  - `grading_system`: its CURRENT bouldering scale, the default for new sessions;
 *  - `former_grading_systems`: scales it used before (oldest first). They stay
 *    valid for everything logged with them, and a session can still be logged
 *    in one (an old session being completed, a past session, walls not yet
 *    re-graded). Nothing is ever converted from one scale to another;
 *  - `grading_system_since`: the day the current scale started, ONLY when a
 *    source verifies it (null otherwise — e.g. Climbing District's switch to
 *    levels 1–12 has no verified date).
 *
 * Routes are graded per gym by `route_grading` (French scale, or the gym's
 * colours); outdoor venues use Font. Every boulder keeps its own
 * `native_grade_system`, so its grade can always be read later.
 *
 * The database enforces the same rules (`gym_accepts_grade_system`, the
 * `sessions_grade_system` trigger): keep both in sync.
 */
export interface GymScales {
  gradingSystem: GradeSystem;
  formerGradingSystems?: readonly GradeSystem[] | null;
  /** ISO date (YYYY-MM-DD), verified sources only. */
  gradingSystemSince?: string | null;
}

/** Scales a session at this gym can log boulders in: the current one first, then former ones (latest first). */
export function boulderSystemsForGym(gym: GymScales): GradeSystem[] {
  const former = [...(gym.formerGradingSystems ?? [])].reverse();
  return [gym.gradingSystem, ...former.filter((s) => s !== gym.gradingSystem)].filter(
    (s, i, all) => all.indexOf(s) === i,
  );
}

export function acceptsBoulderSystem(gym: GymScales, system: GradeSystem): boolean {
  return boulderSystemsForGym(gym).includes(system);
}

/**
 * Default scale for a new boulder session starting at `startedAt`: the current
 * scale, unless a VERIFIED transition date says the session predates it (then
 * the latest former scale). Without a verified date, the current scale — the
 * climber can still switch a session to a former scale.
 */
export function defaultBoulderSystem(gym: GymScales, startedAt: Date = new Date()): GradeSystem {
  const former = gym.formerGradingSystems ?? [];
  if (gym.gradingSystemSince && former.length > 0) {
    // Midnight, Paris time, on the transition day (the database uses the same boundary).
    const since = zonedToUtc(gym.gradingSystemSince, "00:00");
    if (!Number.isNaN(since.getTime()) && startedAt.getTime() < since.getTime()) return former[former.length - 1];
  }
  return gym.gradingSystem;
}

/** The scale a boulder session logs new boulders in (sessions predating the column fall back to the gym's current scale). */
export function sessionBoulderSystem(
  session: { grade_system?: string | null },
  gym: GymScales,
): GradeSystem {
  const s = session.grade_system as GradeSystem | null | undefined;
  return s && acceptsBoulderSystem(gym, s) ? s : gym.gradingSystem;
}

/** Gym row → GymScales. */
export function gymScales(row: {
  grading_system: string;
  former_grading_systems?: string[] | null;
  grading_system_since?: string | null;
}): GymScales {
  return {
    gradingSystem: row.grading_system as GradeSystem,
    formerGradingSystems: (row.former_grading_systems ?? []) as GradeSystem[],
    gradingSystemSince: row.grading_system_since ?? null,
  };
}
