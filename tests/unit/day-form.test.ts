import { describe, expect, it } from "vitest";
import { dayForm } from "@/lib/analytics/day-form";

const fresh = { sleep: 3, fatigue: 1, soreness: 0, pain: [] } as const;

describe("day form (self-reported)", () => {
  it("is good when everything is declared fine", () => {
    expect(dayForm({ ...fresh, pain: [] })).toEqual({ level: "GOOD", segments: 3, strain: 0, worstPain: null });
  });
  it("stays good with a single small signal", () => {
    expect(dayForm({ ...fresh, pain: [], sleep: 2 }).level).toBe("GOOD");
    expect(dayForm({ ...fresh, pain: [], soreness: 1 }).level).toBe("GOOD");
  });
  it("asks to watch when small signals add up", () => {
    expect(dayForm({ ...fresh, pain: [], sleep: 2, fatigue: 2 })).toMatchObject({ level: "WATCH", segments: 2, strain: 2 });
  });
  it("asks to watch when one answer is at its worst", () => {
    expect(dayForm({ ...fresh, pain: [], sleep: 1 }).level).toBe("WATCH");
    expect(dayForm({ ...fresh, pain: [], fatigue: 3 }).level).toBe("WATCH");
    expect(dayForm({ ...fresh, pain: [], soreness: 2 }).level).toBe("WATCH");
  });
  it("asks to watch with any non-acute pain, and reports the worst", () => {
    const f = dayForm({ ...fresh, pain: [{ area: "fingers", level: "DISCOMFORT" }, { area: "shoulder", level: "PAIN" }] });
    expect(f).toMatchObject({ level: "WATCH", worstPain: "PAIN" });
  });
  it("advises rest with acute pain, whatever the rest", () => {
    expect(dayForm({ ...fresh, pain: [{ area: "elbow", level: "ACUTE" }] })).toMatchObject({ level: "REST", segments: 1, worstPain: "ACUTE" });
  });
  it("advises rest when very tired, with the recommendation's thresholds", () => {
    expect(dayForm({ ...fresh, pain: [], sleep: 1, fatigue: 3 }).level).toBe("REST");
    expect(dayForm({ ...fresh, pain: [], fatigue: 3, soreness: 2 }).level).toBe("REST");
  });
  it("advises rest when nearly everything is at its worst", () => {
    expect(dayForm({ sleep: 2, fatigue: 2, soreness: 2, pain: [] }).level).toBe("WATCH");
    expect(dayForm({ sleep: 1, fatigue: 2, soreness: 2, pain: [] })).toMatchObject({ level: "REST", strain: 5 });
  });
});
