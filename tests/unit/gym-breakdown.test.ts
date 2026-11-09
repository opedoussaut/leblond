import { describe, expect, it } from "vitest";
import { calculateGymBreakdown, type ClimbingDataset } from "@/lib/analytics";
import { plural } from "@/lib/i18n";
import { attemptsFor, daysAgo, problem, session } from "./fixtures";

describe("calculateGymBreakdown", () => {
  it("splits each gym's send rate by native grade, easiest first", () => {
    const yellows = [problem("YELLOW"), problem("YELLOW")];
    const red = problem("RED");
    const elsewhere = problem("BLUE", "ARKOSE_COLOR", { gymId: "gym-b" });
    const data: ClimbingDataset = {
      gyms: [
        { id: "gym-a", name: "Arkose A", brand: "ARKOSE", gradingSystem: "ARKOSE_COLOR" },
        { id: "gym-b", name: "Arkose B", brand: "ARKOSE", gradingSystem: "ARKOSE_COLOR" },
      ],
      problems: [red, ...yellows, elsewhere],
      attempts: [
        ...attemptsFor(red, ["ATTEMPT", "ATTEMPT"], daysAgo(2), "s-a"),
        ...attemptsFor(yellows[0], ["FLASH"], daysAgo(2), "s-a"),
        ...attemptsFor(yellows[1], ["TOP"], daysAgo(2), "s-a"),
        ...attemptsFor(elsewhere, ["TOP"], daysAgo(1), "s-b"),
      ],
      sessions: [session("s-a", daysAgo(2), 90), session("s-b", daysAgo(1), 60, { gymId: "gym-b" })],
    };
    const [a, b] = calculateGymBreakdown(data);
    expect(a.gym.id).toBe("gym-a");
    expect(a.sendRate).toMatchObject({ numerator: 2, denominator: 3 });
    expect(a.distributions).toEqual([
      {
        system: "ARKOSE_COLOR",
        buckets: [
          { grade: "YELLOW", attempted: 2, sent: 2, flashed: 1 },
          { grade: "RED", attempted: 1, sent: 0, flashed: 0 },
        ],
      },
    ]);
    expect(b.distributions[0].buckets).toEqual([{ grade: "BLUE", attempted: 1, sent: 1, flashed: 0 }]);
  });
});

describe("plural", () => {
  const forms = { one: "{n} séance", other: "{n} séances" };
  it("follows French rules: 0 and 1 are singular", () => {
    expect(plural("fr", 0, forms)).toBe("0 séance");
    expect(plural("fr", 1, forms)).toBe("1 séance");
    expect(plural("fr", 2, forms)).toBe("2 séances");
  });
  it("follows English rules: only 1 is singular", () => {
    const en = { one: "{n} session", other: "{n} sessions" };
    expect(plural("en", 0, en)).toBe("0 sessions");
    expect(plural("en", 1, en)).toBe("1 session");
  });
});
