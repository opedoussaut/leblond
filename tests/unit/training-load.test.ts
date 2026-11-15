import { describe, expect, it } from "vitest";
import {
  LOAD_THRESHOLDS, boardScaledAttempts, boulderPerf, boulderScaledAttempts, climbIntensity, climbMinutes, estimateShares,
  hangPerf, loadBySource, loadModel, loadZone, monotony, nearLimitCounts, performanceTrends, progressVerdict, projectLoad,
  recentPainCount, routePerf, routeScaledAttempts, sessionLoads, weeklyGuide,
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
      { date: "2026-11-11", source: "MOBILITY", minutes: 20, intensity: 2, load: 40, estimated: { minutes: true, intensity: true } },
    ]);
  });
  it("does not count a guided board session twice and uses its RPE for the climbing session", () => {
    const loads = sessionLoads([climb({ id: "b", discipline: "BOARD", durationMinutes: 50 })], [training({ climbingSessionId: "b", rpe: 8 })], []);
    expect(loads).toHaveLength(1);
    expect(loads[0]).toMatchObject({ source: "BOARD", intensity: 8, load: 400, estimated: { intensity: false } });
  });
  it("skips unfinished training and falls back to planned minutes", () => {
    const loads = sessionLoads([], [training({ completed: false }), training({ id: "t2", actualMinutes: null, rpe: null, mobility: true })], []);
    expect(loads).toEqual([{ date: "2026-11-10", source: "MOBILITY", minutes: 45, intensity: 2, load: 90, estimated: { minutes: true, intensity: true } }]);
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
    expect(model[0]).toMatchObject({ load: 420, fitness: 10, fatigue: 60, form: -50, ratio: null });
    expect(model[1].fatigue).toBeCloseTo(51.4, 1);
  });
  it("shows the ratio only after four weeks", () => {
    const model = loadModel(loadsEvery("2026-09-01", 60, 2, 400), "2026-10-30");
    expect(model[26].ratio).toBeNull();
    expect(model[27].ratio).not.toBeNull();
  });
  it("settles near 1 when the same rhythm is kept", () => {
    const model = loadModel(loadsEvery("2026-01-01", 300, 2, 400), addDays("2026-01-01", 299));
    expect(model.at(-1)!.ratio!).toBeGreaterThan(0.8);
    expect(model.at(-1)!.ratio!).toBeLessThan(1.3);
    expect(loadZone(model.at(-1)!.ratio)).toBe("optimal");
  });
  it("is empty without loads", () => {
    expect(loadModel([], "2026-11-01")).toEqual([]);
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
  it("projects 14 days at the last 28 days' average", () => {
    const p = projectLoad(model);
    expect(p.points).toHaveLength(14);
    expect(p.points[0].date).toBe(addDays(today, 1));
    expect(p.daily).toBeGreaterThan(90);
    expect(p.daily).toBeLessThan(110);
  });
  it("gives the week's range in load and in typical sessions", () => {
    const g = weeklyGuide(model, loads, today)!;
    expect(g.typicalLoad).toBe(300);
    expect(g.minLoad).toBeLessThan(g.maxLoad);
    expect(g.maxLoad).toBeLessThan(g.dangerLoad);
    expect(g.minSessions).toBeGreaterThan(1);
    expect(g.maxSessions).toBeLessThan(4);
  });
  it("lands the week on the band's limits when simulated", async () => {
    const { ratioAfter } = await import("@/lib/analytics/training-load");
    const g = weeklyGuide(model, loads, today)!;
    const last = model.at(-1)!;
    expect(ratioAfter(last.fitness, last.fatigue, g.minLoad)).toBeCloseTo(0.8, 2);
    expect(ratioAfter(last.fitness, last.fatigue, g.maxLoad)).toBeCloseTo(1.3, 2);
  });
  it("asks for rest after a big spike", () => {
    const spiked = loadModel([...loadsEvery("2026-01-01", 60, 4, 200), ...loadsEvery("2026-03-02", 7, 1, 900)], "2026-03-08");
    const g = weeklyGuide(spiked, [], "2026-03-08")!;
    expect(g.minLoad).toBe(0);
    expect(g.maxLoad).toBeLessThan(g.dangerLoad);
  });
  it("has no guide while calibrating", () => {
    expect(weeklyGuide(loadModel(loadsEvery("2026-01-01", 5, 1, 300), "2026-01-05"), [], "2026-01-05")).toBeNull();
  });
});

describe("monotony", () => {
  const day = (load: number, i: number): LoadDay => ({ date: addDays("2026-11-01", i), load, fitness: 0, fatigue: 0, form: 0, ratio: null });
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
    const [t] = performanceTrends([series([["2026-09-10", 5], ["2026-09-20", 6], ["2026-10-20", 6], ["2026-11-01", 7], ["2026-11-10", 8]])], today);
    expect(t.previous).toBe(5.5);
    expect(t.recent).toBe(7);
    expect(t.direction).toBe("up");
    expect(t.recentBest).toMatchObject({ score: 8 });
  });
  it("calls small moves flat and needs both windows", () => {
    expect(performanceTrends([series([["2026-09-20", 6], ["2026-11-10", 6]])], today)[0].direction).toBe("flat");
    expect(performanceTrends([series([["2026-09-20", 7], ["2026-11-10", 6]])], today)[0].direction).toBe("down");
    expect(performanceTrends([series([["2026-11-10", 6]])], today)[0].direction).toBe("insufficient");
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
  const steady = loadModel(loadsEvery("2026-01-01", 200, 2, 400), addDays("2026-01-01", 199));
  const extra = { monotony: null, recentPain: 0 };
  it("lets performance decide when it can", () => {
    expect(progressVerdict([trend("up"), trend("flat")], steady, extra).verdict).toBe("progressing");
    expect(progressVerdict([trend("down"), trend("up"), trend("down")], steady, extra).verdict).toBe("declining");
    expect(progressVerdict([trend("flat")], steady, extra)).toMatchObject({ verdict: "stagnating", basis: "performance" });
  });
  it("turns a flat performance with a big loss of fitness into decline", () => {
    const stopped = loadModel(loadsEvery("2026-01-01", 120, 2, 400), addDays("2026-01-01", 170));
    const v = progressVerdict([trend("flat")], stopped, extra);
    expect(v.fitnessChange!).toBeLessThan(-0.2);
    expect(v.verdict).toBe("declining");
    expect(v.flags).toContain("under");
  });
  it("falls back on load alone, then on nothing", () => {
    const building = loadModel([...loadsEvery("2026-01-01", 60, 3, 200), ...loadsEvery("2026-03-02", 40, 1, 400)], "2026-04-10");
    expect(progressVerdict([trend("insufficient")], building, extra)).toMatchObject({ verdict: "progressing", basis: "load" });
    expect(progressVerdict([], [], extra)).toMatchObject({ verdict: "insufficient", basis: "none" });
  });
  it("raises flags for spikes, monotony and pain", () => {
    const spike = loadModel([...loadsEvery("2026-01-01", 60, 4, 200), ...loadsEvery("2026-03-02", 6, 1, 600)], "2026-03-07");
    const v = progressVerdict([], spike, { monotony: 2.5, recentPain: 1 });
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
  it("draws the band only once calibrated and marks the projection", async () => {
    const { loadChartPoints } = await import("@/lib/analytics/training-load");
    const model = loadModel(loadsEvery("2026-01-01", 60, 2, 400), "2026-03-01");
    const pts = loadChartPoints(model, projectLoad(model, 3).points, "2026-01-20");
    expect(pts[0].date).toBe("2026-01-20");
    expect(pts[0].bandLow).toBeNull();
    const last = pts.at(-4)!;
    expect(last.projected).toBe(false);
    expect(last.bandHigh).toBeCloseTo(last.fitness * 1.3, 0);
    expect(pts.at(-1)!.projected).toBe(true);
    expect(pts.at(-1)!.danger).not.toBeNull();
  });
});
