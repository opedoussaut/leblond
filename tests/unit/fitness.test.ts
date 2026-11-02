import { describe, expect, it } from "vitest";
import { assessmentCadence, measuredHistory, selfRatedHistory } from "@/lib/analytics/fitness";
import { DEFAULT_SKILLS } from "@/lib/training/assessment";
import { PROTOCOL_VERSION, type Measurement } from "@/lib/training/assessment-protocol";

const m = (id: Measurement["id"], value: number, date: string, quality: Measurement["quality"] = "complete"): Measurement => ({
  id, value, date, quality, unit: id === "hang-20mm" ? "s" : id === "pull-ups" ? "reps" : id === "continuous-climb" ? "min" : "errors",
  evidence: "measured", protocolVersion: PROTOCOL_VERSION, conditions: "same edge",
});
const bilan = (createdAt: string, measurements: Measurement[]) => ({ createdAt, measurements });

describe("measured fitness history", () => {
  it("keeps one series per test, oldest result first, whatever order the assessments arrive in", () => {
    const series = measuredHistory([
      bilan("2026-12-01T10:00:00Z", [m("pull-ups", 10, "2026-12-01")]),
      bilan("2026-10-01T10:00:00Z", [m("pull-ups", 6, "2026-10-01"), m("hang-20mm", 20, "2026-10-01")]),
      bilan("2026-11-01T10:00:00Z", [m("pull-ups", 8, "2026-11-01")]),
    ]);
    expect(series.map((s) => s.test.id)).toEqual(["hang-20mm", "pull-ups"]);
    expect(series[1].points.map((p) => p.value)).toEqual([6, 8, 10]);
    expect(series[1].latest.value).toBe(10);
  });

  it("compares first and latest, and treats fewer foot errors as better", () => {
    const series = measuredHistory([
      bilan("2026-10-01T10:00:00Z", [m("quiet-feet", 12, "2026-10-01")]),
      bilan("2026-11-01T10:00:00Z", [m("quiet-feet", 7, "2026-11-01")]),
    ]);
    expect(series[0].change).toMatchObject({ delta: -5, direction: "better", comparable: true });
  });

  it("has no change with a single result, and flags partial conditions as not comparable", () => {
    expect(measuredHistory([bilan("2026-10-01T10:00:00Z", [m("hang-20mm", 20, "2026-10-01")])])[0].change).toBeNull();
    const partial = measuredHistory([
      bilan("2026-10-01T10:00:00Z", [m("hang-20mm", 20, "2026-10-01")]),
      bilan("2026-11-01T10:00:00Z", [m("hang-20mm", 25, "2026-11-01", "partial")]),
    ])[0];
    expect(partial.points[1].partial).toBe(true);
    expect(partial.change?.comparable).toBe(false);
  });

  it("ignores malformed stored results instead of plotting them", () => {
    const broken = [{ id: "hang-20mm", value: 999 }] as unknown as Measurement[];
    expect(measuredHistory([bilan("2026-10-01T10:00:00Z", broken)])).toEqual([]);
  });

  it("orders two results on the same day by the assessment that came first", () => {
    const series = measuredHistory([
      bilan("2026-10-01T18:00:00Z", [m("pull-ups", 9, "2026-10-01")]),
      bilan("2026-10-01T09:00:00Z", [m("pull-ups", 7, "2026-10-01")]),
    ]);
    expect(series[0].points.map((p) => p.value)).toEqual([7, 9]);
  });
});

describe("self-rated history", () => {
  it("merges assessments and check-ins on a shared timeline, one series per skill", () => {
    const series = selfRatedHistory(
      [{ createdAt: "2026-10-01T10:00:00Z", ratings: { ...DEFAULT_SKILLS, power: 2 } }],
      [{ createdAt: "2026-10-15T10:00:00Z", ratings: { ...DEFAULT_SKILLS, power: 3.5 } }],
    );
    expect(series).toHaveLength(6);
    expect(series.find((s) => s.axis === "power")?.points).toEqual([
      { date: "2026-10-01", value: 2, partial: false },
      { date: "2026-10-15", value: 3.5, partial: false },
    ]);
  });
});

describe("assessment cadence", () => {
  it("is empty before the first assessment", () => {
    expect(assessmentCadence([], "2026-11-02")).toBeNull();
  });

  it("suggests a date from the latest assessment and says when it is due", () => {
    const list = [
      { createdAt: "2026-09-01T10:00:00Z", horizonWeeks: 12 },
      { createdAt: "2026-10-01T10:00:00Z", horizonWeeks: 8 },
    ];
    expect(assessmentCadence(list, "2026-10-20")).toEqual({ last: "2026-10-01", next: "2026-10-29", due: false });
    expect(assessmentCadence(list, "2026-10-29")?.due).toBe(true);
  });
});
