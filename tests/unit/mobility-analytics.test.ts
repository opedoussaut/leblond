import { describe, expect, it } from "vitest";
import {
  assessmentSeries, changesSinceBaseline, comparability, compareAssessments, discomfortReports, exerciseProgress,
  hardestMovement, mobilityOverview, mobilityPeriods, sideComparison, type AssessmentPoint,
} from "@/lib/analytics/mobility";
import type { MobilityConditions, MobilityResult } from "@/lib/training/hip-mobility/assessment";
import type { ExercisePerformance, MobilitySessionRecord, MobilitySet } from "@/lib/training/hip-mobility/prescription";
import { mobilityContext, type CoachMobilityInput } from "@/lib/coach/context";
import { planSession } from "@/lib/training/hip-mobility/prescription";
import { NO_HEALTH_ISSUE } from "@/lib/training/health";

const cond = (over: Partial<MobilityConditions> = {}): MobilityConditions =>
  ({ warmedUp: false, timeOfDay: "EVENING", cushionCm: 10, wall: null, notes: "", ...over });
const res = (test: MobilityResult["test"], side: MobilityResult["side"], level: number, extra: Partial<MobilityResult> = {}): MobilityResult => ({
  test, side, done: true, skipReason: null, level, value: null, support: "HANDS", discomfort: 0, discomfortArea: null, active: true, flags: [], ...extra,
});
const point = (date: string, results: MobilityResult[], conditions: MobilityConditions | null = cond()): AssessmentPoint =>
  ({ id: date, date, protocolVersion: 1, conditions, results, stage: 0, rulesVersion: 1 });

const set = (side: MobilitySet["side"], reps: number, extra: Partial<MobilitySet> = {}): MobilitySet =>
  ({ side, reps, variant: "STANDARD", controlled: true, discomfort: 0, flags: [], completed: true, ...extra });
const perf = (exerciseId: string, sets: MobilitySet[], status: ExercisePerformance["status"] = "DONE"): ExercisePerformance =>
  ({ exerciseId, status, prescribed: { variant: "STANDARD", reps: 6 }, sets });
const rec = (date: string, exercises: ExercisePerformance[], extra: Partial<MobilitySessionRecord> = {}): MobilitySessionRecord =>
  ({ id: "s-" + date, date, status: "COMPLETED", level: 0, pain: 0, rpe: 3, minutes: 10, exercises, ...extra });

describe("comparing assessments", () => {
  it("compares only in similar conditions, and treats time of day as a caveat", () => {
    const a = point("2026-11-01", []), b = point("2026-12-01", [], cond({ timeOfDay: "MORNING", cushionCm: 11 }));
    expect(comparability(a, b, "A")).toEqual({ comparable: true, differences: [], caveats: ["timeOfDay"] });
    expect(comparability(a, point("2026-12-01", [], cond({ cushionCm: 15 })), "A").differences).toEqual(["cushion"]);
    expect(comparability(a, point("2026-12-01", [], cond({ cushionCm: 15 })), "B").comparable).toBe(true);
    expect(comparability(a, point("2026-12-01", [], cond({ warmedUp: true })), "C").differences).toEqual(["warmUp"]);
    expect(comparability(a, point("2026-12-01", [], null), "C").differences).toEqual(["conditionsMissing"]);
    expect(comparability(a, { ...point("2026-12-01", []), protocolVersion: 2 }, "C").differences).toEqual(["protocol"]);
  });

  it("needs the same wall, angle and spacing for the functional test", () => {
    const wall = { kind: "BOARD" as const, angleDeg: 20, spacingCm: 40 };
    const a = point("2026-11-01", [], cond({ wall }));
    expect(comparability(a, point("2026-12-01", [], cond({ wall: { ...wall, angleDeg: 24, spacingCm: 44 } })), "D").comparable).toBe(true);
    expect(comparability(a, point("2026-12-01", [], cond({ wall: { ...wall, angleDeg: 30 } })), "D").differences).toEqual(["wallAngle"]);
    expect(comparability(a, point("2026-12-01", [], cond({ wall: { kind: "WALL", angleDeg: 20, spacingCm: 60 } })), "D").differences).toEqual(["wallKind", "spacing"]);
    expect(comparability(a, point("2026-12-01", [], cond()), "D").differences).toEqual(["wallMissing"]);
  });

  it("reads a change from the level, then the support, then the measured value", () => {
    const before = point("2026-11-01", [
      res("A", "LEFT", 1), res("A", "RIGHT", 2), res("B", "LEFT", 2, { value: 30 }), res("B", "RIGHT", 2, { value: 30 }),
      res("B", "BOTH", 0, { value: 60 }), res("C", "LEFT", 2, { support: "HANDS" }),
    ]);
    const after = point("2026-12-01", [
      res("A", "LEFT", 2), res("A", "RIGHT", 2), res("B", "LEFT", 2, { value: 24 }), res("B", "RIGHT", 2, { value: 34 }),
      res("B", "BOTH", 0, { value: 70 }), res("C", "LEFT", 2, { support: "LIGHT" }),
    ]);
    const changes = compareAssessments(before, after);
    const dir = (t: string, s: string) => changes.find((c) => c.test === t && c.side === s)?.direction;
    expect(dir("A", "LEFT")).toBe("better");
    expect(dir("A", "RIGHT")).toBe("same");
    expect(dir("B", "LEFT")).toBe("better");
    expect(dir("B", "RIGHT")).toBe("worse");
    expect(dir("B", "BOTH")).toBe("better");
    expect(dir("C", "LEFT")).toBe("better");
    expect(changes.some((c) => c.test === "D")).toBe(false);
  });

  it("measures the latest assessment against the first comparable one, test by test", () => {
    const first = point("2026-11-01", [res("A", "LEFT", 1), res("C", "LEFT", 1)], cond({ cushionCm: 20 }));
    const second = point("2026-11-15", [res("A", "LEFT", 2), res("C", "LEFT", 2)], cond({ cushionCm: 10 }));
    const latest = point("2026-12-01", [res("A", "LEFT", 3), res("C", "LEFT", 3)], cond({ cushionCm: 10 }));
    const changes = changesSinceBaseline([second, latest, first]);
    expect(changes.find((c) => c.test === "C")).toMatchObject({ since: "2026-11-01", comparable: true, direction: "better" });
    expect(changes.find((c) => c.test === "A")).toMatchObject({ since: "2026-11-15", comparable: true });
    expect(changesSinceBaseline([latest])).toEqual([]);
  });

  it("says when no earlier assessment is comparable instead of comparing", () => {
    const first = point("2026-11-01", [res("A", "LEFT", 1)], cond({ cushionCm: 20 }));
    const latest = point("2026-12-01", [res("A", "LEFT", 3)], cond({ cushionCm: 5 }));
    expect(changesSinceBaseline([first, latest])[0]).toMatchObject({ comparable: false, differences: ["cushion"], direction: null });
    expect(assessmentSeries([latest, first], "A", "LEFT").map((p) => p.comparableWithFirst)).toEqual([true, false]);
  });
});

describe("session follow-up", () => {
  const records = [
    rec("2026-11-02", [perf("seated-hip-rotations", [set("LEFT", 6, { variant: "EASIER" }), set("RIGHT", 6)])]),
    rec("2026-11-04", [perf("seated-hip-rotations", [set("LEFT", 6, { variant: "EASIER", controlled: false }), set("RIGHT", 7)])]),
    rec("2026-11-10", [perf("seated-hip-rotations", [set("LEFT", 5, { variant: "EASIER", discomfort: 4 }), set("RIGHT", 7)])], { pain: 3 }),
  ];

  it("counts sessions per week and per month, including empty ones", () => {
    expect(mobilityPeriods(records, "2026-11-11", "week", 3)).toEqual([
      { start: "2026-10-26", sessions: 0, minutes: 0 },
      { start: "2026-11-02", sessions: 2, minutes: 20 },
      { start: "2026-11-09", sessions: 1, minutes: 10 },
    ]);
    expect(mobilityPeriods(records, "2026-11-11", "month", 2).map((p) => [p.start, p.sessions])).toEqual([["2026-10-01", 0], ["2026-11-01", 3]]);
  });

  it("follows one exercise: version, reps per side, control and discomfort", () => {
    const p = exerciseProgress(records, "seated-hip-rotations");
    expect(p.map((x) => x.variant)).toEqual(["EASIER", "EASIER", "EASIER"]);
    expect(p.map((x) => x.reps.right)).toEqual([6, 7, 7]);
    expect(p[1].controlledShare).toBe(0.5);
    expect(p[2].maxDiscomfort).toBe(4);
    expect(exerciseProgress(records, "nope")).toEqual([]);
  });

  it("finds the side that needs more help", () => {
    const [c] = sideComparison(records);
    expect(c).toMatchObject({ exerciseId: "seated-hip-rotations", sessions: 3, harderSide: "LEFT" });
    expect(c.left.easierShare).toBe(1);
    expect(c.right.easierShare).toBe(0);
    expect(sideComparison([rec("2026-11-02", [perf("seated-hip-rotations", [set("LEFT", 6), set("RIGHT", 6)])])])[0].harderSide).toBeNull();
    expect(sideComparison([rec("2026-11-02", [perf("supine-knee-sways", [set("BOTH", 8)])])])).toEqual([]);
  });

  it("lists discomfort and warning signs, most recent first", () => {
    const withFlag = [...records, rec("2026-11-11", [perf("low-step-placements", [set("RIGHT", 5, { flags: ["CATCHING"] })])])];
    const reports = discomfortReports(withFlag);
    expect(reports.map((r) => [r.date, r.exerciseId, r.discomfort, r.flags])).toEqual([
      ["2026-11-11", "low-step-placements", 0, ["CATCHING"]],
      ["2026-11-10", null, 3, []],
      ["2026-11-10", "seated-hip-rotations", 4, []],
    ]);
  });

  it("names the hardest movement only when one stands out", () => {
    expect(hardestMovement(records)).toMatchObject({ exerciseId: "seated-hip-rotations" });
    expect(hardestMovement([rec("2026-11-02", [perf("seated-hip-rotations", [set("LEFT", 6), set("RIGHT", 6)])])])).toBeNull();
  });

  it("summarises the programme without mixing measurements and records", () => {
    const o = mobilityOverview(records, [point("2026-11-01", [])], "2026-11-11");
    expect(o).toEqual({ sessionsTotal: 3, sessionsLast28: 3, lastSession: "2026-11-10", assessments: 1, latestStage: 0, latestAssessment: "2026-11-01" });
  });
});

describe("Patrick's mobility context", () => {
  const enrollment = { startedOn: "2026-11-01", workingLevel: 0, sessionLength: "STANDARD" as const, sessionsPerWeek: 3, status: "ACTIVE" as const };
  const core = (lvl: number) => (["A", "B", "C"] as const).flatMap((t) => [res(t, "LEFT", lvl, { value: 2 }), res(t, "RIGHT", lvl, { value: 3 })]);

  it("is absent for climbers who never used the programme", () => {
    expect(mobilityContext(null)).toBeNull();
    expect(mobilityContext({ enrollment: null, assessments: [], records: [], plan: null, today: "2026-11-11" })).toBeNull();
  });

  it("labels the stage as internal and passes the clinician advice through", () => {
    const records = ["2026-11-05", "2026-11-07", "2026-11-09"].map((d) =>
      rec(d, [perf("seated-hip-rotations", [set("LEFT", 6, { discomfort: 5 }), set("RIGHT", 6)])]));
    const plan = planSession({ workingLevel: 0, length: "STANDARD", records, assessment: core(1), health: NO_HEALTH_ISSUE });
    const ctx = mobilityContext({ enrollment, assessments: [point("2026-11-01", core(1))], records, plan, today: "2026-11-11" })!;
    expect(ctx.assessedStage).toMatchObject({ stage: 0, label: "Level 0 · Highly restricted, heavy support" });
    expect(ctx.clinicianCheckRecommended).toBe(true);
    expect(ctx.clinicianReasons).toEqual(["persistentDiscomfort"]);
    expect(ctx.progressionSupportedByRecords).toBe(false);
    expect(ctx.hardestMovement).toBe("Supported seated hip rotations");
    expect(ctx.recentSessions[0].exercises[0]).toMatchObject({ reps: { left: 6, right: 6 }, maxDiscomfort: 5 });
  });

  it("stays bounded with a long history", () => {
    const many = Array.from({ length: 60 }, (_, i) => {
      const day = String((i % 28) + 1).padStart(2, "0");
      const month = i < 28 ? "09" : i < 56 ? "10" : "11";
      return rec(`2026-${month}-${day}`, ["supine-knee-sways", "seated-hip-rotations", "adductor-rock-backs", "low-step-placements", "lateral-weight-shifts"]
        .map((id) => perf(id, [set("LEFT", 6, { discomfort: 3 }), set("RIGHT", 6, { discomfort: 3 })])), { id: "s" + i });
    });
    const assessments = Array.from({ length: 10 }, (_, i) => point(`2026-${String(i + 1).padStart(2, "0")}-01`, [...core(2), res("D", "LEFT", 2), res("D", "RIGHT", 2)],
      cond({ wall: { kind: "BOARD", angleDeg: 20, spacingCm: 40 } })));
    const input: CoachMobilityInput = { enrollment, assessments, records: many,
      plan: planSession({ workingLevel: 0, length: "STANDARD", records: many, assessment: core(2), health: NO_HEALTH_ISSUE }), today: "2026-11-11" };
    const ctx = mobilityContext(input)!;
    expect(ctx.recentSessions.length).toBeLessThanOrEqual(3);
    expect(ctx.discomfortReports.length).toBeLessThanOrEqual(6);
    expect(JSON.stringify(ctx).length).toBeLessThan(8000);
  });
});
