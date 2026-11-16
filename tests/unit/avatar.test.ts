import { describe, expect, it } from "vitest";
import {
  assessmentLevel, avatarProgress, MIN_CLIMBS, MIN_SESSIONS, bodyPillar, boulderIndoorPillar, boulderOutdoorPillar, boulderSendsFrom,
  routeIndoorPillar, routeOutdoorPillar, routeSendsFrom, type ClimbSend,
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
/** n sends at `grade`, spread over `sessions` séances (and `sites` sites), on `climbs` different climbs (default n). */
const sends = (grade: string, n: number, sessions: number, opts: { prefix?: string; outdoor?: boolean; sites?: number; climbs?: number } = {}): ClimbSend[] =>
  Array.from({ length: n }, (_, i) => ({
    key: `${opts.prefix ?? grade}-${i % (opts.climbs ?? n)}`, sessionId: `${opts.outdoor ? "o" : "s"}${i % sessions}`, grade,
    outdoor: opts.outdoor ?? false, site: `${opts.outdoor ? "crag" : "gym"}${i % (opts.sites ?? 1)}`,
  }));
/** Outdoor sends: n climbs over `days` days at `sites` sites. */
const out = (grade: string, n: number, days: number, sites = 1, climbs?: number) =>
  sends(grade, n, days, { outdoor: true, sites, climbs, prefix: "out-" + grade });

describe("indoor climbing pillars", () => {
  it("validates a level with 3 different climbs over 5 séances up to Green, never one lucky send", () => {
    expect(MIN_SESSIONS).toBe(5);
    expect(MIN_CLIMBS).toBe(3);
    expect(boulderIndoorPillar(sends("5c", 5, 5)).level).toBe(3);
    expect(boulderIndoorPillar(sends("5c", 5, 5, { climbs: 3 })).level).toBe(3);
    expect(boulderIndoorPillar(sends("5c", 5, 5, { climbs: 2 })).level).toBe(0);
    expect(boulderIndoorPillar(sends("5c", 5, 4)).level).toBe(0);
    expect(boulderIndoorPillar([...sends("6C+", 1, 1), ...sends("5b", 5, 5)]).level).toBe(2);
    // The same problem on every séance counts once.
    expect(boulderIndoorPillar(["s1", "s2", "s3", "s4", "s5"].map((sessionId) => ({ key: "a", sessionId, grade: "6A+", outdoor: false, site: "g" }))).level).toBe(0);
  });

  it("asks for more climbs and séances from Violet", () => {
    expect(boulderIndoorPillar(sends("6A+", 5, 5, { climbs: 3 })).level).toBe(3);
    expect(boulderIndoorPillar(sends("6A+", 5, 5, { climbs: 4 })).level).toBe(4);
    expect(boulderIndoorPillar(sends("6B+", 5, 5)).level).toBe(5);
    expect(boulderIndoorPillar(sends("7A", 5, 5)).level).toBe(5);
    expect(boulderIndoorPillar(sends("7A", 6, 6)).level).toBe(6);
    expect(routeIndoorPillar(sends("6b", 5, 5, { climbs: 4 })).level).toBe(4);
    expect(routeIndoorPillar(sends("7a+", 6, 6))).toEqual({ kind: "climb", level: 6, next: null });
  });

  it("says which criteria are missing: 3/3 routes but 1/5 séances stays White", () => {
    const p = routeIndoorPillar(sends("5c", 3, 1));
    expect(p.level).toBe(0);
    expect(p.next).toEqual({
      level: 1, rule: { grade: "5a", climbs: 3, sessions: 5, sites: 1 }, outdoorOnly: false,
      have: { climbs: 3, sessions: 1, sites: 1 }, missing: ["sessions"],
    });
  });

  it("counts harder sends toward an easier threshold and reads Font in any case", () => {
    const p = boulderIndoorPillar([...sends("5b", 5, 5), ...sends("6A", 1, 1, { prefix: "x" })]);
    expect(p.level).toBe(2);
    expect(p.next).toMatchObject({ level: 3, rule: { grade: "5c" }, have: { climbs: 1, sessions: 1 }, missing: ["climbs", "sessions"] });
    expect(boulderIndoorPillar(sends("5C", 5, 5)).level).toBe(3);
  });

  it("counts outdoor sends for the indoor pillars too", () => {
    expect(boulderIndoorPillar(out("6A+", 5, 5)).level).toBe(4);
  });
});

describe("outdoor climbing pillars", () => {
  it("lets indoor sends fill the outdoor pillar up to Green, never beyond", () => {
    const indoor = sends("7A", 6, 6);
    expect(boulderOutdoorPillar(indoor).level).toBe(3);
    expect(boulderOutdoorPillar(indoor).next).toMatchObject({ level: 4, outdoorOnly: true, rule: { grade: "6A" }, have: { climbs: 0, sessions: 0 } });
    expect(routeOutdoorPillar(sends("6a", 5, 5)).level).toBe(3);
  });

  it("validates Violet with 3 outdoor climbs over 5 days, a notch below indoor", () => {
    expect(boulderOutdoorPillar(out("6A", 5, 5, 1, 3)).level).toBe(4);
    expect(boulderOutdoorPillar(out("6A", 5, 4)).level).toBe(0);
    expect(boulderOutdoorPillar([...sends("5c", 5, 5), ...out("6A", 5, 4)]).level).toBe(3);
    expect(routeOutdoorPillar(out("6a+", 5, 5)).level).toBe(4);
  });

  it("asks two different sites for Blue and Black", () => {
    const oneCrag = boulderOutdoorPillar(out("6B+", 5, 5, 1));
    expect(oneCrag.level).toBe(4);
    expect(oneCrag.next).toMatchObject({ level: 5, have: { climbs: 5, sessions: 5, sites: 1 }, missing: ["sites"] });
    expect(boulderOutdoorPillar(out("6B+", 5, 5, 2)).level).toBe(5);
    expect(boulderOutdoorPillar(out("7A", 5, 5, 2)).level).toBe(6);
    expect(routeOutdoorPillar(out("7a", 5, 5, 2)).level).toBe(6);
    expect(routeOutdoorPillar(out("6b+", 5, 5, 2)).level).toBe(5);
    expect(routeOutdoorPillar(out("7a", 5, 4, 2)).level).toBe(0);
  });
});

describe("body pillars", () => {
  it("takes the lowest test and side, and needs two assessments", () => {
    const a = { results: [...assessment({ A: 3, C: 2 }).results, r("B", "LEFT", 3), r("B", "RIGHT", 1)] };
    expect(assessmentLevel(a.results, "flexibility")).toEqual({ level: 1, weakest: ["B"] });
    expect(bodyPillar([a], "flexibility")).toMatchObject({ level: 0, next: { level: 1, latest: 1, assessments: 1, weakest: ["B"], needed: 1 } });
    expect(bodyPillar([a, assessment({ A: 2, B: 2, C: 2 })], "flexibility").level).toBe(1);
  });

  it("needs two new assessments when the latest one is below the next level", () => {
    const low = assessment({ A: 0, B: 0, C: 0 });
    expect(bodyPillar([low], "mobility").next).toMatchObject({ level: 1, latest: 0, needed: 2 });
    expect(bodyPillar([assessment({ A: 2, B: 2, C: 2 }), low], "mobility").next).toMatchObject({ level: 1, latest: 2, needed: 1 });
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
  it("is the lowest of the six pillars", () => {
    const body = assessment({ A: 1, B: 1, C: 3, D: 3 });
    const progress = avatarProgress({ boulderSends: sends("5b", 5, 5), routeSends: sends("6a", 5, 5), assessments: [body, body] });
    expect(progress.pillars.mobility.level).toBe(3);
    expect(progress.pillars.flexibility.level).toBe(1);
    expect(progress.pillars.boulderIndoor.level).toBe(2);
    expect(progress.pillars.boulderOutdoor.level).toBe(2);
    expect(progress.pillars.routeIndoor.level).toBe(3);
    expect(progress.pillars.routeOutdoor.level).toBe(3);
    expect(progress).toMatchObject({ level: 1, colour: "YELLOW", blocking: ["flexibility"], nextLevel: 2 });
  });

  it("starts at White with nothing recorded", () => {
    expect(avatarProgress({ boulderSends: [], routeSends: [], assessments: [] })).toMatchObject({
      level: 0, colour: "WHITE", blocking: ["mobility", "flexibility", "boulderIndoor", "boulderOutdoor", "routeIndoor", "routeOutdoor"], nextLevel: 1,
    });
  });

  it("reaches Green on indoor climbing alone, and needs outdoor for Violet", () => {
    const top = assessment({ A: 4, B: 4, C: 4, D: 4 });
    const indoorOnly = avatarProgress({ boulderSends: sends("7A", 6, 6), routeSends: sends("7a", 6, 6), assessments: [top, top] });
    expect(indoorOnly).toMatchObject({ level: 3, colour: "GREEN", blocking: ["boulderOutdoor", "routeOutdoor"], nextLevel: 4 });
    const withOutdoor = avatarProgress({
      boulderSends: [...sends("7A", 6, 6), ...out("6A", 5, 5)], routeSends: [...sends("7a", 6, 6), ...out("6b", 5, 5)], assessments: [top, top],
    });
    // Violet, held by the body pillars' cap and the outdoor pillars (Blue asks two sites).
    expect(withOutdoor).toMatchObject({ level: 4, colour: "VIOLET", blocking: ["mobility", "flexibility", "boulderOutdoor", "routeOutdoor"], nextLevel: null });
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
      { key: "p:font", sessionId: "s1", grade: "5c", outdoor: false, site: "g" },
      { key: "p:green", sessionId: "s1", grade: "6A", outdoor: false, site: "g" },
      { key: "b:KILTER:arete:40", sessionId: "s3", grade: "6B+", outdoor: false, site: "board:KILTER" },
    ]);
  });

  it("marks problems at an outdoor site as outdoor sends", () => {
    const problems = [problem("bleau", { gymId: "cuvier" }), problem("gym", {})];
    const gyms = [{ id: "cuvier", brand: "OUTDOOR" }, { id: "g", brand: "ARKOSE" }];
    expect(boulderSendsFrom(problems, [attempt("bleau", "TOP"), attempt("gym", "TOP")], [], gyms).map((s) => [s.key, s.outdoor, s.site])).toEqual([
      ["p:bleau", true, "cuvier"], ["p:gym", false, "g"],
    ]);
  });

  it("keeps clean lead ascents, a named route once per site, outdoor at an outdoor site", () => {
    const rows = [
      { id: "1", sessionId: "s1", gymId: "g", grade: "6a", style: "LEAD", result: "REDPOINT", routeName: "La Dalle" },
      { id: "2", sessionId: "s2", gymId: "g", grade: "6a", style: "LEAD", result: "ONSIGHT", routeName: " la dalle " },
      { id: "3", sessionId: "s2", gymId: "g", grade: "6a", style: "TOPROPE", result: "FLASH", routeName: "" },
      { id: "4", sessionId: "s2", gymId: "g", grade: "6b", style: "LEAD", result: "TOP_WITH_REST", routeName: "" },
      { id: "5", sessionId: "s2", gymId: "g", grade: "6a", style: "LEAD", result: "FLASH", routeName: "" },
      { id: "6", sessionId: "s3", gymId: "crag", grade: "6a", style: "LEAD", result: "REDPOINT", routeName: "La Dalle" },
    ] as Parameters<typeof routeSendsFrom>[0];
    const sent = routeSendsFrom(rows, [{ id: "crag", brand: "OUTDOOR" }]);
    expect(sent.map((s) => s.key)).toEqual(["n:g:la dalle", "n:g:la dalle", "a:5", "n:crag:la dalle"]);
    expect(sent.map((s) => s.outdoor)).toEqual([false, false, false, true]);
  });
});
