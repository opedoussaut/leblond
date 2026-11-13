import { describe, expect, it } from "vitest";
import {
  assessmentLevel, avatarProgress, bodyPillar, boulderPillar, boulderSendsFrom, routePillar, routeSendsFrom, type ClimbSend,
} from "@/lib/analytics/avatar";
import type { BoardAscentFact } from "@/lib/analytics/boards";
import type { AttemptFact, ProblemFact } from "@/lib/analytics/types";
import type { MobilityResult } from "@/lib/training/hip-mobility/assessment";

const r = (test: MobilityResult["test"], side: MobilityResult["side"], level: number | null, over: Partial<MobilityResult> = {}): MobilityResult => ({
  test, side, done: true, skipReason: null, level, value: null, support: "NONE", discomfort: 0, discomfortArea: null, active: true, flags: [], ...over,
});
/** Every test, both sides, at the given levels. */
const assessment = (levels: Partial<Record<MobilityResult["test"], number>>) => ({
  results: Object.entries(levels).flatMap(([test, level]) => [r(test as MobilityResult["test"], "LEFT", level!), r(test as MobilityResult["test"], "RIGHT", level!)]),
});
/** n different climbs at `grade`, spread over `sessions` séances. */
const sends = (grade: string, n: number, sessions: number, prefix = grade): ClimbSend[] =>
  Array.from({ length: n }, (_, i) => ({ key: `${prefix}-${i}`, sessionId: `s${i % sessions}`, grade }));

describe("climbing pillars", () => {
  it("validates a level with 3 different climbs over 2 séances, never one lucky send", () => {
    expect(boulderPillar(sends("5c", 3, 2)).level).toBe(3);
    expect(boulderPillar(sends("5c", 3, 1)).level).toBe(0);
    expect(boulderPillar([...sends("6C+", 1, 1), ...sends("5b", 3, 2)]).level).toBe(2);
    // The same problem three times counts once.
    expect(boulderPillar([{ key: "a", sessionId: "s1", grade: "6A+" }, { key: "a", sessionId: "s2", grade: "6A+" }, { key: "a", sessionId: "s3", grade: "6A+" }]).level).toBe(0);
  });

  it("counts harder sends toward an easier threshold and reports progress toward the next one", () => {
    const p = boulderPillar([...sends("5b", 2, 2), ...sends("6A", 1, 1, "x")]);
    expect(p.level).toBe(2);
    expect(p.next).toEqual({ level: 3, grade: "5c", climbs: 1, sessions: 1 });
  });

  it("reads Font grades whatever their case and routes in the French scale", () => {
    expect(boulderPillar(sends("5C", 3, 2)).level).toBe(3);
    expect(boulderPillar(sends("6b+", 3, 2)).level).toBe(5);
    expect(routePillar(sends("6b", 3, 2)).level).toBe(4);
    expect(routePillar(sends("7a+", 3, 2)).level).toBe(6);
    expect(routePillar(sends("7a+", 3, 2)).next).toBeNull();
  });
});

describe("body pillars", () => {
  it("takes the lowest test and side, and needs two assessments", () => {
    const a = { results: [...assessment({ A: 3, C: 2 }).results, r("B", "LEFT", 3), r("B", "RIGHT", 1)] };
    expect(assessmentLevel(a.results, "flexibility")).toEqual({ level: 1, weakest: ["B"] });
    expect(bodyPillar([a], "flexibility")).toMatchObject({ level: 0, next: { level: 1, latest: 1, assessments: 1, weakest: ["B"] } });
    expect(bodyPillar([a, assessment({ A: 2, B: 2, C: 2 })], "flexibility").level).toBe(1);
  });

  it("treats pain as level 0, ignores an optional test not done, and refuses a missing required test", () => {
    const pain = [...assessment({ A: 2, D: 4 }).results, r("B", "LEFT", null, { done: false, skipReason: "PAIN" }), r("B", "RIGHT", 2), ...assessment({ C: 3 }).results];
    expect(assessmentLevel(pain, "flexibility")?.level).toBe(0);
    expect(assessmentLevel(assessment({ C: 3 }).results, "mobility")).toEqual({ level: 3, weakest: ["C"] });
    expect(assessmentLevel(assessment({ C: 3, D: 2 }).results, "mobility")?.level).toBe(2);
    expect(assessmentLevel(assessment({ A: 3 }).results, "flexibility")).toBeNull();
  });

  it("stops at Violet: the beginner protocol cannot validate Blue or Black", () => {
    const top = assessment({ A: 4, B: 4, C: 4, D: 4 });
    expect(bodyPillar([top, top], "mobility")).toEqual({ kind: "body", level: 4, next: null, capped: true });
  });
});

describe("avatar", () => {
  it("is the lowest pillar: Green, Yellow, Orange, Green gives Yellow, held back by flexibility", () => {
    const body = assessment({ A: 1, B: 1, C: 3, D: 3 });
    const progress = avatarProgress({ boulderSends: sends("5b", 3, 2), routeSends: sends("6a", 3, 2), assessments: [body, body] });
    expect(progress.pillars.mobility.level).toBe(3);
    expect(progress.pillars.flexibility.level).toBe(1);
    expect(progress.pillars.boulder.level).toBe(2);
    expect(progress.pillars.route.level).toBe(3);
    expect(progress).toMatchObject({ level: 1, colour: "YELLOW", blocking: ["flexibility"], nextLevel: 2 });
  });

  it("starts at White with nothing recorded", () => {
    expect(avatarProgress({ boulderSends: [], routeSends: [], assessments: [] })).toMatchObject({
      level: 0, colour: "WHITE", blocking: ["mobility", "flexibility", "boulder", "route"], nextLevel: 1,
    });
  });

  it("has no next colour while the body pillars are capped at Violet", () => {
    const top = assessment({ A: 4, B: 4, C: 4, D: 4 });
    const p = avatarProgress({ boulderSends: sends("7A", 3, 2), routeSends: sends("7a", 3, 2), assessments: [top, top] });
    expect(p).toMatchObject({ level: 4, colour: "VIOLET", blocking: ["mobility", "flexibility"], nextLevel: null });
  });
});

describe("sends from the logbook", () => {
  const problem = (id: string, over: Partial<ProblemFact>): ProblemFact => ({
    id, gymId: "g", nativeGrade: "5c", nativeGradeSystem: "FONT", wallAngle: "VERTICAL", tags: [], ...over,
  } as ProblemFact);
  const attempt = (problemId: string, result: AttemptFact["result"], sessionId = "s1"): AttemptFact => ({
    id: problemId + result + sessionId, problemId, sessionId, result, attemptNumber: 1, createdAt: new Date("2026-11-10T18:00:00Z"),
  });

  it("keeps Font problems and reliable estimates only, and Font board climbs, never V grades", () => {
    const problems = [
      problem("font", {}),
      problem("green", { nativeGrade: "GREEN", nativeGradeSystem: "ARKOSE" as ProblemFact["nativeGradeSystem"], normalizedGrade: "6A", normalizedGradeSystem: "FONT", normalizationConfidence: 0.8 }),
      problem("guess", { nativeGrade: "PINK", nativeGradeSystem: "ARKOSE" as ProblemFact["nativeGradeSystem"], normalizedGrade: "6B", normalizedGradeSystem: "FONT", normalizationConfidence: 0.2 }),
      problem("blue", { nativeGrade: "BLUE", nativeGradeSystem: "ARKOSE" as ProblemFact["nativeGradeSystem"] }),
    ];
    const attempts = [attempt("font", "TOP"), attempt("green", "FLASH"), attempt("guess", "TOP"), attempt("blue", "TOP"), attempt("font", "ATTEMPT", "s2")];
    const board = [
      { id: "b1", sessionId: "s3", board: "KILTER", climbKey: "arete", climbName: "Arête", angle: 40, grade: "6B+", gradeScale: "FONT", tries: 2, result: "SENT", isBenchmark: false, climbedAt: new Date() },
      { id: "b2", sessionId: "s3", board: "KILTER", climbKey: "v", climbName: "V", angle: 40, grade: "V4", gradeScale: "V", tries: 1, result: "FLASH", isBenchmark: false, climbedAt: new Date() },
      { id: "b3", sessionId: "s3", board: "KILTER", climbKey: "no", climbName: "No", angle: 40, grade: "6C", gradeScale: "FONT", tries: 5, result: "ATTEMPT", isBenchmark: false, climbedAt: new Date() },
    ] as BoardAscentFact[];
    expect(boulderSendsFrom(problems, attempts, board)).toEqual([
      { key: "p:font", sessionId: "s1", grade: "5c" },
      { key: "p:green", sessionId: "s1", grade: "6A" },
      { key: "b:KILTER:arete:40", sessionId: "s3", grade: "6B+" },
    ]);
  });

  it("keeps clean lead ascents, a named route once", () => {
    const rows = [
      { id: "1", sessionId: "s1", grade: "6a", style: "LEAD", result: "REDPOINT", routeName: "La Dalle" },
      { id: "2", sessionId: "s2", grade: "6a", style: "LEAD", result: "ONSIGHT", routeName: " la dalle " },
      { id: "3", sessionId: "s2", grade: "6a", style: "TOPROPE", result: "FLASH", routeName: "" },
      { id: "4", sessionId: "s2", grade: "6b", style: "LEAD", result: "TOP_WITH_REST", routeName: "" },
      { id: "5", sessionId: "s2", grade: "6a", style: "LEAD", result: "FLASH", routeName: "" },
    ] as Parameters<typeof routeSendsFrom>[0];
    expect(routeSendsFrom(rows).map((s) => s.key)).toEqual(["n:la dalle", "n:la dalle", "a:5"]);
  });
});
