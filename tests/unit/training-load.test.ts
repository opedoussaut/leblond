import { describe, expect, it } from "vitest";
import {
  LOAD_THRESHOLDS, boardScaledAttempts, boulderPerf, boulderScaledAttempts, climbIntensity, climbMinutes, estimateShares,
  hangPerf, loadBySource, loadChange28, loadModel, loadZone, monotony, nearLimitCounts, performanceTrends, progressVerdict, projectLoad,
  ratioAfterWeek, ratioSeries, recentPainCount, routePerf, routeScaledAttempts, sessionLoads, weeklyGuide, weeklyRatioRows, zoneRatio,
  type ClimbSessionFact, type LoadDay, type PerfSeries, type SessionLoad, type TrainingLoadFact,
} from "@/lib/analytics/training-load";
import type { AttemptFact, ProblemFact } from "@/lib/analytics/types";
import type { RouteAscentFact } from "@/lib/analytics/routes";
import type { BoardAscentFact } from "@/lib/analytics/boards";

const climb = (over: Partial<ClimbSessionFact> = {}): ClimbSessionFact => ({
  id: "c1", discipline: "BOULDER", date: "2026-11-10", startedAt: new Date("2026-11-10T18:00:00Z"), endedAt: null,
  durationMinutes: null, fatigue: null, fatigueBefore: null, attempts: 0, nearLimit: 0, ...over,
});
const training = (over: Partial<TrainingLoadFact> = {}): TrainingLoadFact => ({
  id: "t1", date: "2026-11-10", completed: true, actualMinutes: 40, plannedMinutes: 45, rpe: 7, pain: null, mobility: false,
  climbingSessionId: null, ...over,
});
const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
const loadsEvery = (from: string, days: number, every: number, load: number): SessionLoad[] =>
  Array.from({ length: days }, (_, i) => i).filter((i) => i % every === 0).map((i) => ({
    date: addDays(from, i), source: "BOULDER", minutes: 60, intensity: load / 60, load, estimated: { minutes: false, intensity: true },
  }));

describe("climbMinutes", () => {
  it("prefers the recorded duration, then the start–end span, then attempts, then a default", () => {
    expect(climbMinutes(climb({ durationMinutes: 75 }))).toEqual({ minutes: 75, estimated: false });
    expect(climbMinutes(climb({ endedAt: new Date("2026-11-10T19:30:00Z") }))).toEqual({ minutes: 90, estimated: false });
    expect(climbMinutes(climb({ attempts: 20 }))).toEqual({ minutes: 80, estimated: true });
    expect(climbMinutes(climb({ attempts: 2 }))).toEqual({ minutes: 20, estimated: true });
    expect(climbMinutes(climb({ discipline: "BOARD" }))).toEqual({ minutes: 60, estimated: true });
  });
  it("ignores an implausible span (a session left open overnight)", () => {
    expect(climbMinutes(climb({ endedAt: new Date("2026-11-11T12:00:00Z"), attempts: 10 })).estimated).toBe(true);
  });
});

describe("climbIntensity", () => {
  it("starts from the discipline and rises with attempts near the limit and with fatigue", () => {
    expect(climbIntensity({ discipline: "BOULDER", attempts: 0, nearLimit: 0, fatigue: null, fatigueBefore: null })).toBe(6);
    expect(climbIntensity({ discipline: "BOULDER", attempts: 10, nearLimit: 5, fatigue: null, fatigueBefore: null })).toBe(7);
    expect(climbIntensity({ discipline: "BOULDER", attempts: 10, nearLimit: 10, fatigue: 5, fatigueBefore: null })).toBe(9);
    expect(climbIntensity({ discipline: "ROUTE", attempts: 4, nearLimit: 0, fatigue: 1, fatigueBefore: null })).toBe(4);
  });
  it("adds up to ±0.5 from the fatigue noted before the session", () => {
    expect(climbIntensity({ discipline: "BOULDER", attempts: 0, nearLimit: 0, fatigue: null, fatigueBefore: 5 })).toBe(6.5);
    expect(climbIntensity({ discipline: "BOULDER", attempts: 0, nearLimit: 0, fatigue: null, fatigueBefore: 1 })).toBe(5.5);
    expect(climbIntensity({ discipline: "BOULDER", attempts: 0, nearLimit: 0, fatigue: 4, fatigueBefore: 4 })).toBe(6.8);
    expect(climbIntensity({ discipline: "ROUTE", attempts: 0, nearLimit: 0, fatigue: 3, fatigueBefore: 3 })).toBe(5);
  });
  it("stays inside 3–9", () => {
    expect(climbIntensity({ discipline: "BOARD", attempts: 5, nearLimit: 5, fatigue: 5, fatigueBefore: null })).toBe(9);
  });
});

describe("sessionLoads", () => {
  it("multiplies intensity by minutes and flags estimates", () => {
    const loads = sessionLoads([climb({ durationMinutes: 60 })], [training()], [{ date: "2026-11-11", minutes: null }]);
    expect(loads).toEqual([
      { date: "2026-11-10", source: "BOULDER", minutes: 60, intensity: 6, load: 360, estimated: { minutes: false, intensity: true } },
      { date: "2026-11-10", source: "TRAINING", minutes: 40, intensity: 7, load: 280, estimated: { minutes: false, intensity: false } },
      // Mobility counts at half its load.
      { date: "2026-11-11", source: "MOBILITY", minutes: 20, intensity: 2, load: 20, estimated: { minutes: true, intensity: true } },
    ]);
  });
  it("does not count a guided board session twice and uses its RPE for the climbing session", () => {
    const loads = sessionLoads([climb({ id: "b", discipline: "BOARD", durationMinutes: 50 })], [training({ climbingSessionId: "b", rpe: 8 })], []);
    expect(loads).toHaveLength(1);
    expect(loads[0]).toMatchObject({ source: "BOARD", intensity: 8, load: 400, estimated: { intensity: false } });
  });
  it("skips unfinished training and falls back to planned minutes", () => {
    const loads = sessionLoads([], [training({ completed: false }), training({ id: "t2", actualMinutes: null, rpe: null, mobility: true })], []);
    expect(loads).toEqual([{ date: "2026-11-10", source: "MOBILITY", minutes: 45, intensity: 2, load: 45, estimated: { minutes: true, intensity: true } }]);
  });
  it("reports estimate shares per source", () => {
    const loads = sessionLoads([climb({ durationMinutes: 60 }), climb({ id: "c2", attempts: 10 })], [], []);
    expect(estimateShares(loads)).toEqual([{ source: "BOULDER", sessions: 2, minutes: 0.5, intensity: 1 }]);
  });
});

describe("nearLimitCounts", () => {
  it("compares each attempt with the best send on the same scale only", () => {
    const at = (d: string) => new Date(d + "T18:00:00Z");
    const counts = nearLimitCounts([
      { sessionId: "s1", scale: "B:FONT", score: 10, at: at("2026-10-01"), sent: true, tries: 1, tolerance: 1 },
      { sessionId: "s2", scale: "B:FONT", score: 9, at: at("2026-10-10"), sent: false, tries: 1, tolerance: 1 },
      { sessionId: "s2", scale: "B:FONT", score: 6, at: at("2026-10-10"), sent: true, tries: 1, tolerance: 1 },
      { sessionId: "s2", scale: "R", score: 3, at: at("2026-10-10"), sent: false, tries: 2, tolerance: 2 },
    ]);
    expect(counts.get("s1")).toEqual({ attempts: 1, nearLimit: 1 });
    // Font 9 is within one grade of the Font 10 best; the route has no best of its own yet.
    expect(counts.get("s2")).toEqual({ attempts: 4, nearLimit: 1 });
  });
  it("forgets bests older than the window", () => {
    const counts = nearLimitCounts([
      { sessionId: "old", scale: "R", score: 12, at: new Date("2026-01-01T10:00:00Z"), sent: true, tries: 1, tolerance: 2 },
      { sessionId: "new", scale: "R", score: 8, at: new Date("2026-06-01T10:00:00Z"), sent: true, tries: 1, tolerance: 2 },
    ]);
    expect(counts.get("new")).toEqual({ attempts: 1, nearLimit: 1 });
  });
  it("builds scaled attempts from boulders, routes and board climbs", () => {
    const problems = [{ id: "p", nativeGrade: "6A", nativeGradeSystem: "FONT" } as unknown as ProblemFact,
      { id: "pink", nativeGrade: "PINK", nativeGradeSystem: "UNKNOWN" } as unknown as ProblemFact];
    const attempts = [{ id: "a", problemId: "p", sessionId: "s", result: "TOP", attemptNumber: 1, createdAt: new Date() },
      { id: "b", problemId: "pink", sessionId: "s", result: "TOP", attemptNumber: 1, createdAt: new Date() }] as AttemptFact[];
    expect(boulderScaledAttempts(problems, attempts)).toHaveLength(1);
    expect(routeScaledAttempts([{ id: "r", sessionId: "s", grade: "6a", style: "LEAD", result: "ATTEMPT", falls: 1, createdAt: new Date() }])[0])
      .toMatchObject({ scale: "R", sent: false, tolerance: 2 });
    expect(boardScaledAttempts([{ id: "k", sessionId: "s", board: "KILTER", climbKey: "x", climbName: "x", angle: 40, grade: "V4", gradeScale: "V",
      tries: 3, result: "SENT", isBenchmark: false, climbedAt: new Date() } as BoardAscentFact])[0]).toMatchObject({ scale: "K:KILTER:V", tries: 3, sent: true });
  });
});

describe("loadModel", () => {
  it("builds 42- and 7-day exponential averages day by day, empty days included", () => {
    const model = loadModel(loadsEvery("2026-11-01", 1, 1, 420), "2026-11-03");
    expect(model.map((d) => d.date)).toEqual(["2026-11-01", "2026-11-02", "2026-11-03"]);
    expect(model[0]).toEqual({ date: "2026-11-01", load: 420, fitness: 10, fatigue: 60, form: -50 });
    expect(model[1].fatigue).toBeCloseTo(51.4, 1);
  });
  it("is empty without loads", () => {
    expect(loadModel([], "2026-11-01")).toEqual([]);
  });
});

describe("ratioSeries", () => {
  it("divides the last 7 days by the weekly average of the last 28, from day 28", () => {
    const ratios = ratioSeries(loadsEvery("2026-09-01", 60, 2, 400), "2026-10-30");
    expect(ratios[26].fingers).toBeNull();
    expect(ratios[26].calibrated).toBe(false);
    expect(ratios[27].calibrated).toBe(true);
    // Day index 27: sessions on even days, 14 in the 28 days, 3 in the last 7 (22, 24, 26).
    expect(ratios[27].fingers).toBeCloseTo((3 * 400) / ((14 * 400) / 4), 2);
  });
  it("does not start from zero: a steady rhythm is in the band from the first day it shows", () => {
    // An exponential average starting from zero gave about 2.0 here.
    const ratios = ratioSeries(loadsEvery("2026-01-01", 40, 1, 300), addDays("2026-01-01", 39));
    for (const d of ratios.slice(27)) expect(d.global).toBe(1);
    expect(zoneRatio(ratios.at(-1))).toEqual({ ratio: 1, basis: "fingers" });
  });
  it("keeps fingers and upper body apart from mobility", () => {
    const mobility: SessionLoad[] = Array.from({ length: 35 }, (_, i) => ({
      date: addDays("2026-01-01", i), source: "MOBILITY", minutes: 40, intensity: 3, load: 60, estimated: { minutes: false, intensity: false },
    }));
    const climbing = loadsEvery("2026-01-01", 28, 2, 400);
    const ratios = ratioSeries([...climbing, ...mobility], addDays("2026-01-01", 34));
    const last = ratios.at(-1)!;
    // No climbing in the last 7 days: the fingers ratio drops to 0, the global one keeps the mobility.
    expect(last.fingers).toBe(0);
    expect(last.global).toBeGreaterThan(0);
    expect(last.fingersLoad).toBe(0);
    expect(last.globalLoad).toBe(60);
  });
  it("reads everything when there is no climbing or training, and 0 after four empty weeks", () => {
    const mobilityOnly: SessionLoad[] = loadsEvery("2026-01-01", 40, 2, 100).map((l) => ({ ...l, source: "MOBILITY" }));
    expect(zoneRatio(ratioSeries(mobilityOnly, addDays("2026-01-01", 39)).at(-1)).basis).toBe("global");
    const stopped = ratioSeries(loadsEvery("2026-01-01", 30, 2, 400), addDays("2026-01-01", 80));
    expect(zoneRatio(stopped.at(-1))).toEqual({ ratio: 0, basis: "fingers" });
    expect(loadZone(zoneRatio(stopped.at(-1)).ratio)).toBe("under");
    expect(zoneRatio(ratioSeries(loadsEvery("2026-01-01", 5, 1, 300), "2026-01-05").at(-1)).ratio).toBeNull();
  });
  it("sums each week with its last ratio for the table", () => {
    const rows = weeklyRatioRows(ratioSeries(loadsEvery("2026-11-02", 14, 1, 100), "2026-11-15"));
    expect(rows).toEqual([
      { weekStart: "2026-11-02", fingers: null, global: null, fingersLoad: 700, globalLoad: 700 },
      { weekStart: "2026-11-09", fingers: null, global: null, fingersLoad: 700, globalLoad: 700 },
    ]);
  });
});

describe("loadZone", () => {
  it("places ratios on the band", () => {
    expect(loadZone(null)).toBe("calibrating");
    expect(loadZone(0.7)).toBe("under");
    expect(loadZone(LOAD_THRESHOLDS.low)).toBe("optimal");
    expect(loadZone(1.3)).toBe("optimal");
    expect(loadZone(1.4)).toBe("high");
    expect(loadZone(1.6)).toBe("danger");
  });
});

describe("projection and weekly guide", () => {
  const today = addDays("2026-01-01", 119);
  const loads = loadsEvery("2026-01-01", 120, 3, 300);
  const model = loadModel(loads, today);
  const ratios = ratioSeries(loads, today);
  it("projects 14 days at the last 28 days' average", () => {
    const p = projectLoad(model);
    expect(p.points).toHaveLength(14);
    expect(p.points[0].date).toBe(addDays(today, 1));
    expect(p.daily).toBeGreaterThan(90);
    expect(p.daily).toBeLessThan(110);
  });
  it("gives the week's range in load and in typical sessions", () => {
    const g = weeklyGuide(ratios, loads, today)!;
    expect(g.basis).toBe("fingers");
    expect(g.typicalLoad).toBe(300);
    expect(g.minLoad).toBeLessThan(g.maxLoad);
    expect(g.maxLoad).toBeLessThan(g.dangerLoad);
    expect(g.minSessions).toBeGreaterThan(1);
    expect(g.maxSessions).toBeLessThan(4);
  });
  it("lands the week exactly on the band's limits", () => {
    const g = weeklyGuide(ratios, loads, today)!;
    const last21 = ratios.slice(-21).reduce((s, d) => s + d.fingersLoad, 0);
    expect(ratioAfterWeek(last21, g.minLoad)).toBeCloseTo(0.8, 2);
    expect(ratioAfterWeek(last21, g.maxLoad)).toBeCloseTo(1.3, 2);
    expect(ratioAfterWeek(last21, g.dangerLoad)).toBeCloseTo(1.5, 2);
  });
  it("leaves mobility out of the typical session", () => {
    const withMobility: SessionLoad[] = [...loads, { date: today, source: "MOBILITY", minutes: 30, intensity: 2, load: 30, estimated: { minutes: false, intensity: false } }];
    expect(weeklyGuide(ratioSeries(withMobility, today), withMobility, today)!.typicalLoad).toBe(300);
  });
  it("has no guide while the ratio is not shown", () => {
    const short = loadsEvery("2026-01-01", 5, 1, 300);
    expect(weeklyGuide(ratioSeries(short, "2026-01-05"), short, "2026-01-05")).toBeNull();
  });
});

describe("monotony", () => {
  const day = (load: number, i: number): LoadDay => ({ date: addDays("2026-11-01", i), load, fitness: 0, fatigue: 0, form: 0 });
  it("is mean ÷ standard deviation of the last week", () => {
    expect(monotony([300, 0, 300, 0, 300, 0, 300].map(day))).toBeCloseTo(1.15, 2);
    expect(monotony([300, 300, 300, 300, 300, 300, 200].map(day))).toBeGreaterThan(2);
    expect(monotony([0, 0, 0, 0, 0, 0, 0].map(day))).toBeNull();
    expect(monotony([1, 2].map(day))).toBeNull();
  });
});

describe("performance", () => {
  const series = (points: Array<[string, number]>, threshold = 0.5): PerfSeries =>
    ({ key: "s", kind: "boulder", threshold, points: points.map(([date, score]) => ({ date, score, display: String(score) })) });
  const today = "2026-11-15";
  it("compares the top-3 average of the last 6 weeks with the 6 weeks before", () => {
    const [t] = performanceTrends([series([["2026-09-10", 5], ["2026-09-20", 6], ["2026-10-20", 6], ["2026-11-01", 7], ["2026-11-10", 8]])], today, 42, 1);
    expect(t.previous).toBe(5.5);
    expect(t.recent).toBe(7);
    expect(t.direction).toBe("up");
    expect(t.recentBest).toMatchObject({ score: 8 });
  });
  it("calls small moves flat and needs both windows", () => {
    expect(performanceTrends([series([["2026-09-20", 6], ["2026-11-10", 6]])], today, 42, 1)[0].direction).toBe("flat");
    expect(performanceTrends([series([["2026-09-20", 7], ["2026-11-10", 6]])], today, 42, 1)[0].direction).toBe("down");
    expect(performanceTrends([series([["2026-11-10", 6]])], today, 42, 1)[0].direction).toBe("insufficient");
  });
  it("needs five results in each window by default", () => {
    const four: Array<[string, number]> = [["2026-09-20", 5], ["2026-09-21", 5], ["2026-09-22", 5], ["2026-09-23", 5]];
    const recent: Array<[string, number]> = [["2026-11-01", 8], ["2026-11-02", 8], ["2026-11-03", 8], ["2026-11-04", 8], ["2026-11-05", 8]];
    expect(performanceTrends([series([...four, ...recent])], today)[0].direction).toBe("insufficient");
    expect(performanceTrends([series([...four, ["2026-09-24", 5], ...recent])], today)[0].direction).toBe("up");
  });
  it("builds series per native scale, never merging them", () => {
    const problems = [
      { id: "f", nativeGrade: "6A", nativeGradeSystem: "FONT" }, { id: "g", nativeGrade: "6B", nativeGradeSystem: "FONT" },
      { id: "v", nativeGrade: "X", nativeGradeSystem: "UNKNOWN" },
    ] as unknown as ProblemFact[];
    const a = (problemId: string, result: AttemptFact["result"], at: string) => ({ id: problemId + at, problemId, sessionId: "s", result, attemptNumber: 1, createdAt: new Date(at) });
    const out = boulderPerf(problems, [a("f", "TOP", "2026-11-01T10:00:00Z"), a("f", "TOP", "2026-11-05T10:00:00Z"), a("g", "ATTEMPT", "2026-11-02T10:00:00Z")]);
    expect(out).toHaveLength(1);
    expect(out[0].points).toHaveLength(1);
    const routes: RouteAscentFact[] = [
      { id: "1", sessionId: "s", grade: "6a", style: "LEAD", result: "REDPOINT", falls: 0, createdAt: new Date("2026-11-01") },
      { id: "2", sessionId: "s", grade: "6b", style: "LEAD", result: "ATTEMPT", falls: 2, createdAt: new Date("2026-11-01") },
    ];
    expect(routePerf(routes)[0].points.map((p) => p.display)).toEqual(["6a"]);
    expect(hangPerf([{ loadKg: 5, edgeMm: 20, seconds: 7, date: "2026-11-01" }, { loadKg: 9, edgeMm: 15, seconds: 7, date: "2026-11-01" }], 20)[0].points).toHaveLength(1);
  });
});

describe("progressVerdict", () => {
  const trend = (direction: "up" | "down" | "flat" | "insufficient") => ({ direction } as unknown as Parameters<typeof progressVerdict>[0][number]);
  const steady = ratioSeries(loadsEvery("2026-01-01", 200, 2, 400), addDays("2026-01-01", 199));
  const extra = { monotony: null, recentPain: 0 };
  it("lets performance decide", () => {
    expect(progressVerdict([trend("up"), trend("flat")], steady, extra).verdict).toBe("progressing");
    expect(progressVerdict([trend("down"), trend("up"), trend("down")], steady, extra).verdict).toBe("declining");
    expect(progressVerdict([trend("flat")], steady, extra)).toMatchObject({ verdict: "stagnating", basis: "performance", zone: "optimal" });
  });
  it("turns a flat performance with a big loss of load into decline", () => {
    const stopped = ratioSeries(loadsEvery("2026-01-01", 120, 2, 400), addDays("2026-01-01", 140));
    const v = progressVerdict([trend("flat")], stopped, extra);
    expect(v.loadChange!).toBeLessThan(-0.2);
    expect(v.verdict).toBe("declining");
    expect(v.flags).toContain("under");
  });
  it("gives no verdict without comparable results, even when the load grows", () => {
    const building = ratioSeries([...loadsEvery("2026-01-01", 60, 3, 200), ...loadsEvery("2026-03-02", 40, 1, 400)], "2026-04-10");
    expect(loadChange28(building)!).toBeGreaterThan(0.1);
    expect(progressVerdict([trend("insufficient")], building, extra)).toMatchObject({ verdict: "insufficient", basis: "none" });
    expect(progressVerdict([], [], extra)).toMatchObject({ verdict: "insufficient", basis: "none", zone: "calibrating", loadChange: null });
  });
  it("raises flags for spikes, monotony and pain", () => {
    const spike = ratioSeries([...loadsEvery("2026-01-01", 60, 4, 200), ...loadsEvery("2026-03-02", 6, 1, 600)], "2026-03-07");
    const v = progressVerdict([], spike, { monotony: 2.5, recentPain: 1 });
    expect(v.ratio!).toBeGreaterThan(1.5);
    expect(v.flags).toEqual(expect.arrayContaining(["spike", "monotony", "pain"]));
  });
});

describe("helpers", () => {
  it("counts painful sessions in the last week", () => {
    expect(recentPainCount([training({ pain: 4, date: "2026-11-14" }), training({ pain: 2, date: "2026-11-14" }), training({ pain: 5, date: "2026-11-01" })], "2026-11-15")).toBe(1);
  });
  it("sums load per source over 28 days", () => {
    const loads = sessionLoads([climb({ durationMinutes: 60, date: "2026-11-14" })], [training({ date: "2026-10-01" })], []);
    expect(loadBySource(loads, "2026-11-15")).toEqual([{ source: "BOULDER", load: 360, sessions: 1 }]);
  });
});

describe("trainingLoadReport", () => {
  it("joins attempts to sessions and returns the whole picture", async () => {
    const { trainingLoadReport, weeklyLoadRows } = await import("@/lib/analytics/training-load");
    const report = trainingLoadReport({
      today: "2026-11-15",
      climbs: [{ id: "c", discipline: "BOULDER", date: "2026-11-14", startedAt: new Date("2026-11-14T18:00:00Z"), endedAt: null, durationMinutes: null, fatigue: 4, fatigueBefore: null }],
      scaledAttempts: [{ sessionId: "c", scale: "B:FONT", score: 10, at: new Date("2026-11-14T18:10:00Z"), sent: true, tries: 1, tolerance: 1 }],
      training: [training({ date: "2026-11-13" })],
      mobility: [],
      perf: [],
    });
    expect(report.loads.map((l) => l.source)).toEqual(["TRAINING", "BOULDER"]);
    // One attempt, at the limit: 6 + 2 + 0.5 = 8.5, 20 minutes estimated from attempts.
    expect(report.loads[1]).toMatchObject({ intensity: 8.5, minutes: 20, load: 170 });
    expect(report.calibrationLeft).toBe(25);
    expect(report.guide).toBeNull();
    expect(report.estimated).toEqual({ minutes: 0.5, intensity: 0.5 });
    expect(report.verdict.verdict).toBe("insufficient");
    expect(weeklyLoadRows(report.model)).toEqual([
      { weekStart: "2026-11-09", load: 450, fitness: expect.any(Number), fatigue: expect.any(Number), form: expect.any(Number) },
    ]);
  });
});

describe("loadChartPoints", () => {
  it("starts at the period and marks the projection", async () => {
    const { loadChartPoints } = await import("@/lib/analytics/training-load");
    const model = loadModel(loadsEvery("2026-01-01", 60, 2, 400), "2026-03-01");
    const pts = loadChartPoints(model, projectLoad(model, 3).points, "2026-01-20");
    expect(pts[0].date).toBe("2026-01-20");
    expect(pts.at(-4)!.projected).toBe(false);
    expect(pts.at(-1)!.projected).toBe(true);
  });
});
