import type { RouteAscentFact } from "./routes";
import type { ClimbingDataset } from "./types";

/**
 * Indoor or outdoor: a gym is outdoor when it stands for a crag (brand OUTDOOR,
 * as in the avatar's pillars). Pure filters, so every existing analysis runs
 * unchanged on one kind of place.
 */
export type Place = "indoor" | "outdoor";

export const placeOfBrand = (brand: string): Place => (brand === "OUTDOOR" ? "outdoor" : "indoor");

/** The bouldering dataset restricted to the gyms of one kind of place, with their boulders, tries and séances. */
export function datasetAt(data: ClimbingDataset, place: Place): ClimbingDataset {
  const gyms = data.gyms.filter((g) => placeOfBrand(g.brand) === place);
  const gymIds = new Set(gyms.map((g) => g.id));
  const problems = data.problems.filter((p) => gymIds.has(p.gymId));
  const problemIds = new Set(problems.map((p) => p.id));
  return {
    gyms,
    problems,
    attempts: data.attempts.filter((a) => problemIds.has(a.problemId)),
    sessions: data.sessions.filter((s) => gymIds.has(s.gymId)),
  };
}

/** Route ascents climbed in one kind of place (an ascent whose place is unknown counts as indoor). */
export function routeAscentsAt(ascents: readonly RouteAscentFact[], place: Place): RouteAscentFact[] {
  return ascents.filter((a) => (a.outdoor ? "outdoor" : "indoor") === place);
}
