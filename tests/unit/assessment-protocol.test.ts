import { describe, expect, it } from "vitest";
import {
  PROTOCOL_TESTS, compareMeasurements, measurementQuality, measurementSchema, observedEvidence, reassessmentDate,
  testAllowed, type Measurement,
} from "@/lib/training/assessment-protocol";
import { assessmentInputSchema } from "@/lib/training/assessment";

const m = (id: Measurement["id"], value: number, quality: Measurement["quality"] = "complete", protocolVersion = 2): Measurement => ({
  id, value, unit: PROTOCOL_TESTS.find((t) => t.id === id)!.unit, evidence: "measured", protocolVersion,
  date: "2026-10-20", conditions: "same board", quality,
});

describe("structured assessment protocol", () => {
  it("never offers finger loading to injured, unwarmed or inexperienced climbers", () => {
    const hang = PROTOCOL_TESTS.find((t) => t.id === "hang-20mm")!;
    expect(testAllowed(hang, { experienceMonths: 36, currentPain: false, warmedUp: true })).toBe(true);
    expect(testAllowed(hang, { experienceMonths: 36, currentPain: true, warmedUp: true })).toBe(false);
    expect(testAllowed(hang, { experienceMonths: 36, currentPain: false, warmedUp: false })).toBe(false);
    expect(testAllowed(hang, { experienceMonths: 6, currentPain: false, warmedUp: true })).toBe(false);
    const feet = PROTOCOL_TESTS.find((t) => t.id === "quiet-feet")!;
    expect(testAllowed(feet, { experienceMonths: 0, currentPain: true, warmedUp: false })).toBe(true);
  });
  it("caps every test and rejects out-of-range or mislabelled values", () => {
    expect(measurementSchema.safeParse(m("hang-20mm", 45)).success).toBe(true);
    expect(measurementSchema.safeParse(m("hang-20mm", 75)).success).toBe(false);
    expect(measurementSchema.safeParse({ ...m("pull-ups", 8), unit: "s" }).success).toBe(false);
  });
  it("records data quality from the reference conditions", () => {
    expect(measurementQuality("Beastmaker 20mm", { warmedUp: true, rested24h: true })).toBe("complete");
    expect(measurementQuality("", { warmedUp: true, rested24h: true })).toBe("partial");
    expect(measurementQuality("board", { warmedUp: true, rested24h: false })).toBe("partial");
  });
  it("compares baseline with follow-up and respects 'lower is better' tests", () => {
    const changes = compareMeasurements(
      [m("hang-20mm", 20), m("quiet-feet", 12), m("pull-ups", 8)],
      [m("hang-20mm", 28), m("quiet-feet", 7), m("pull-ups", 8, "partial")],
    );
    expect(changes.find((c) => c.id === "hang-20mm")).toMatchObject({ delta: 8, direction: "better", comparable: true });
    expect(changes.find((c) => c.id === "quiet-feet")).toMatchObject({ delta: -5, direction: "better" });
    expect(changes.find((c) => c.id === "pull-ups")).toMatchObject({ direction: "same", comparable: false });
  });
  it("reports small journal samples as insufficient instead of numbers", () => {
    const thin = observedEvidence({ sessions28d: 1, problems28d: 3, sends28d: 2, flashes28d: 1, workingGrade: null, workingSample: 3 });
    expect(thin.every((o) => o.evidence === "insufficient")).toBe(true);
    expect(thin.find((o) => o.id === "sendRate")!.value).toBe("—");
    const rich = observedEvidence({ sessions28d: 8, problems28d: 40, sends28d: 20, flashes28d: 6, workingGrade: "6B", workingSample: 25 });
    expect(rich.find((o) => o.id === "sendRate")).toMatchObject({ value: "50 %", evidence: "observed" });
    expect(rich.find((o) => o.id === "sessionsPerWeek")!.value).toBe("2.0");
  });
  it("schedules reassessment at least four weeks out", () => {
    expect(reassessmentDate("2026-10-20", 4)).toBe("2026-11-17");
    expect(reassessmentDate("2026-10-20", 12)).toBe("2026-12-01");
  });
  it("keeps legacy self-assessment inputs valid", () => {
    const legacy = { methodId: "technique", ratings: { technique: 3, fingers: 3, power: 3, endurance: 3, mental: 3, structure: 3 }, horizonWeeks: 12, sessionsPerWeek: 2, goal: "" };
    expect(assessmentInputSchema.safeParse(legacy).success).toBe(true);
    expect(assessmentInputSchema.safeParse({ ...legacy, kind: "STRUCTURED", measurements: [m("pull-ups", 10)] }).success).toBe(true);
  });
});
