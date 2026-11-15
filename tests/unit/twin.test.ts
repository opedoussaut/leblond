import { describe, expect, it } from "vitest";
import { PROGRESSION_V1, type ClimberWork, type Pact } from "@/lib/analytics/alter-ego";
import {
  TWIN_MODEL_V1, adaptation, bestSendByDay, calibrate, twinTimeline, climberLoads, dailyGain, formIndex, formOf, twinLoads, twinState, workLoad,
} from "@/lib/analytics/twin";

const pact: Pact = {
  id: "11111111-1111-4111-8111-111111111111", displayName: "Alex", planName: "Plan",
  plan: [
    { day: 0, methodId: "limit-bouldering", minutes: 75, notes: "" },
    { day: 2, methodId: "max-hangs", minutes: 45, notes: "" },
    { day: 4, methodId: "four-by-four", minutes: 60, notes: "" },
  ],
  progression: PROGRESSION_V1, startDate: "2026-09-07", horizonWeeks: 16, status: "ACTIVE", pausedSince: null, pausedDays: 0,
  startBoulderGrade: "6A", targetBoulderGrade: "7A", startRouteGrade: "6a", targetRouteGrade: "6c",
};
const boulder = (date: string, minutes = 90): ClimberWork => ({ status: "COMPLETED", kind: "BOULDER", date, actualMinutes: minutes, pain: null, reps: 0 });
const none = { boulder: null, route: null };
const days = (from: string, n: number, step: number) =>
  Array.from({ length: n }, (_, i) => new Date(Date.parse(from + "T00:00:00Z") + i * step * 86_400_000).toISOString().slice(0, 10));

describe("training load", () => {
  it("weighs minutes by how hard the work is", () => {
    expect(workLoad(boulder("2026-09-01", 100))).toBe(80);
    expect(workLoad({ ...boulder("2026-09-01", 60), kind: "TRAINING", targets: [
      { block: "MAIN", methodId: "max-hangs", modality: "HOLD", targetSets: 6, targetReps: null, targetSeconds: 10, restSeconds: 180 },
    ] })).toBe(60);
    expect(workLoad({ ...boulder("2026-09-01", null as unknown as number), actualMinutes: null })).toBe(48);
  });

  it("gives the twin the climber's history before the pact, then the plan every planned day", () => {
    const loads = twinLoads(pact, [boulder("2026-09-01"), boulder("2026-09-08")], "2026-09-13");
    expect(loads.get("2026-09-01")).toBe(72);
    // The climber's own séance after the start does not count for the twin; the plan does.
    expect([...loads.keys()].sort()).toEqual(["2026-09-01", "2026-09-07", "2026-09-09", "2026-09-11"]);
    expect(loads.get("2026-09-07")).toBe(75);
  });
});

describe("adaptation", () => {
  it("gains nothing without training, and more with more load, with diminishing returns", () => {
    expect(dailyGain(15, 0, 0)).toBe(0);
    const light = dailyGain(15, 75, 300), solid = dailyGain(15, 150, 600), double = dailyGain(15, 300, 1200);
    expect(solid).toBeGreaterThan(light);
    expect(double).toBeLessThan(2 * solid);
  });

  it("slows down as the grade gets harder", () => {
    expect(dailyGain(18, 150, 600)).toBeLessThan(dailyGain(15, 150, 600));
  });

  it("adapts less to a sudden jump in load (acute:chronic above 1.5)", () => {
    expect(dailyGain(15, 300, 400)).toBeLessThan(dailyGain(15, 300, 1200));
  });

  it("takes about two years from 6A to 7A at the reference load", () => {
    let level = 15, weeks = 0; // 6A
    while (level < 21 && weeks < 400) { level += 7 * dailyGain(level, 150, 600); weeks++; }
    expect(weeks).toBeGreaterThan(80);
    expect(weeks).toBeLessThan(140);
  });
});

describe("form", () => {
  it("is tired after a heavy week and fresh after an easy one", () => {
    const steady = new Map<string, number>(days("2026-06-01", 120, 2).map((d) => [d, 60]));
    const heavy = new Map(steady);
    for (const d of days("2026-09-21", 7, 1)) heavy.set(d, 200);
    expect(formOf(formIndex(heavy, "2026-09-27"))).toBe("tired");
    const easy = new Map([...steady].filter(([d]) => d < "2026-09-14"));
    expect(formOf(formIndex(easy, "2026-09-27"))).toBe("fresh");
  });
});

describe("calibration", () => {
  it("keeps the model as is until there are four weeks and two measured grades", () => {
    expect(calibrate(15, 16, 0.5, 3).factor).toBe(1);
    expect(calibrate(null, 16, 0.5, 10).factor).toBe(1);
  });

  it("follows the climber's real progress, weighted against the prior and bounded", () => {
    const faster = calibrate(15, 17, 1, 8);
    expect(faster.factor).toBeCloseTo(1.5);
    expect(calibrate(15, 15, 1, 8).factor).toBeCloseTo(0.75);
    expect(calibrate(15, 26, 1, 400).factor).toBeLessThanOrEqual(TWIN_MODEL_V1.maxCalibration);
  });
});

describe("the twin", () => {
  const today = "2026-11-15";
  const weekly = days("2026-08-03", 15, 7).flatMap((d) => [d]);

  it("starts where the climber measured on the start date, not at the grade written in the pact", () => {
    const s = twinState({ pact, work: [], today: "2026-09-07", measuredStart: { boulder: "6A+", route: null }, measuredNow: none });
    expect(s.boulder?.grade).toBe("6A+");
    expect(s.startSource).toEqual({ boulder: "measured", route: "pact" });
    expect(s.route?.grade).toBe("6a");
  });

  it("is ahead of a climber who trains less, and level with one who follows the plan", () => {
    const lazy = twinState({ pact, work: weekly.map((d) => boulder(d, 60)), today, measuredStart: { boulder: "6A", route: null }, measuredNow: none });
    expect(lazy.boulder!.score).toBeGreaterThan(lazy.youModel.boulder!.score);
    expect(lazy.adherence.planned).toBeGreaterThan(lazy.adherence.done);

    const plan = days("2026-09-07", 10, 7).flatMap((m) => [
      { ...boulder(m, 75), kind: "TRAINING" as const, targets: [{ block: "MAIN" as const, methodId: "limit-bouldering", modality: "TIME" as const, targetSets: 1, targetReps: null, targetSeconds: 60, restSeconds: null }] },
    ]);
    const keen = twinState({ pact, work: plan, today, measuredStart: { boulder: "6A", route: null }, measuredNow: none });
    expect(keen.youModel.boulder!.score).toBeGreaterThan(lazy.youModel.boulder!.score);
  });

  it("progresses realistically: a fraction of a grade over ten weeks, never the straight line to the goal", () => {
    const s = twinState({ pact, work: [], today, measuredStart: { boulder: "6A", route: null }, measuredNow: none });
    const gain = s.boulder!.score - 15;
    expect(gain).toBeGreaterThan(0.3);
    expect(gain).toBeLessThan(2);
  });

  it("learns from the climber's real progress", () => {
    const work = weekly.map((d) => boulder(d));
    const base = twinState({ pact, work, today, measuredStart: { boulder: "6A", route: null }, measuredNow: { boulder: "6A", route: null } });
    const quick = twinState({ pact, work, today, measuredStart: { boulder: "6A", route: null }, measuredNow: { boulder: "6B+", route: null } });
    expect(quick.calibration.factor).toBeGreaterThan(1);
    expect(base.calibration.factor).toBeLessThan(1);
    expect(quick.boulder!.score).toBeGreaterThan(base.boulder!.score);
  });

  it("stands still during a pause and is the same every time", () => {
    const paused = { ...pact, status: "PAUSED" as const, pausedSince: "2026-10-01" };
    const a = twinState({ pact: paused, work: [], today, measuredStart: { boulder: "6A", route: null }, measuredNow: none });
    const b = twinState({ pact: paused, work: [], today: "2026-12-15", measuredStart: { boulder: "6A", route: null }, measuredNow: none });
    expect(a.boulder!.score).toBeCloseTo(b.boulder!.score);
    expect(a).toEqual(twinState({ pact: paused, work: [], today, measuredStart: { boulder: "6A", route: null }, measuredNow: none }));
  });

  it("has no grade without a start grade", () => {
    const s = twinState({ pact: { ...pact, startBoulderGrade: null, targetBoulderGrade: null, startRouteGrade: null, targetRouteGrade: null }, work: [], today, measuredStart: none, measuredNow: none });
    expect(s.boulder).toBeNull();
    expect(s.route).toBeNull();
  });

  it("uses the climber's own adaptation for the climber", () => {
    const loads = climberLoads([boulder("2026-09-08"), boulder("2026-09-08")]);
    expect(loads.get("2026-09-08")).toBe(144);
    expect(adaptation(loads, "2026-09-08", "2026-09-08", 15)).toBeGreaterThan(0);
  });
});

describe("timeline and sends", () => {
  it("gives the twin day by day and counts weeks without a new grade", () => {
    const t = twinTimeline({ pact, work: [], today: "2026-11-15", measuredStart: { boulder: "6A", route: null }, measuredNow: { boulder: null, route: null } }, 7);
    expect(t.days).toHaveLength(8);
    expect(t.days.at(-1)!.date).toBe("2026-11-15");
    expect(t.plateauWeeks).toBeGreaterThanOrEqual(0);
    expect(t.plateauWeeks).toBeLessThanOrEqual(12);
  });

  it("keeps the hardest reliable boulder send of each day", () => {
    const problems = [
      { id: "a", nativeGrade: "6A", nativeGradeSystem: "FONT" }, { id: "b", nativeGrade: "6B", nativeGradeSystem: "FONT" },
    ] as unknown as Parameters<typeof bestSendByDay>[0];
    const at = (problemId: string, iso: string, result = "TOP") =>
      ({ id: problemId + iso, problemId, sessionId: "s", result, attemptNumber: 1, createdAt: new Date(iso) }) as unknown as Parameters<typeof bestSendByDay>[1][number];
    const best = bestSendByDay(problems, [at("a", "2026-11-13T18:00:00Z"), at("b", "2026-11-13T19:00:00Z"), at("b", "2026-11-14T19:00:00Z", "FALL")], "2026-11-01");
    expect(best.get("2026-11-13")).toBe("6B");
    expect(best.has("2026-11-14")).toBe(false);
  });
});
