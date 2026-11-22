import { describe, expect, it } from "vitest";
import { bestEntries, harmonisedBoulderPerf, harmonisedSummary, HARMONISED_BOULDER_KEY, weakestConfidence } from "@/lib/analytics/harmonised";
import { boulderPerf, performanceTrends, progressVerdict, routePerf } from "@/lib/analytics/training-load";
import type { AttemptFact, ProblemFact } from "@/lib/analytics/types";
import type { RouteAscentFact } from "@/lib/analytics/routes";
import type { GradeSystem } from "@/lib/climbing/types";
import {
  DEFAULT_BOULDER_TABLE, SOURCE_CONFIDENCE, confidenceBand, conversionTable, convertBoulder, convertibleSystems, fontIndex, formatSpan,
  scoreLabel, toOverrides,
} from "@/lib/grading/harmonise";
import { GRADES_BY_SYSTEM } from "@/lib/grading/systems";

// Synthetic climber: no real history.
const problem = (id: string, system: GradeSystem, grade: string, over: Partial<ProblemFact> = {}): ProblemFact => ({
  id, gymId: "g-" + system, nativeGrade: grade, nativeGradeSystem: system, wallAngle: "VERTICAL", tags: [], ...over,
});
const send = (problemId: string, day: string, result: AttemptFact["result"] = "TOP", n = 1): AttemptFact => ({
  id: `${problemId}-${n}`, problemId, sessionId: "s-" + day, result, attemptNumber: n, createdAt: new Date(day + "T18:00:00Z"),
});
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);

describe("default conversion table", () => {
  it("covers every ordered grade of each convertible scale, with an ordered Font span", () => {
    for (const system of convertibleSystems()) {
      const lines = DEFAULT_BOULDER_TABLE[system]!;
      for (const g of GRADES_BY_SYSTEM[system].filter((x) => x.kind === "ORDERED")) {
        const line = lines[g.id];
        expect(line, `${system} ${g.id}`).toBeDefined();
        expect(fontIndex(line.from)).toBeLessThanOrEqual(fontIndex(line.to));
      }
    }
  });
  it("never goes down the scale: each grade's middle is at or above the previous grade's", () => {
    for (const system of convertibleSystems()) {
      const lines = DEFAULT_BOULDER_TABLE[system]!;
      const mids = GRADES_BY_SYSTEM[system].filter((g) => g.kind === "ORDERED")
        .map((g) => (fontIndex(lines[g.id].from) + fontIndex(lines[g.id].to)) / 2);
      for (let i = 1; i < mids.length; i++) expect(mids[i], `${system} #${i}`).toBeGreaterThanOrEqual(mids[i - 1]);
    }
  });
  it("has no line for Font, custom colours, unknown, or the mystery pink", () => {
    expect(DEFAULT_BOULDER_TABLE.FONT).toBeUndefined();
    expect(DEFAULT_BOULDER_TABLE.CUSTOM_COLOR).toBeUndefined();
    expect(DEFAULT_BOULDER_TABLE.UNKNOWN).toBeUndefined();
    expect(DEFAULT_BOULDER_TABLE.CLIMBING_DISTRICT_COLOR!.PINK).toBeUndefined();
  });
  it("cites the gym when it publishes the table, and calls the rest estimates", () => {
    expect(DEFAULT_BOULDER_TABLE.VERTICAL_ART_COLOR!.BLUE).toEqual({ from: "6A", to: "6B", source: "GYM_PUBLISHED" });
    expect(DEFAULT_BOULDER_TABLE.BLOCKOUT_LEVEL!.B8.source).toBe("REFERENCE_TABLE");
    expect(DEFAULT_BOULDER_TABLE.CLIMB_WORLD_LEVEL!["4"].source).toBe("LEBLOND_ESTIMATE");
    expect(SOURCE_CONFIDENCE.LEBLOND_ESTIMATE).toBeLessThan(0.5);
  });
});

describe("convertBoulder", () => {
  const table = conversionTable();
  it("keeps a Font grade as it is, with full confidence", () => {
    expect(convertBoulder(problem("p", "FONT", "6B+"), table)).toMatchObject({ from: "6B+", to: "6B+", confidence: 1, source: "FONT_NATIVE" });
  });
  it("reads a gym grade through the table, scored at the middle of its span", () => {
    const c = convertBoulder(problem("p", "BLOCKOUT_LEVEL", "B5"), table)!;
    expect(c).toMatchObject({ from: "6A", to: "6A+", source: "REFERENCE_TABLE", confidence: SOURCE_CONFIDENCE.REFERENCE_TABLE });
    expect(c.score).toBe(fontIndex("6A") + 0.5);
  });
  it("uses the climber's own line over the default", () => {
    const mine = conversionTable([{ system: "CLIMB_WORLD_LEVEL", grade: "4", from: "6A+", to: "6A+" }]);
    expect(convertBoulder(problem("p", "CLIMB_WORLD_LEVEL", "4"), mine)).toMatchObject({ from: "6A+", to: "6A+", source: "USER_SETTING", confidence: 0.7 });
    expect(convertBoulder(problem("p", "CLIMB_WORLD_LEVEL", "3"), mine)!.source).toBe("LEBLOND_ESTIMATE");
  });
  it("prefers a confident estimate given on the problem itself, and ignores a rough one", () => {
    const own = { normalizedGrade: "6C", normalizedGradeSystem: "FONT", normalizationConfidence: 0.85 };
    expect(convertBoulder(problem("p", "ARKOSE_COLOR", "RED", own), table)).toMatchObject({ from: "6C", source: "PROBLEM_ESTIMATE", confidence: 0.85 });
    expect(convertBoulder(problem("p", "ARKOSE_COLOR", "RED", { ...own, normalizationConfidence: 0.3 }), table)!.source).toBe("REFERENCE_TABLE");
  });
  it("converts nothing it cannot place: custom colours, the mystery pink, unknown grades", () => {
    expect(convertBoulder(problem("p", "CUSTOM_COLOR", "RED"), table)).toBeNull();
    expect(convertBoulder(problem("p", "CLIMBING_DISTRICT_COLOR", "PINK"), table)).toBeNull();
    expect(convertBoulder(problem("p", "BLOCKOUT_LEVEL", "B99"), table)).toBeNull();
  });
  it("never changes the problem's native grade", () => {
    const p = problem("p", "ARKOSE_COLOR", "BLUE");
    convertBoulder(p, table);
    expect(p).toMatchObject({ nativeGrade: "BLUE", nativeGradeSystem: "ARKOSE_COLOR" });
    expect(p.normalizedGrade).toBeUndefined();
  });
});

describe("toOverrides", () => {
  it("keeps valid rows and drops malformed ones", () => {
    expect(toOverrides([
      { grade_system: "ARKOSE_COLOR", native_grade: "RED", font_from: "6A+", font_to: "6B" },
      { grade_system: "ARKOSE_COLOR", native_grade: "RED", font_from: "6B", font_to: "6A" },
      { grade_system: "ARKOSE_COLOR", native_grade: "PINK", font_from: "6A", font_to: "6A" },
      { grade_system: "FONT", native_grade: "6A", font_from: "6A", font_to: "6A" },
      { grade_system: "BLOCKOUT_LEVEL", native_grade: "B3", font_from: "5B", font_to: "5c" },
    ])).toEqual([{ system: "ARKOSE_COLOR", grade: "RED", from: "6A+", to: "6B" }]);
  });
});

describe("display", () => {
  it("writes boulder grades in capitals and spans with a dash", () => {
    expect(formatSpan({ from: "5c", to: "6A" })).toBe("5C–6A");
    expect(formatSpan({ from: "6B", to: "6B" })).toBe("6B");
    expect(scoreLabel(fontIndex("6A") + 0.5)).toBe("6A–6A+");
    expect(scoreLabel(fontIndex("5b"))).toBe("5B");
  });
  it("bands confidence", () => {
    expect([confidenceBand(1), confidenceBand(0.6), confidenceBand(0.35)]).toEqual(["high", "medium", "low"]);
  });
});

describe("harmonisedBoulderPerf", () => {
  const problems = [
    problem("a1", "ARKOSE_COLOR", "BLUE"), problem("a2", "ARKOSE_COLOR", "RED"),
    problem("w1", "CLIMB_WORLD_LEVEL", "4"), problem("b1", "BLOCKOUT_LEVEL", "B8"),
    problem("f1", "FONT", "6A"), problem("c1", "CUSTOM_COLOR", "GREEN"),
  ];
  const attempts = [
    send("a1", "2026-11-01", "ATTEMPT"), send("a1", "2026-11-02", "TOP", 2), send("a1", "2026-11-03", "TOP", 3),
    send("a2", "2026-11-04", "FLASH"), send("w1", "2026-11-05"), send("b1", "2026-11-06"), send("f1", "2026-11-07"), send("c1", "2026-11-08"),
  ];
  const out = harmonisedBoulderPerf(problems, attempts, conversionTable());
  it("puts the first send of every boulder of every scale in one Font series", () => {
    expect(out.series!.key).toBe(HARMONISED_BOULDER_KEY);
    expect(out.series!.converted).toBe(true);
    expect(out.series!.points.map((p) => p.date)).toEqual(["2026-11-02", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07"]);
  });
  it("keeps the grade as logged and how it was converted on every point", () => {
    expect(out.series!.points[0]).toMatchObject({ display: "5C–6A", native: { system: "ARKOSE_COLOR", grade: "BLUE" }, source: "REFERENCE_TABLE" });
    expect(out.series!.points[4]).toMatchObject({ display: "6A", native: { system: "FONT", grade: "6A" }, source: "FONT_NATIVE", confidence: 1 });
  });
  it("counts sends per native scale and the ones it could not convert", () => {
    expect(out.bySystem).toEqual([
      { system: "ARKOSE_COLOR", sends: 2 }, { system: "BLOCKOUT_LEVEL", sends: 1 }, { system: "CLIMB_WORLD_LEVEL", sends: 1 }, { system: "FONT", sends: 1 },
    ]);
    expect(out.unconverted).toBe(1);
  });
  it("returns no series without a convertible send", () => {
    expect(harmonisedBoulderPerf([problem("c", "CUSTOM_COLOR", "RED")], [send("c", "2026-11-01")], conversionTable()).series).toBeNull();
  });
});

describe("comparing across gyms", () => {
  // Six weeks at two gyms then six weeks at two others: no single scale has 5 sends in both windows.
  const today = "2026-11-22";
  const before = addDays(today, -60), recent = addDays(today, -20);
  const problems: ProblemFact[] = [], attempts: AttemptFact[] = [];
  for (let i = 0; i < 6; i++) {
    problems.push(problem(`old-${i}`, i % 2 ? "ARKOSE_COLOR" : "BLOCKOUT_LEVEL", i % 2 ? "BLUE" : "B4"));
    attempts.push(send(`old-${i}`, addDays(before, i)));
    problems.push(problem(`new-${i}`, i % 2 ? "CLIMB_WORLD_LEVEL" : "BLOCKOUT_LEVEL", i % 2 ? "5" : "B8"));
    attempts.push(send(`new-${i}`, addDays(recent, i)));
  }
  it("gives a direction on Font where each native scale alone has too few sends", () => {
    const native = performanceTrends(boulderPerf(problems, attempts), today);
    expect(native.every((t) => t.direction === "insufficient")).toBe(true);
    const harmonised = performanceTrends([harmonisedBoulderPerf(problems, attempts, conversionTable()).series!], today);
    expect(harmonised[0].direction).toBe("up");
    expect(progressVerdict(harmonised, [], { monotony: null, recentPain: 0 }).verdict).toBe("progressing");
  });
  it("picks the best recent entries, hardest first, and admits the weakest confidence", () => {
    const boulders = harmonisedBoulderPerf(problems, attempts, conversionTable());
    const trend = performanceTrends([boulders.series!], today)[0];
    const entries = bestEntries(trend, today);
    expect(entries).toHaveLength(3);
    expect(entries[0].native).toEqual({ system: "CLIMB_WORLD_LEVEL", grade: "5" });
    expect(weakestConfidence(entries)).toBe(SOURCE_CONFIDENCE.LEBLOND_ESTIMATE);
    const summary = harmonisedSummary([trend], boulders, today);
    expect(summary.boulderEntries).toEqual(entries);
    expect(summary.routeEntries).toEqual([]);
  });
});

describe("routes on the French scale", () => {
  it("keep the gym's colour logged next to the French grade", () => {
    const ascents: RouteAscentFact[] = [
      { id: "r1", sessionId: "s", grade: "6a", style: "LEAD", result: "REDPOINT", falls: 0, createdAt: new Date("2026-11-10T18:00:00Z"),
        nativeGrade: "BLUE", nativeGradeSystem: "ARKOSE_COLOR" },
      { id: "r2", sessionId: "s", grade: "5c+", style: "TOPROPE", result: "ONSIGHT", falls: 0, createdAt: new Date("2026-11-10T18:10:00Z") },
    ];
    const [series] = routePerf(ascents);
    expect(series.points.map((p) => [p.display, p.native])).toEqual([["6a", { system: "ARKOSE_COLOR", grade: "BLUE" }], ["5c+", null]]);
  });
});
