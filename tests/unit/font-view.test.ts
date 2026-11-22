import { describe, expect, it } from "vitest";
import { computeSnapshot } from "@/lib/analytics";
import { gradePyramid, topLevelRates, weeklyHardest } from "@/lib/analytics/charts";
import { conversionSummary, convertProblem, fontTarget, fontView, gradedOnly, singleFontGrade } from "@/lib/analytics/font-view";
import { boulderBests } from "@/lib/analytics/notebook";
import { headlineRow, scaleRows } from "@/lib/analytics/scale-rows";
import type { AttemptFact, ClimbingDataset, ProblemFact } from "@/lib/analytics/types";
import type { GradeSystem } from "@/lib/climbing/types";
import { conversionTable, toOverrides } from "@/lib/grading/harmonise";

// Synthetic climber: no real history.
const problem = (id: string, gymId: string, system: GradeSystem, grade: string, over: Partial<ProblemFact> = {}): ProblemFact => ({
  id, gymId, nativeGrade: grade, nativeGradeSystem: system, wallAngle: "VERTICAL", tags: [], ...over,
});
const attempt = (problemId: string, day: string, result: AttemptFact["result"] = "TOP", n = 1): AttemptFact => ({
  id: `${problemId}-${day}-${n}`, problemId, sessionId: "s-" + day, result, attemptNumber: n, createdAt: new Date(day + "T18:00:00Z"),
});

describe("singleFontGrade: one Font grade per span", () => {
  it("is the middle of the span, rounded down when it falls between two grades", () => {
    expect(singleFontGrade({ from: "6A", to: "6A" })).toBe("6A");
    expect(singleFontGrade({ from: "6B", to: "6B+" })).toBe("6B"); // Arkose red
    expect(singleFontGrade({ from: "6C+", to: "7A" })).toBe("6C+"); // Arkose black
    expect(singleFontGrade({ from: "5c", to: "6A+" })).toBe("6A"); // Climb World 3: odd span, exact middle
    expect(singleFontGrade({ from: "7B", to: "7C" })).toBe("7B+"); // Arkose purple
    expect(singleFontGrade({ from: "4a", to: "4c" })).toBe("4b");
  });
});

describe("convertProblem: the order of the sources", () => {
  const table = conversionTable();
  it("keeps a native Font grade as it is", () => {
    expect(convertProblem(problem("f", "out", "FONT", "7A"), table)).toMatchObject({ grade: "7A", source: "FONT_NATIVE", confidence: 1 });
  });
  it("uses the default table for a gym grade, keeping the native grade and the span", () => {
    expect(convertProblem(problem("r", "ark", "ARKOSE_COLOR", "RED"), table)).toEqual({
      native: { system: "ARKOSE_COLOR", grade: "RED" }, grade: "6B", span: { from: "6B", to: "6B+" }, source: "OBSERVED", confidence: 0.6,
    });
    expect(convertProblem(problem("w", "cw", "CLIMB_WORLD_LEVEL", "4"), table)).toMatchObject({ grade: "6B", source: "LEBLOND_ESTIMATE" });
    expect(convertProblem(problem("b", "bo", "BLOCKOUT_LEVEL", "B8"), table)).toMatchObject({ grade: "6C", source: "OBSERVED" });
  });
  it("lets the climber's own line win over the default", () => {
    const own = conversionTable(toOverrides([{ grade_system: "ARKOSE_COLOR", native_grade: "RED", font_from: "6B+", font_to: "6C" }]));
    expect(convertProblem(problem("r", "ark", "ARKOSE_COLOR", "RED"), own)).toMatchObject({ grade: "6B+", source: "USER_SETTING", span: { from: "6B+", to: "6C" } });
  });
  it("lets a confident per-problem estimate win over the climber's line", () => {
    const own = conversionTable(toOverrides([{ grade_system: "ARKOSE_COLOR", native_grade: "RED", font_from: "6B+", font_to: "6C" }]));
    const p = problem("r", "ark", "ARKOSE_COLOR", "RED", { normalizedGrade: "6C+", normalizedGradeSystem: "FONT", normalizationConfidence: 0.85 });
    expect(convertProblem(p, own)).toMatchObject({ grade: "6C+", source: "PROBLEM_ESTIMATE" });
  });
  it("never guesses: mystery pink, custom colours and unknown grades have no Font grade", () => {
    expect(convertProblem(problem("p", "cd", "CLIMBING_DISTRICT_COLOR", "PINK"), table)).toBeNull();
    expect(convertProblem(problem("c", "ind", "CUSTOM_COLOR", "RED"), table)).toBeNull();
    expect(convertProblem(problem("u", "ind", "UNKNOWN", "UNKNOWN"), table)).toBeNull();
  });
});

// The screenshot's situation: six gym scales, one card each before this change.
const now = new Date("2026-11-22T12:00:00Z");
const gyms: ClimbingDataset["gyms"] = [
  { id: "ark", name: "Arkose E2E", brand: "ARKOSE", gradingSystem: "ARKOSE_COLOR" },
  { id: "cw", name: "Climb World E2E", brand: "INDEPENDENT", gradingSystem: "CLIMB_WORLD_LEVEL" },
  { id: "cd", name: "District E2E", brand: "CLIMBING_DISTRICT", gradingSystem: "CLIMBING_DISTRICT_LEVEL" },
  { id: "bo", name: "Block'Out E2E", brand: "BLOCKOUT", gradingSystem: "BLOCKOUT_LEVEL" },
  { id: "ind", name: "Independent E2E", brand: "INDEPENDENT", gradingSystem: "CUSTOM_COLOR" },
];
const data: ClimbingDataset = {
  gyms,
  problems: [
    problem("ark-red-1", "ark", "ARKOSE_COLOR", "RED"),
    problem("ark-red-2", "ark", "ARKOSE_COLOR", "RED"),
    problem("ark-blue", "ark", "ARKOSE_COLOR", "BLUE"),
    problem("cw-4", "cw", "CLIMB_WORLD_LEVEL", "4"), // 6B–6B+ → 6B, same grade as Arkose red
    problem("cd-5", "cd", "CLIMBING_DISTRICT_LEVEL", "5"), // 5c–6A → 5c
    problem("cd-pink", "cd", "CLIMBING_DISTRICT_COLOR", "PINK"),
    problem("bo-b8", "bo", "BLOCKOUT_LEVEL", "B8"), // 6C
    problem("ind-red", "ind", "CUSTOM_COLOR", "RED"),
  ],
  attempts: [
    attempt("ark-red-1", "2026-11-10", "ATTEMPT"), attempt("ark-red-1", "2026-11-12", "TOP", 2),
    attempt("ark-red-2", "2026-11-12", "ATTEMPT"),
    attempt("ark-blue", "2026-11-03", "FLASH"),
    attempt("cw-4", "2026-11-17", "TOP"),
    attempt("cd-5", "2026-11-18", "FLASH"),
    attempt("cd-pink", "2026-11-18", "TOP"),
    attempt("bo-b8", "2026-11-19", "ATTEMPT"),
    attempt("ind-red", "2026-11-20", "TOP"),
  ],
  sessions: ["2026-11-03", "2026-11-10", "2026-11-12", "2026-11-17", "2026-11-18", "2026-11-19", "2026-11-20"].map((d) => ({
    id: "s-" + d, gymId: "ark", startedAt: new Date(d + "T17:00:00Z"), endedAt: null, durationMinutes: 90,
  })),
};

describe("fontView: Progrès on one boulder scale", () => {
  const view = fontView(data, conversionTable());
  const fd = view.dataset;

  it("puts every convertible boulder on Font and the rest on UNKNOWN, never changing the input", () => {
    expect(new Set(fd.problems.map((p) => p.nativeGradeSystem))).toEqual(new Set(["FONT", "UNKNOWN"]));
    expect(fd.problems.find((p) => p.id === "cw-4")).toMatchObject({ nativeGrade: "6B", conversion: { native: { system: "CLIMB_WORLD_LEVEL", grade: "4" } } });
    expect(fd.problems.find((p) => p.id === "cd-pink")).toMatchObject({ nativeGradeSystem: "UNKNOWN", conversion: null });
    expect([...view.unconverted.keys()].sort()).toEqual(["cd-pink", "ind-red"]);
    expect(data.problems.find((p) => p.id === "cw-4")!.nativeGradeSystem).toBe("CLIMB_WORLD_LEVEL");
    // Attempts and sessions untouched, so counts still include the unconverted boulders.
    expect(fd.attempts).toBe(data.attempts);
  });

  it("gives ONE top-grade send-rate series, on Font, every gym together", () => {
    const series = topLevelRates(fd.problems, fd.attempts, ["FONT"], now, 12);
    expect(series).toHaveLength(1);
    expect(series[0].system).toBe("FONT");
    // Hardest Font grade sent: 6B (Arkose red + Climb World 4), then 6A (Arkose blue)... B8 6C was only tried.
    expect(series[0].grades.map((g) => g.grade)).toEqual(["6B", "6A"]);
    expect(series[0].grades[0].recent).toEqual({ tried: 3, sent: 2, rate: 2 / 3 });
  });

  it("gives one Font pyramid and one Font level curve", () => {
    expect(gradePyramid(fd.problems, fd.attempts, "FONT", now, 90).map((r) => [r.grade, r.sent, r.tried])).toEqual([
      ["6C", 0, 1], ["6B", 2, 1], ["6A", 1, 0], ["5c", 1, 0],
    ]);
    expect(weeklyHardest(fd.problems, fd.attempts, "FONT", now, 90).map((p) => p.grade)).toEqual(["6A", "6B", "6B"]);
  });

  it("gives one Font row of levels and one Font record, which keeps the grade as logged", () => {
    const snap = computeSnapshot(fd, { grade: "6C", system: "FONT" }, now, 90);
    expect(scaleRows(snap).map((r) => r.system)).toEqual(["FONT"]);
    expect(headlineRow(scaleRows(snap))).toBeNull(); // too few boulders for a working level, and no other scale to lead
    expect(snap.highestSent.map((h) => [h.system, h.grade])).toEqual([["FONT", "6B"]]);
    expect(snap.counts.tops).toBe(6); // the pink and the custom red still count as sends
    const bests = boulderBests(fd.problems, fd.attempts);
    expect(bests).toHaveLength(1);
    expect(bests[0]).toMatchObject({ system: "FONT", grade: "6B", sends: 4 });
    expect(bests[0].conversion?.native.system).toMatch(/ARKOSE_COLOR|CLIMB_WORLD_LEVEL/);
  });

  it("compares gyms on Font: no per-scale block, the unconverted ones left out of the distributions", () => {
    const snap = computeSnapshot(fd, { grade: "6C", system: "FONT" }, now, 90);
    for (const n of snap.crossGym.native) expect(gradedOnly(n.distributions).every((d) => d.system === "FONT")).toBe(true);
    const district = snap.gymBreakdown.find((g) => g.gym.id === "cd")!;
    expect(district.problems).toBe(2); // the pink counts in the gym's volume…
    expect(gradedOnly(district.distributions)).toEqual([{ system: "FONT", buckets: [{ grade: "5c", attempted: 1, sent: 1, flashed: 1 }] }]); // …not in its grades
  });

  it("names what was converted, from where and how, and what was counted apart", () => {
    const s = conversionSummary(view, data.attempts);
    expect(s.font).toBe(0);
    expect(s.converted).toEqual([
      { system: "ARKOSE_COLOR", source: "OBSERVED", problems: 3 },
      { system: "BLOCKOUT_LEVEL", source: "OBSERVED", problems: 1 },
      { system: "CLIMB_WORLD_LEVEL", source: "LEBLOND_ESTIMATE", problems: 1 },
      { system: "CLIMBING_DISTRICT_LEVEL", source: "SHARED_ESTIMATE", problems: 1 },
    ]);
    expect(s.convertedTotal).toBe(6);
    expect(s.unconverted).toEqual([
      { system: "CLIMBING_DISTRICT_COLOR", grade: "PINK", problems: 1 },
      { system: "CUSTOM_COLOR", grade: "RED", problems: 1 },
    ]);
    expect(s.weakestConfidence).toBe(0.35);
    // Only the boulders tried in the attempts given (a period, a place).
    expect(conversionSummary(view, data.attempts.filter((a) => a.problemId === "ark-blue"))).toMatchObject({ convertedTotal: 1, unconverted: [] });
  });
});

describe("fontTarget", () => {
  it("reads a gym-grade target on Font by the same rule, and leaves what cannot convert", () => {
    expect(fontTarget({ grade: "BLACK", system: "ARKOSE_COLOR" }, conversionTable())).toEqual({ grade: "6C+", system: "FONT" });
    expect(fontTarget({ grade: "7A", system: "FONT" }, conversionTable())).toEqual({ grade: "7A", system: "FONT" });
    expect(fontTarget({ grade: "RED", system: "CUSTOM_COLOR" }, conversionTable())).toEqual({ grade: "RED", system: "CUSTOM_COLOR" });
  });
});
