import { describe, expect, it } from "vitest";
import {
  calculateAllNativeWorkingLevels,
  calculateAttemptsPerSend,
  calculateCrossGymComparison,
  calculateFlashRate,
  calculateHighestFlashedGrade,
  calculateHighestSentGrade,
  calculateNativeWorkingLevel,
  calculateNormalizedDistribution,
  calculateRecentTrend,
  calculateRoadToTarget,
  calculateSendRate,
  calculateStyleStats,
  calculateWallAngleStats,
  calculateWeeklyActivity,
  calculateWearableSessionTrend,
  calculateWorkingGrade,
  computeProblemOutcomes,
  countActivity,
  summarizeSession,
  type AttemptFact,
  type ProblemFact,
} from "@/lib/analytics";
import { attemptsFor, daysAgo, NOW, problem, session } from "./fixtures";

describe("flash logic and outcomes", () => {
  it("flash is a send and counts as flash", () => {
    const p = problem("BLUE");
    const o = computeProblemOutcomes(attemptsFor(p, ["FLASH"])).get(p.id)!;
    expect(o).toMatchObject({ sent: true, flashed: true, attemptsToSend: 1, attempts: 1 });
  });

  it("a TOP on attempt 1 is a send but not a flash unless classified FLASH", () => {
    const p = problem("BLUE");
    const o = computeProblemOutcomes(attemptsFor(p, ["TOP"])).get(p.id)!;
    expect(o.sent).toBe(true);
    expect(o.flashed).toBe(false);
  });

  it("preserves attempt history and finds the first send", () => {
    const p = problem("RED");
    const o = computeProblemOutcomes(attemptsFor(p, ["ATTEMPT", "ATTEMPT", "TOP", "TOP"])).get(p.id)!;
    expect(o).toMatchObject({ attempts: 4, sent: true, flashed: false, attemptsToSend: 3 });
  });

  it("uses global attempt numbers across sessions", () => {
    const p = problem("RED");
    const a: AttemptFact[] = [
      ...attemptsFor(p, ["ATTEMPT", "ATTEMPT"], daysAgo(8), "s-1"),
      { ...attemptsFor(p, ["TOP"], daysAgo(2), "s-2")[0], attemptNumber: 3 },
    ];
    expect(computeProblemOutcomes(a).get(p.id)!.attemptsToSend).toBe(3);
  });

  it("an unsent problem is not a send", () => {
    const p = problem("BLACK");
    const o = computeProblemOutcomes(attemptsFor(p, ["ATTEMPT", "ATTEMPT"])).get(p.id)!;
    expect(o).toMatchObject({ sent: false, flashed: false, attemptsToSend: null });
  });
});

describe("send rate, flash rate, attempts per send", () => {
  const p1 = problem("BLUE");
  const p2 = problem("RED");
  const p3 = problem("RED");
  const p4 = problem("BLACK");
  const attempts = [
    ...attemptsFor(p1, ["FLASH"]),
    ...attemptsFor(p2, ["ATTEMPT", "TOP"]),
    ...attemptsFor(p3, ["ATTEMPT", "ATTEMPT", "ATTEMPT", "TOP"]),
    ...attemptsFor(p4, ["ATTEMPT", "ATTEMPT"]),
  ];
  const outcomes = computeProblemOutcomes(attempts);

  it("send rate = sent problems ÷ attempted problems", () => {
    expect(calculateSendRate(outcomes.values())).toEqual({ numerator: 3, denominator: 4, value: 0.75 });
  });

  it("flash rate = flashed problems ÷ attempted problems", () => {
    expect(calculateFlashRate(outcomes.values())).toEqual({ numerator: 1, denominator: 4, value: 0.25 });
  });

  it("attempts per send = mean attempts to first send over sent problems", () => {
    // (1 + 2 + 4) / 3
    expect(calculateAttemptsPerSend(outcomes.values())).toEqual({ value: 7 / 3, sends: 3, attempts: 7 });
  });

  it("returns null rates on empty data instead of 0%", () => {
    expect(calculateSendRate([]).value).toBeNull();
    expect(calculateFlashRate([]).value).toBeNull();
    expect(calculateAttemptsPerSend([]).value).toBeNull();
  });

  it("counts activity", () => {
    expect(countActivity(attempts)).toEqual({ problems: 4, attempts: 9, tops: 3, flashes: 1 });
  });

  it("finds highest sent and flashed native grades per system", () => {
    expect(calculateHighestSentGrade([p1, p2, p3, p4], outcomes)).toEqual([
      { system: "ARKOSE_COLOR", grade: "RED", normalized: null },
    ]);
    expect(calculateHighestFlashedGrade([p1, p2, p3, p4], outcomes)[0].grade).toBe("BLUE");
  });
});

/** n problems at `grade`, `sent` of them sent, all within the window. */
function block(grade: string, n: number, sent: number, system: ProblemFact["nativeGradeSystem"] = "ARKOSE_COLOR", extra: Partial<ProblemFact> = {}, when = daysAgo(5)) {
  const problems = Array.from({ length: n }, () => problem(grade, system, extra));
  const attempts = problems.flatMap((p, i) => attemptsFor(p, i < sent ? ["ATTEMPT", "TOP"] : ["ATTEMPT", "ATTEMPT"], when));
  return { problems, attempts };
}

describe("native working level", () => {
  it("is the highest level meeting ≥5 problems, ≥3 sends, ≥40% send rate", () => {
    const blue = block("BLUE", 6, 6);
    const red = block("RED", 6, 3); // 50% → qualifies
    const black = block("BLACK", 6, 2); // only 2 sends → no
    const r = calculateNativeWorkingLevel(
      "ARKOSE_COLOR",
      [...blue.problems, ...red.problems, ...black.problems],
      [...blue.attempts, ...red.attempts, ...black.attempts],
      NOW,
    );
    expect(r.level).toBe("RED");
    expect(r.levels.find((l) => l.grade === "BLACK")).toMatchObject({ problems: 6, sends: 2, qualifies: false });
  });

  it("is not the hardest-ever send", () => {
    const blue = block("BLUE", 5, 4);
    const purple = block("PURPLE", 1, 1);
    const r = calculateNativeWorkingLevel(
      "ARKOSE_COLOR",
      [...blue.problems, ...purple.problems],
      [...blue.attempts, ...purple.attempts],
      NOW,
    );
    expect(r.level).toBe("BLUE");
  });

  it("requires the send rate threshold", () => {
    const red = block("RED", 10, 3); // 30%
    expect(calculateNativeWorkingLevel("ARKOSE_COLOR", red.problems, red.attempts, NOW).level).toBeNull();
  });

  it("ignores attempts older than the 60-day window", () => {
    const old = block("RED", 6, 6, "ARKOSE_COLOR", {}, daysAgo(90));
    expect(calculateNativeWorkingLevel("ARKOSE_COLOR", old.problems, old.attempts, NOW).level).toBeNull();
  });

  it("evaluates colour systems independently and ignores PINK", () => {
    const ark = block("RED", 5, 5);
    const cd = block("BLUE", 5, 5, "CLIMBING_DISTRICT_COLOR");
    const pink = block("PINK", 8, 8, "CLIMBING_DISTRICT_COLOR");
    const levels = calculateAllNativeWorkingLevels(
      [...ark.problems, ...cd.problems, ...pink.problems],
      [...ark.attempts, ...cd.attempts, ...pink.attempts],
      NOW,
    );
    expect(levels.find((l) => l.system === "ARKOSE_COLOR")!.level).toBe("RED");
    const cdLevel = levels.find((l) => l.system === "CLIMBING_DISTRICT_COLOR")!;
    expect(cdLevel.level).toBe("BLUE");
    expect(cdLevel.levels.some((l) => l.grade === "PINK")).toBe(false);
  });
});

describe("Font working grade (normalised)", () => {
  const est = (g: string, c = 0.85) => ({
    normalizedGrade: g,
    normalizedGradeSystem: "FONT",
    normalizationConfidence: c,
    normalizationSource: "USER_ESTIMATE",
  });

  it("uses reliable estimates across gyms and native Font problems", () => {
    const a = block("RED", 3, 3, "ARKOSE_COLOR", est("6C"));
    const b = block("BLUE", 2, 2, "CLIMBING_DISTRICT_COLOR", est("6C"));
    const c = block("6C", 1, 0, "FONT");
    const r = calculateWorkingGrade([...a.problems, ...b.problems, ...c.problems], [...a.attempts, ...b.attempts, ...c.attempts], NOW);
    expect(r.level).toBe("6C");
    expect(r.levels[0]).toMatchObject({ grade: "6C", problems: 6, sends: 5 });
  });

  it("is null when estimates are unreliable", () => {
    const a = block("RED", 8, 8, "ARKOSE_COLOR", est("6C", 0.3));
    expect(calculateWorkingGrade(a.problems, a.attempts, NOW).level).toBeNull();
  });
});

describe("cross-gym normalisation handling", () => {
  it("keeps native views separate per network", () => {
    const ark = block("RED", 3, 2);
    for (const p of ark.problems) p.gymId = "ark";
    const cd = block("RED", 4, 1, "CLIMBING_DISTRICT_COLOR");
    for (const p of cd.problems) p.gymId = "cd";
    const result = calculateCrossGymComparison({
      gyms: [
        { id: "ark", name: "Arkose X", brand: "ARKOSE", gradingSystem: "ARKOSE_COLOR" },
        { id: "cd", name: "CD Y", brand: "CLIMBING_DISTRICT", gradingSystem: "CLIMBING_DISTRICT_COLOR" },
      ],
      problems: [...ark.problems, ...cd.problems],
      attempts: [...ark.attempts, ...cd.attempts],
      sessions: [],
    });
    expect(result.native.map((n) => n.brand)).toEqual(["ARKOSE", "CLIMBING_DISTRICT"]);
    expect(result.native[0].distributions[0].buckets).toEqual([{ grade: "RED", attempted: 3, sent: 2, flashed: 0 }]);
    expect(result.native[1].distributions[0].buckets).toEqual([{ grade: "RED", attempted: 4, sent: 1, flashed: 0 }]);
  });

  it("normalised view uses only reliable estimates and reports coverage", () => {
    const reliable = block("RED", 2, 1, "ARKOSE_COLOR", {
      normalizedGrade: "6C",
      normalizedGradeSystem: "FONT",
      normalizationConfidence: 0.6,
    });
    const uncertain = block("BLACK", 1, 0, "ARKOSE_COLOR", {
      normalizedGrade: "7A",
      normalizedGradeSystem: "FONT",
      normalizationConfidence: 0.3,
    });
    const none = block("BLUE", 3, 3);
    const problems = [...reliable.problems, ...uncertain.problems, ...none.problems];
    const outcomes = computeProblemOutcomes([...reliable.attempts, ...uncertain.attempts, ...none.attempts]);
    const n = calculateNormalizedDistribution(problems, outcomes);
    expect(n.buckets).toEqual([{ grade: "6C", attempted: 2, sent: 1, flashed: 0 }]);
    expect(n.coverage).toEqual({ reliable: 2, uncertain: 1, none: 3, total: 6 });
    expect(n.sufficient).toBe(false);
  });
});

describe("styles and wall angles", () => {
  it("aggregates per tag and per angle", () => {
    const slab = block("BLUE", 3, 3, "ARKOSE_COLOR", { tags: ["slab", "balance"], wallAngle: "SLAB" });
    const steep = block("BLUE", 3, 1, "ARKOSE_COLOR", { tags: ["power"], wallAngle: "STEEP" });
    const problems = [...slab.problems, ...steep.problems];
    const outcomes = computeProblemOutcomes([...slab.attempts, ...steep.attempts]);
    const styles = calculateStyleStats(problems, outcomes);
    expect(styles.find((s) => s.key === "slab")).toMatchObject({ problems: 3, sent: 3 });
    expect(styles.find((s) => s.key === "power")!.sendRate.value).toBeCloseTo(1 / 3);
    const angles = calculateWallAngleStats(problems, outcomes);
    expect(angles.map((a) => a.key)).toEqual(["SLAB", "STEEP"]);
  });
});

describe("recent trend", () => {
  it("detects improvement when recent hardest sends are higher", () => {
    const before = block("BLUE", 4, 4, "ARKOSE_COLOR", {}, daysAgo(45));
    const after = block("RED", 4, 4, "ARKOSE_COLOR", {}, daysAgo(5));
    const t = calculateRecentTrend(
      "ARKOSE_COLOR",
      [...before.problems, ...after.problems],
      [...before.attempts, ...after.attempts],
      NOW,
    );
    expect(t.direction).toBe("improving");
    expect(t.recentScore! - t.previousScore!).toBe(1);
  });

  it("reports insufficient data rather than guessing", () => {
    const after = block("RED", 4, 4);
    expect(calculateRecentTrend("ARKOSE_COLOR", after.problems, after.attempts, NOW).direction).toBe("insufficient_data");
  });
});

describe("weekly activity", () => {
  it("returns contiguous weeks including empty ones", () => {
    const b = block("BLUE", 2, 2, "ARKOSE_COLOR", {}, daysAgo(1));
    const weeks = calculateWeeklyActivity([session("s-1", daysAgo(1), 90)], b.attempts, NOW, 4);
    expect(weeks).toHaveLength(4);
    expect(weeks.at(-1)).toMatchObject({ sessions: 1, attempts: 4, tops: 2 });
    expect(weeks[0]).toMatchObject({ sessions: 0, attempts: 0 });
  });
});

describe("session summary", () => {
  it("summarises only the session's own attempts", () => {
    const p1 = problem("RED", "ARKOSE_COLOR", { tags: ["slab"] });
    const p2 = problem("BLUE", "ARKOSE_COLOR", { tags: ["slab"] });
    const p3 = problem("BLACK");
    const s = session("s-today", daysAgo(0, -3), 102);
    const attempts = [
      ...attemptsFor(p1, ["ATTEMPT", "TOP"], daysAgo(0, -2), "s-today"),
      ...attemptsFor(p2, ["FLASH"], daysAgo(0, -2), "s-today"),
      ...attemptsFor(p3, ["ATTEMPT"], daysAgo(10), "s-old"),
    ];
    const sum = summarizeSession(s, [p1, p2, p3], attempts);
    expect(sum).toMatchObject({ problems: 2, attempts: 3, tops: 2, flashes: 1, durationMinutes: 102 });
    expect(sum.highestSent[0].grade).toBe("RED");
    expect(sum.mostSuccessfulStyle?.key).toBe("slab");
    expect(sum.wearable).toBeNull();
  });
});

describe("wearable session trend", () => {
  const w = (avg: number, mins: number) => ({
    provider: "FIT_IMPORT",
    durationSeconds: mins * 60,
    avgHeartRate: avg,
    maxHeartRate: avg + 30,
    calories: null,
    trainingLoad: null,
    deviceName: null,
  });

  it("compares with the previous three sessions of similar duration", () => {
    const sessions = [
      session("a", daysAgo(10), 100, { wearable: w(110, 100) }),
      session("b", daysAgo(8), 95, { wearable: w(112, 95) }),
      session("c", daysAgo(6), 105, { wearable: w(114, 105) }),
      session("short", daysAgo(4), 30, { wearable: w(150, 30) }), // not comparable
      session("now", daysAgo(1), 100, { wearable: w(125, 100) }),
    ];
    const t = calculateWearableSessionTrend("now", sessions)!;
    expect(t.comparableSessions).toBe(3);
    expect(t.baselineAvgHeartRate).toBe(112);
    expect(t.direction).toBe("higher");
  });

  it("returns insufficient data with fewer comparable sessions", () => {
    const sessions = [session("a", daysAgo(10), 100, { wearable: w(110, 100) }), session("now", daysAgo(1), 100, { wearable: w(125, 100) })];
    expect(calculateWearableSessionTrend("now", sessions)!.direction).toBe("insufficient_data");
  });

  it("returns null without wearable data", () => {
    expect(calculateWearableSessionTrend("x", [session("x", daysAgo(1), 60)])).toBeNull();
  });
});

describe("road to target", () => {
  it("returns every dimension with evidence and no composite score", () => {
    const est = { normalizedGrade: "6C", normalizedGradeSystem: "FONT", normalizationConfidence: 0.85 };
    const b = block("RED", 6, 4, "ARKOSE_COLOR", est);
    const r = calculateRoadToTarget("7A", "FONT", b.problems, b.attempts, NOW);
    expect(r.dimensions.map((d) => d.key)).toEqual([
      "grade_exposure",
      "consistency",
      "flash_ability",
      "efficiency",
      "style_coverage",
      "recent_progression",
    ]);
    expect(r.workingLevel.level).toBe("6C");
    const consistency = r.dimensions.find((d) => d.key === "consistency")!;
    expect(consistency.evidence.gradeStepsToTarget).toBe(2); // 6C → 6C+ → 7A
    expect(consistency.status).toBe("needs_work");
    expect(r).not.toHaveProperty("percent");
  });
});
