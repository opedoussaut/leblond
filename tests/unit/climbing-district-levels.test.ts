import { describe, expect, it } from "vitest";
import {
  calculateRoadToTarget,
  computeSnapshot,
  summarizeSession,
  type AttemptFact,
  type ClimbingDataset,
} from "@/lib/analytics";
import { allowedSystemsForBrand, GRADE_SYSTEMS } from "@/lib/climbing/types";
import { buildCoachContext } from "@/lib/coach/context";
import {
  acceptsBoulderSystem,
  boulderSystemsForGym,
  CLIMBING_DISTRICT_GRADES,
  compareGrades,
  defaultBoulderSystem,
  gradeSystemKind,
  gradeToScore,
  isColorSystem,
  isMysteryGrade,
  isValidGrade,
  listGrades,
  maxGrade,
  nextGrade,
  sessionBoulderSystem,
  type GymScales,
} from "@/lib/grading";
import { fontRangeFor, isColourSystem } from "@/lib/grading/conversions";
import { gradeLabel, gradeSpokenLabel } from "@/lib/grading/labels";
import { en } from "@/lib/i18n/en";
import { fr } from "@/lib/i18n/fr";
import { attemptsFor, daysAgo, NOW, problem, session } from "./fixtures";

const LEVELS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

describe("Climbing District levels 1–12", () => {
  it("is an ordered numeric gym scale, 1 easiest", () => {
    expect(GRADE_SYSTEMS).toContain("CLIMBING_DISTRICT_LEVEL");
    expect(listGrades("CLIMBING_DISTRICT_LEVEL").map((g) => g.id)).toEqual(LEVELS);
    expect(gradeSystemKind("CLIMBING_DISTRICT_LEVEL")).toBe("NUMERIC");
    expect(isColorSystem("CLIMBING_DISTRICT_LEVEL")).toBe(false);
    expect(isColourSystem("CLIMBING_DISTRICT_LEVEL")).toBe(false);
  });

  it("orders by level, not as text", () => {
    expect(compareGrades("CLIMBING_DISTRICT_LEVEL", "10", "9")).toBeGreaterThan(0);
    expect(compareGrades("CLIMBING_DISTRICT_LEVEL", "2", "12")).toBeLessThan(0);
    expect(maxGrade("CLIMBING_DISTRICT_LEVEL", ["9", "10", "2"])).toBe("10");
    expect(nextGrade("CLIMBING_DISTRICT_LEVEL", "11")).toBe("12");
    expect(nextGrade("CLIMBING_DISTRICT_LEVEL", "12")).toBeNull();
  });

  it("accepts only 1–12", () => {
    for (const l of LEVELS) expect(isValidGrade("CLIMBING_DISTRICT_LEVEL", l)).toBe(true);
    for (const bad of ["0", "13", "07", "6A", "B6", "BLUE"]) expect(isValidGrade("CLIMBING_DISTRICT_LEVEL", bad)).toBe(false);
  });

  it("keeps the former colours exactly as they were, pink still unranked", () => {
    expect(CLIMBING_DISTRICT_GRADES.map((g) => g.id)).toEqual(
      ["WHITE", "YELLOW", "ORANGE", "GREEN", "BLUE", "RED", "BLACK", "PURPLE", "PINK"],
    );
    expect(isMysteryGrade("CLIMBING_DISTRICT_COLOR", "PINK")).toBe(true);
    expect(gradeToScore("CLIMBING_DISTRICT_COLOR", "BLUE")).toBe(4);
    expect(fontRangeFor("CLIMBING_DISTRICT_COLOR", "BLUE")).not.toBeNull();
  });

  it("has no colour ↔ level or level → Font equivalence", () => {
    for (const l of LEVELS) expect(fontRangeFor("CLIMBING_DISTRICT_LEVEL", l)).toBeNull();
    // A level is not a colour grade and a colour is not a level: never comparable.
    expect(gradeToScore("CLIMBING_DISTRICT_LEVEL", "BLUE")).toBeNull();
    expect(gradeToScore("CLIMBING_DISTRICT_COLOR", "7")).toBeNull();
  });

  it("labels levels so they never read as Font or French grades", () => {
    expect(gradeLabel(fr, "CLIMBING_DISTRICT_LEVEL", "7")).toBe("Niv. 7");
    expect(gradeLabel(en, "CLIMBING_DISTRICT_LEVEL", "7")).toBe("Lvl 7");
    expect(gradeSpokenLabel(fr, "CLIMBING_DISTRICT_LEVEL", "12")).toBe("Niveau 12");
    expect(gradeLabel(fr, "CLIMBING_DISTRICT_COLOR", "BLUE")).toBe("Bleu");
    expect(gradeLabel(fr, "BLOCKOUT_LEVEL", "B7")).toBe("B7");
    expect(fr.grades.systems.CLIMBING_DISTRICT_LEVEL).toContain("1–12");
    expect(en.grades.systems.CLIMBING_DISTRICT_COLOR).toContain("former");
  });

  it("is the scale of new Climbing District gyms; other brands unchanged", () => {
    expect(allowedSystemsForBrand("CLIMBING_DISTRICT")).toEqual(["CLIMBING_DISTRICT_LEVEL"]);
    expect(allowedSystemsForBrand("ARKOSE")).toEqual(["ARKOSE_COLOR"]);
    expect(allowedSystemsForBrand("BLOCKOUT")).toEqual(["BLOCKOUT_LEVEL"]);
    expect(allowedSystemsForBrand("OUTDOOR")).toEqual(["FONT", "CUSTOM_COLOR"]);
  });
});

describe("gym scales over time", () => {
  const cd: GymScales = { gradingSystem: "CLIMBING_DISTRICT_LEVEL", formerGradingSystems: ["CLIMBING_DISTRICT_COLOR"] };
  const arkose: GymScales = { gradingSystem: "ARKOSE_COLOR" };

  it("lists the current scale first, then former ones", () => {
    expect(boulderSystemsForGym(cd)).toEqual(["CLIMBING_DISTRICT_LEVEL", "CLIMBING_DISTRICT_COLOR"]);
    expect(boulderSystemsForGym(arkose)).toEqual(["ARKOSE_COLOR"]);
    expect(acceptsBoulderSystem(cd, "CLIMBING_DISTRICT_COLOR")).toBe(true);
    expect(acceptsBoulderSystem(cd, "ARKOSE_COLOR")).toBe(false);
    expect(acceptsBoulderSystem(arkose, "CLIMBING_DISTRICT_LEVEL")).toBe(false);
  });

  it("defaults new sessions to the current scale when no transition date is verified", () => {
    expect(defaultBoulderSystem(cd, new Date("2020-01-01T10:00:00Z"))).toBe("CLIMBING_DISTRICT_LEVEL");
    expect(defaultBoulderSystem(cd, NOW)).toBe("CLIMBING_DISTRICT_LEVEL");
  });

  it("uses the former scale before a verified transition date only", () => {
    const dated: GymScales = { ...cd, gradingSystemSince: "2026-09-01" };
    expect(defaultBoulderSystem(dated, new Date("2026-08-31T12:00:00Z"))).toBe("CLIMBING_DISTRICT_COLOR");
    // Midnight Paris time (UTC+2 in September) starts the new scale.
    expect(defaultBoulderSystem(dated, new Date("2026-08-31T22:30:00Z"))).toBe("CLIMBING_DISTRICT_LEVEL");
    expect(defaultBoulderSystem(dated, new Date("2026-10-01T12:00:00Z"))).toBe("CLIMBING_DISTRICT_LEVEL");
  });

  it("keeps an old colour session in colours (no forced conversion)", () => {
    expect(sessionBoulderSystem({ grade_system: "CLIMBING_DISTRICT_COLOR" }, cd)).toBe("CLIMBING_DISTRICT_COLOR");
    expect(sessionBoulderSystem({ grade_system: "CLIMBING_DISTRICT_LEVEL" }, cd)).toBe("CLIMBING_DISTRICT_LEVEL");
    expect(sessionBoulderSystem({ grade_system: null }, cd)).toBe("CLIMBING_DISTRICT_LEVEL");
    // A scale the gym never used is ignored rather than trusted.
    expect(sessionBoulderSystem({ grade_system: "ARKOSE_COLOR" }, cd)).toBe("CLIMBING_DISTRICT_LEVEL");
  });
});

/**
 * Synthetic climber at a Climbing District gym, with older colour sessions and
 * newer level sessions. (Deliberately NOT anyone's real reference climbs.)
 */
function mixedDataset(): ClimbingDataset {
  const gym = (p: ReturnType<typeof problem>) => ({ ...p, gymId: "cd" });
  const blue = gym(problem("BLUE", "CLIMBING_DISTRICT_COLOR"));
  const pink = gym(problem("PINK", "CLIMBING_DISTRICT_COLOR"));
  const black = gym(problem("BLACK", "CLIMBING_DISTRICT_COLOR"));
  const l3 = gym(problem("3", "CLIMBING_DISTRICT_LEVEL"));
  const l5 = gym(problem("5", "CLIMBING_DISTRICT_LEVEL"));
  const l9 = gym(problem("9", "CLIMBING_DISTRICT_LEVEL"));
  const l10 = gym(problem("10", "CLIMBING_DISTRICT_LEVEL"));
  const l11 = gym(problem("11", "CLIMBING_DISTRICT_LEVEL"));
  const retryOfSent: AttemptFact = {
    id: "a-l11-retry", problemId: l11.id, sessionId: "s-levels", result: "ATTEMPT", attemptNumber: 2, createdAt: daysAgo(3),
  };
  return {
    gyms: [{ id: "cd", name: "CD Test", brand: "CLIMBING_DISTRICT", gradingSystem: "CLIMBING_DISTRICT_LEVEL" }],
    problems: [blue, pink, black, l3, l5, l9, l10, l11],
    attempts: [
      ...attemptsFor(blue, ["ATTEMPT", "TOP"], daysAgo(20), "s-colours"),
      ...attemptsFor(pink, ["TOP"], daysAgo(20), "s-colours"),
      ...attemptsFor(black, ["ATTEMPT", "ATTEMPT"], daysAgo(20), "s-colours"),
      ...attemptsFor(l3, ["TOP"], daysAgo(3), "s-levels"),
      ...attemptsFor(l5, ["FLASH"], daysAgo(3), "s-levels"),
      ...attemptsFor(l9, ["ATTEMPT", "ATTEMPT"], daysAgo(3), "s-levels"),
      ...attemptsFor(l10, ["ATTEMPT"], daysAgo(3), "s-levels"),
      // Sent long ago, only failed again this month: still a completed climb, never "unsent".
      ...attemptsFor(l11, ["TOP"], daysAgo(60), "s-old"),
      retryOfSent,
    ],
    sessions: [session("s-colours", daysAgo(20), 90), session("s-levels", daysAgo(3), 90), session("s-old", daysAgo(60), 90)],
  };
}

describe("progression with both Climbing District scales", () => {
  const data = mixedDataset();
  const snap = computeSnapshot(data, { grade: "7A", system: "FONT" }, NOW, 30);

  it("reports one highest grade per scale, never merged", () => {
    expect(snap.highestSent).toHaveLength(2);
    expect(snap.highestSent).toContainEqual({ system: "CLIMBING_DISTRICT_COLOR", grade: "BLUE", normalized: null });
    expect(snap.highestSent).toContainEqual({ system: "CLIMBING_DISTRICT_LEVEL", grade: "5", normalized: null });
    expect(snap.highestFlashed).toEqual([{ system: "CLIMBING_DISTRICT_LEVEL", grade: "5", normalized: null }]);
  });

  it("tracks tried-but-not-sent separately, and never as a send", () => {
    expect(snap.highestUnsent).toHaveLength(2);
    expect(snap.highestUnsent).toContainEqual({ system: "CLIMBING_DISTRICT_COLOR", grade: "BLACK", normalized: null });
    // Level 11 was sent before the period: a failed retry does not make it "unsent".
    expect(snap.highestUnsent).toContainEqual({ system: "CLIMBING_DISTRICT_LEVEL", grade: "10", normalized: null });
    // Levels 9 and 10 were only tried: not tops, not in the highest send.
    expect(snap.counts.tops).toBe(4); // BLUE, PINK, level 3, level 5
    expect(snap.highestSent.find((h) => h.system === "CLIMBING_DISTRICT_LEVEL")?.grade).toBe("5");
  });

  it("keeps grade distributions per scale, levels in numeric order", () => {
    const levels = snap.nativeDistribution.find((d) => d.system === "CLIMBING_DISTRICT_LEVEL")!;
    expect(levels.buckets.map((b) => b.grade)).toEqual(["3", "5", "9", "10", "11"]);
    const colours = snap.nativeDistribution.find((d) => d.system === "CLIMBING_DISTRICT_COLOR")!;
    expect(colours.buckets.map((b) => b.grade)).toEqual(["BLUE", "BLACK", "PINK"]);
    const cdNetwork = snap.crossGym.native.find((n) => n.brand === "CLIMBING_DISTRICT")!;
    expect(cdNetwork.distributions.map((d) => d.system).sort()).toEqual(["CLIMBING_DISTRICT_COLOR", "CLIMBING_DISTRICT_LEVEL"]);
  });

  it("computes trends and working levels per scale", () => {
    const scales = snap.trends.map((t) => t.scale);
    expect(scales).toContain("CLIMBING_DISTRICT_LEVEL");
    expect(scales).toContain("CLIMBING_DISTRICT_COLOR");
    expect(snap.workingLevels.map((w) => w.system).sort()).toEqual(["CLIMBING_DISTRICT_COLOR", "CLIMBING_DISTRICT_LEVEL"]);
  });

  it("gives a working level in levels from level problems only", () => {
    const fours = Array.from({ length: 5 }, () => ({ ...problem("4", "CLIMBING_DISTRICT_LEVEL"), gymId: "cd" }));
    const blues = Array.from({ length: 5 }, () => ({ ...problem("BLUE", "CLIMBING_DISTRICT_COLOR"), gymId: "cd" }));
    const d: ClimbingDataset = {
      ...data,
      problems: [...fours, ...blues],
      attempts: [
        ...fours.flatMap((p, i) => attemptsFor(p, i < 3 ? ["ATTEMPT", "TOP"] : ["ATTEMPT"], daysAgo(5), "s-levels")),
        ...blues.flatMap((p) => attemptsFor(p, ["ATTEMPT"], daysAgo(5), "s-colours")),
      ],
    };
    const s = computeSnapshot(d, { grade: "7A", system: "FONT" }, NOW, 30);
    expect(s.workingLevels.find((w) => w.system === "CLIMBING_DISTRICT_LEVEL")?.level).toBe("4");
    // The unsent colours neither lower nor raise the level working level.
    expect(s.workingLevels.find((w) => w.system === "CLIMBING_DISTRICT_COLOR")?.level).toBeNull();
  });

  it("measures a levels objective against level problems only", () => {
    const road = calculateRoadToTarget("8", "CLIMBING_DISTRICT_LEVEL", data.problems, data.attempts, NOW);
    expect(road.targetSystem).toBe("CLIMBING_DISTRICT_LEVEL");
    expect(road.workingLevel.system).toBe("CLIMBING_DISTRICT_LEVEL");
    // The colour problems tried in the window are not part of a levels objective.
    expect(road.dimensions.find((x) => x.key === "grade_exposure")?.evidence.sample).toBe(5);
  });

  it("summarises a mixed session per scale", () => {
    const s = summarizeSession(session("s-levels", daysAgo(3), 90), data.problems, data.attempts);
    expect(s.highestSent).toEqual([{ system: "CLIMBING_DISTRICT_LEVEL", grade: "5", normalized: null }]);
    expect(s.highestUnsent).toEqual([{ system: "CLIMBING_DISTRICT_LEVEL", grade: "10", normalized: null }]);
  });
});

describe("Patrick context with Climbing District scales", () => {
  const data = mixedDataset();
  const target = { grade: "8", system: "CLIMBING_DISTRICT_LEVEL" };
  const ctx = buildCoachContext({
    climber: { name: "Alex", language: "fr", target },
    snapshot30: computeSnapshot(data, { grade: "8", system: "CLIMBING_DISTRICT_LEVEL" }, NOW, 30),
    snapshot90: computeSnapshot(data, { grade: "8", system: "CLIMBING_DISTRICT_LEVEL" }, NOW, 90),
    recentSessions: [],
    activeProjects: [],
    now: NOW,
  });

  it("gets both real scales and the rule never to compare them", () => {
    const scales = ctx.gradeScales as Record<string, { ordered: string[]; unranked: string[] }>;
    expect(scales.CLIMBING_DISTRICT_LEVEL).toEqual({ ordered: LEVELS, unranked: [] });
    expect(scales.CLIMBING_DISTRICT_COLOR.unranked).toEqual(["PINK"]);
    expect(ctx.definitions.climbingDistrictScales).toMatch(/never convert, merge or compare/);
    expect(ctx.last30Days.hardestTriedNotSent).toContainEqual({ system: "CLIMBING_DISTRICT_LEVEL", grade: "10", fontEstimate: null });
  });

  it("does not mention Climbing District scales to climbers who never used them", () => {
    const arkose = { ...problem("RED"), gymId: "ark" };
    const only: ClimbingDataset = {
      gyms: [{ id: "ark", name: "Arkose X", brand: "ARKOSE", gradingSystem: "ARKOSE_COLOR" }],
      problems: [arkose],
      attempts: attemptsFor(arkose, ["TOP"], daysAgo(2), "s1"),
      sessions: [session("s1", daysAgo(2), 60)],
    };
    const t = { grade: "7A", system: "FONT" as const };
    const plain = buildCoachContext({
      climber: { name: "Alex", language: "fr", target: t },
      snapshot30: computeSnapshot(only, t, NOW, 30),
      snapshot90: computeSnapshot(only, t, NOW, 90),
      recentSessions: [],
      activeProjects: [],
      now: NOW,
    });
    expect(plain.definitions).not.toHaveProperty("climbingDistrictScales");
    expect(plain.gradeScales).not.toHaveProperty("CLIMBING_DISTRICT_LEVEL");
  });
});
