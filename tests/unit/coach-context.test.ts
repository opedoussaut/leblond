import { describe, expect, it } from "vitest";
import { computeSnapshot, type ClimbingDataset } from "@/lib/analytics";
import { buildCoachContext, CONTEXT_CHAR_BUDGET, serializeContext } from "@/lib/coach/context";
import { attemptsFor, daysAgo, NOW, problem, session } from "./fixtures";

function dataset(): ClimbingDataset {
  const ark = Array.from({ length: 6 }, () => ({ ...problem("RED"), gymId: "ark", tags: ["slab" as const] }));
  const cd = Array.from({ length: 4 }, () => ({ ...problem("BLUE", "CLIMBING_DISTRICT_COLOR"), gymId: "cd" }));
  return {
    gyms: [
      { id: "ark", name: "Arkose X", brand: "ARKOSE", gradingSystem: "ARKOSE_COLOR" },
      { id: "cd", name: "CD Y", brand: "CLIMBING_DISTRICT", gradingSystem: "CLIMBING_DISTRICT_COLOR" },
    ],
    problems: [...ark, ...cd],
    attempts: [
      ...ark.flatMap((p, i) => attemptsFor(p, i < 4 ? ["ATTEMPT", "TOP"] : ["ATTEMPT"], daysAgo(5), "s1")),
      ...cd.flatMap((p) => attemptsFor(p, ["FLASH"], daysAgo(2), "s2")),
    ],
    sessions: [session("s1", daysAgo(5), 100), session("s2", daysAgo(2), 80)],
  };
}

describe("Patrick context", () => {
  const data = dataset();
  const target = { grade: "7A", system: "FONT" as const };
  const ctx = buildCoachContext({
    climber: { name: "Alex", language: "fr", target },
    snapshot30: computeSnapshot(data, target, NOW, 30),
    snapshot90: computeSnapshot(data, target, NOW, 90),
    recentSessions: [],
    activeProjects: [],
    now: NOW,
  });

  it("carries computed figures with counts, not raw rows", () => {
    expect(ctx.last30Days.sendRate).toEqual({ value: 0.8, count: "8/10" });
    expect(ctx.last30Days).not.toHaveProperty("attemptsList");
    expect(JSON.stringify(ctx)).not.toContain("problemId");
  });

  it("keeps native networks separate and states the normalised coverage", () => {
    expect(ctx.gyms.native.map((n) => n.network)).toEqual(["ARKOSE", "CLIMBING_DISTRICT"]);
    expect(ctx.gyms.normalizedFont.sufficient).toBe(false);
    expect(ctx.gyms.normalizedFont.grades).toEqual([]);
    expect(ctx.gyms.normalizedFont.coverage.none).toBe(10);
  });

  it("states missing data explicitly instead of inventing it", () => {
    expect(ctx.climber.fontWorkingGrade).toBeNull();
    expect(ctx.wearable.latestComparison).toBeNull();
    expect(ctx.focusSession).toBeNull();
    expect(ctx.definitions.workingLevel).toContain("60 days");
  });

  it("stays within the context budget", () => {
    expect(serializeContext(ctx).length).toBeLessThan(CONTEXT_CHAR_BUDGET + 50);
  });
});
