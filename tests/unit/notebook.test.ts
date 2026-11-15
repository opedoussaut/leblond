import { LIMITERS } from "@/lib/analytics/notebook";
import { notebookDictionary } from "@/lib/i18n/notebook";
import { describe, expect, it } from "vitest";
import {
  boardBests, boulderBests, hangBest, limiterCounts, mainEdge, routeBest, weekIndex, weeklyHang, weeklyMax, weeklyRouteLevel,
} from "@/lib/analytics/notebook";
import type { BoardAscentFact } from "@/lib/analytics/boards";
import type { RouteAscentFact } from "@/lib/analytics/routes";
import type { AttemptFact, ProblemFact } from "@/lib/analytics/types";

const problem = (id: string, grade: string, system: ProblemFact["nativeGradeSystem"] = "FONT"): ProblemFact =>
  ({ id, gymId: "g", nativeGrade: grade, nativeGradeSystem: system, wallAngle: "VERTICAL", tags: [] } as unknown as ProblemFact);
let n = 0;
const attempt = (problemId: string, result: AttemptFact["result"], at: string): AttemptFact =>
  ({ id: String(++n), problemId, sessionId: "s", result, attemptNumber: 1, createdAt: new Date(at) });
const route = (grade: string, result: RouteAscentFact["result"], style: RouteAscentFact["style"], at: string): RouteAscentFact =>
  ({ id: String(++n), sessionId: "s", grade, style, result, falls: null, createdAt: new Date(at) });
const board = (b: BoardAscentFact["board"], grade: string, scale: BoardAscentFact["gradeScale"], result: BoardAscentFact["result"], at: string): BoardAscentFact =>
  ({ id: String(++n), sessionId: "s", board: b, climbKey: String(n), climbName: "x", angle: 40, grade, gradeScale: scale, tries: 1, result, isBenchmark: false, climbedAt: new Date(at) });

describe("boulderBests", () => {
  it("keeps the hardest send per native system, dated by its first send, most used system first", () => {
    const problems = [problem("a", "6A"), problem("b", "6B"), problem("c", "6C"), problem("d", "7", "CLIMBING_DISTRICT_LEVEL")];
    const attempts = [
      attempt("a", "FLASH", "2026-11-01T10:00:00Z"),
      attempt("b", "ATTEMPT", "2026-11-02T10:00:00Z"), attempt("b", "TOP", "2026-11-03T10:00:00Z"), attempt("b", "TOP", "2026-11-09T10:00:00Z"),
      attempt("c", "ATTEMPT", "2026-11-04T10:00:00Z"),
      attempt("d", "TOP", "2026-11-05T10:00:00Z"),
    ];
    expect(boulderBests(problems, attempts)).toEqual([
      { system: "FONT", grade: "6B", date: "2026-11-03", flash: false, sends: 2 },
      { system: "CLIMBING_DISTRICT_LEVEL", grade: "7", date: "2026-11-05", flash: false, sends: 1 },
    ]);
  });
});

describe("routeBest", () => {
  it("takes the hardest clean ascent and prefers lead on the same grade", () => {
    expect(routeBest([
      route("6b", "REDPOINT", "TOPROPE", "2026-10-25T10:00:00Z"),
      route("6b", "REDPOINT", "LEAD", "2026-10-26T10:00:00Z"),
      route("6c", "ATTEMPT", "LEAD", "2026-10-27T10:00:00Z"),
    ])).toEqual({ grade: "6b", style: "LEAD", result: "REDPOINT", date: "2026-10-26" });
    expect(routeBest([route("6a", "ATTEMPT", "LEAD", "2026-10-25T10:00:00Z")])).toBeNull();
  });
});

describe("boardBests", () => {
  it("keeps the hardest send per board in its most used scale", () => {
    expect(boardBests([
      board("TENSION", "5C", "FONT", "SENT", "2026-11-10T10:00:00Z"),
      board("TENSION", "6A", "FONT", "ATTEMPT", "2026-11-11T10:00:00Z"),
      board("TENSION", "V5", "V", "SENT", "2026-11-11T10:00:00Z"),
      board("TENSION", "5B", "FONT", "FLASH", "2026-11-12T10:00:00Z"),
    ])).toEqual([{ board: "TENSION", grade: "5C", scale: "FONT", angle: 40, date: "2026-11-10" }]);
  });
});

describe("hangs", () => {
  const sets = [
    { loadKg: 10, edgeMm: 20, seconds: 10, date: "2026-11-02" },
    { loadKg: 15, edgeMm: 20, seconds: 10, date: "2026-11-09" },
    { loadKg: 30, edgeMm: 30, seconds: 10, date: "2026-11-09" },
  ];
  it("compares loads on the most used edge only", () => {
    expect(mainEdge(sets)).toBe(20);
    expect(hangBest(sets)).toEqual({ loadKg: 15, edgeMm: 20, seconds: 10, date: "2026-11-09", sets: 2 });
    expect(hangBest([])).toBeNull();
    expect(weeklyHang(sets, "2026-11-14", 4)).toEqual([
      { week: 2, value: 10, label: "+10 kg" }, { week: 3, value: 15, label: "+15 kg" },
    ]);
  });
});

describe("weekly series", () => {
  it("places days in the ISO weeks of the period", () => {
    expect(weekIndex("2026-11-14", "2026-11-14", 4)).toBe(3);
    expect(weekIndex("2026-11-09", "2026-11-14", 4)).toBe(3);
    expect(weekIndex("2026-11-08", "2026-11-14", 4)).toBe(2);
    expect(weekIndex("2026-10-01", "2026-11-14", 4)).toBeNull();
  });
  it("keeps the highest value of each week", () => {
    expect(weeklyMax([
      { date: "2026-11-02", value: 3, label: "c" }, { date: "2026-11-03", value: 5, label: "e" }, { date: "2026-11-10", value: 1, label: "a" },
    ], "2026-11-14", 3)).toEqual([{ week: 1, value: 5, label: "e" }, { week: 2, value: 1, label: "a" }]);
    expect(weeklyRouteLevel([route("6a", "REDPOINT", "LEAD", "2026-11-10T10:00:00Z"), route("7a", "ATTEMPT", "LEAD", "2026-11-11T10:00:00Z")], "2026-11-14", 2))
      .toEqual([{ week: 1, value: expect.any(Number), label: "6a" }]);
  });
});

describe("limiterCounts", () => {
  it("offers flexibility and mobility, named in French and English", () => {
    expect(LIMITERS).toContain("FLEXIBILITY");
    expect(LIMITERS).toContain("MOBILITY");
    expect(notebookDictionary("fr").limiters.FLEXIBILITY).toBe("Souplesse");
    expect(notebookDictionary("fr").limiters.MOBILITY).toBe("Mobilité");
    expect(notebookDictionary("en").limiters.MOBILITY).toBe("Mobility");
    expect(limiterCounts([{ date: "2026-11-05", limiters: ["MOBILITY"] }], "2026-11-01").rows).toEqual([{ limiter: "MOBILITY", sessions: 1 }]);
  });
  it("counts sessions per limiter in the period, most frequent first", () => {
    const res = limiterCounts([
      { date: "2026-11-01", limiters: ["ENDURANCE", "PAIN"] },
      { date: "2026-11-05", limiters: ["ENDURANCE"] },
      { date: "2026-11-06", limiters: [] },
      { date: "2026-09-01", limiters: ["TECHNIQUE"] },
    ], "2026-10-15");
    expect(res).toEqual({ rows: [{ limiter: "ENDURANCE", sessions: 2 }, { limiter: "PAIN", sessions: 1 }], sessions: 2 });
  });
});

describe("latestHipLevels", () => {
  it("reads the latest assessment, weaker side per core test", async () => {
    const { latestHipLevels } = await import("@/lib/analytics/notebook");
    expect(latestHipLevels([
      { date: "2026-11-01", results: [{ test: "A", level: 0 }] },
      { date: "2026-11-12", results: [{ test: "A", level: 2 }, { test: "A", level: 1 }, { test: "B", level: 3 }, { test: "C", level: null }] },
    ])).toEqual({ date: "2026-11-12", levels: { A: 1, B: 3, C: null } });
    expect(latestHipLevels([])).toBeNull();
  });
});
