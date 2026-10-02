import { describe, expect, it } from "vitest";
import { computeSnapshot, type ClimbingDataset } from "@/lib/analytics";
import { attemptsFor, daysAgo, NOW, problem, session } from "./fixtures";

describe("analytics snapshot", () => {
  it("combines period metrics with fixed-window working levels", () => {
    const recent = Array.from({ length: 5 }, () => problem("RED"));
    const old = problem("BLACK");
    const data: ClimbingDataset = {
      gyms: [{ id: "gym-a", name: "Arkose Test", brand: "ARKOSE", gradingSystem: "ARKOSE_COLOR" }],
      problems: [...recent, old],
      attempts: [
        ...recent.flatMap((p) => attemptsFor(p, ["ATTEMPT", "TOP"], daysAgo(3), "s-new")),
        ...attemptsFor(old, ["TOP"], daysAgo(45), "s-old"),
      ],
      sessions: [session("s-new", daysAgo(3), 90), session("s-old", daysAgo(45), 60)],
    };
    const snap = computeSnapshot(data, { grade: "7A", system: "FONT" }, NOW, 30);
    expect(snap.counts).toEqual({ sessions: 1, problems: 5, attempts: 10, tops: 5, flashes: 0 });
    expect(snap.sendRate.value).toBe(1);
    expect(snap.highestSent).toEqual([{ system: "ARKOSE_COLOR", grade: "RED", normalized: null }]);
    // Working level uses its own 60-day window, independent of the 30-day period.
    expect(snap.workingLevels[0].level).toBe("RED");
    expect(snap.workingGrade.level).toBeNull();
    expect(snap.crossGym.normalized.sufficient).toBe(false);
    expect(snap.weekly).toHaveLength(12);
  });
});
