import type { GymBrand } from "@/lib/climbing/types";
import { calculateNativeDistribution, calculateNormalizedDistribution, type NativeDistribution } from "./grades";
import { calculateFlashRate, calculateSendRate, computeProblemOutcomes } from "./outcomes";
import type { AttemptFact, ClimbingDataset, GymFact, Ratio } from "./types";

export interface GymBreakdown {
  gym: GymFact;
  sessions: number;
  problems: number;
  attempts: number;
  sendRate: Ratio;
  flashRate: Ratio;
}

/** Activity and rates per gym. */
export function calculateGymBreakdown(data: ClimbingDataset, attempts: AttemptFact[] = data.attempts): GymBreakdown[] {
  const problemGym = new Map(data.problems.map((p) => [p.id, p.gymId]));
  return data.gyms
    .map((gym) => {
      const gymAttempts = attempts.filter((a) => problemGym.get(a.problemId) === gym.id);
      const outcomes = computeProblemOutcomes(gymAttempts);
      const sessionIds = new Set(gymAttempts.map((a) => a.sessionId));
      for (const s of data.sessions) if (s.gymId === gym.id) sessionIds.add(s.id);
      return {
        gym,
        sessions: sessionIds.size,
        problems: outcomes.size,
        attempts: gymAttempts.length,
        sendRate: calculateSendRate(outcomes.values()),
        flashRate: calculateFlashRate(outcomes.values()),
      };
    })
    .filter((g) => g.sessions > 0 || g.attempts > 0);
}

export interface NetworkNativeView {
  brand: GymBrand;
  distributions: NativeDistribution[];
}

/**
 * Cross-gym view, two complementary parts:
 *  - native: per network, per native grade, attempted vs sent — never merged
 *    across networks (an Arkose RED is not a Climbing District RED);
 *  - normalised: per Font grade, ONLY from reliable estimates, with coverage
 *    figures so the uncertainty stays visible.
 */
export function calculateCrossGymComparison(data: ClimbingDataset, attempts: AttemptFact[] = data.attempts) {
  const outcomes = computeProblemOutcomes(attempts);
  const gymBrand = new Map(data.gyms.map((g) => [g.id, g.brand]));
  const byBrand = new Map<GymBrand, typeof data.problems>();
  for (const p of data.problems) {
    if (!outcomes.has(p.id)) continue;
    const brand = gymBrand.get(p.gymId) ?? "OTHER";
    const list = byBrand.get(brand) ?? [];
    list.push(p);
    byBrand.set(brand, list);
  }
  const native: NetworkNativeView[] = [...byBrand.entries()].map(([brand, problems]) => ({
    brand,
    distributions: calculateNativeDistribution(problems, outcomes),
  }));
  const order: GymBrand[] = ["ARKOSE", "CLIMBING_DISTRICT", "BLOCKOUT", "INDEPENDENT", "OUTDOOR", "OTHER"];
  native.sort((a, b) => order.indexOf(a.brand) - order.indexOf(b.brand));
  return {
    native,
    normalized: calculateNormalizedDistribution(data.problems, outcomes),
  };
}
