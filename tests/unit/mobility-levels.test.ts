import { describe, expect, it } from "vitest";
import { classifyStage, type MobilityResult } from "@/lib/training/hip-mobility/assessment";
import { STAGE_REQUIREMENTS, levelView, splitLevelName, stageFromLevels } from "@/lib/training/hip-mobility/levels";

const r = (test: MobilityResult["test"], side: MobilityResult["side"], level: number | null, extra: Partial<MobilityResult> = {}): MobilityResult => ({
  test, side, done: level !== null, skipReason: level === null ? "NOT_POSSIBLE" : null, level, value: null,
  support: "HANDS", discomfort: 0, discomfortArea: null, active: true, flags: [], ...extra,
});
const both = (test: MobilityResult["test"], level: number | null) => [r(test, "LEFT", level), r(test, "RIGHT", level)];

describe("STAGE_REQUIREMENTS restates classifyStage", () => {
  it("gives every complete assessment the same stage as classifyStage", () => {
    const levels = [0, 1, 2, 3, 4];
    for (const a of levels) for (const b of levels) for (const c of levels) for (const d of [null, ...levels]) {
      const results = [...both("A", a), ...both("B", b), ...both("C", c), ...(d === null ? [] : both("D", d))];
      expect(stageFromLevels({ A: a, B: b, C: c, D: d }), `${a}${b}${c}${d}`).toBe(classifyStage(results).stage);
    }
  });

  it("asks more at every stage, never less", () => {
    for (const s of [1, 2, 3, 4] as const) {
      for (const t of ["A", "B", "C", "D"] as const) {
        const prev = STAGE_REQUIREMENTS[(s - 1) as 0 | 1 | 2 | 3][t];
        const now = STAGE_REQUIREMENTS[s][t];
        if (prev !== null) expect(now).not.toBeNull();
        if (prev !== null && now !== null) expect(now).toBeGreaterThanOrEqual(prev);
      }
    }
  });
});

describe("levelView", () => {
  it("without an assessment: stage 0, next is 1, every core test untested", () => {
    const v = levelView(null);
    expect(v.assessed).toBe(false);
    expect(v.stage).toBe(0);
    expect(v.next).toBe(1);
    expect(v.final).toBe(4);
    expect(v.missing).toEqual(["A", "B", "C"]);
    expect(v.nextBlockers).toEqual(["A", "B", "C"]);
    expect(v.nextCounted).toBe(3);
    expect(v.tests.every((t) => t.level === null && !t.limiting)).toBe(true);
    expect(v.tests.find((t) => t.id === "D")!.next!.required).toBeNull();
  });

  it("reads the weaker side, the limiting test and what the next stage asks", () => {
    const v = levelView([r("A", "LEFT", 1, { value: 2 }), r("A", "RIGHT", 3, { support: "LIGHT" }), ...both("B", 2), ...both("C", 2)]);
    expect(v.stage).toBe(0);
    expect(v.next).toBe(1);
    const a = v.tests.find((t) => t.id === "A")!;
    expect(a.level).toBe(1);
    expect(a.limiting).toBe(true);
    expect(a.sides[0]).toMatchObject({ side: "LEFT", level: 1, value: 2, support: "HANDS" });
    expect(a.sides[1]).toMatchObject({ side: "RIGHT", level: 3, support: "LIGHT" });
    expect(a.next).toEqual({ stage: 1, required: 2, met: false, gap: 1 });
    expect(a.final).toEqual({ stage: 4, required: 4, met: false, gap: 3 });
    expect(v.tests.find((t) => t.id === "B")!.next).toMatchObject({ met: true, gap: 0 });
    expect(v.nextBlockers).toEqual(["A"]);
    expect(v.nextMetCount).toBe(2);
  });

  it("counts a side skipped for pain as level 0, and a missing wall test blocks stage 3", () => {
    const pain = levelView([r("A", "LEFT", null, { skipReason: "PAIN" }), r("A", "RIGHT", 2), ...both("B", 2), ...both("C", 2)]);
    expect(pain.tests[0].level).toBe(0);
    expect(pain.tests[0].sides[0].skipped).toBe("PAIN");

    const noWall = levelView([...both("A", 3), ...both("B", 4), ...both("C", 3)]);
    expect(noWall.stage).toBe(2);
    expect(noWall.next).toBe(3);
    expect(noWall.functionalTested).toBe(false);
    expect(noWall.nextBlockers).toEqual(["D"]);
    expect(noWall.tests.find((t) => t.id === "D")!.next).toEqual({ stage: 3, required: 3, met: false, gap: null });
  });

  it("has no next stage at the top, and keeps the whole-body measure", () => {
    const v = levelView([...both("A", 4), ...both("B", 4), r("B", "BOTH", null, { done: true, skipReason: null, value: 90 }), ...both("C", 4), ...both("D", 4)]);
    expect(v.stage).toBe(4);
    expect(v.next).toBeNull();
    expect(v.nextBlockers).toEqual([]);
    expect(v.tests.every((t) => t.next === null && t.final.met)).toBe(true);
    expect(v.tests.find((t) => t.id === "B")!.both).toBe(90);
  });
});

describe("splitLevelName", () => {
  it("splits the label on its middle dot", () => {
    expect(splitLevelName("Niveau 1 · Mobilité de base, avec appui")).toEqual({ short: "Niveau 1", title: "Mobilité de base, avec appui" });
    expect(splitLevelName("Level 2")).toEqual({ short: "Level 2", title: "" });
  });
});
