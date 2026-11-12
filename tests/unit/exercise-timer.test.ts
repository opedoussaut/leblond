import { describe, expect, it } from "vitest";
import {
  COUNT_IN_SECONDS, restBeeps, spokenDuration, timerBeeps, timerPlan, timerState, totalSeconds,
} from "@/lib/training/timer";

const T0 = Date.parse("2026-11-12T18:00:00.000Z");
const s = (n: number) => T0 + n * 1000;

describe("timerPlan", () => {
  it("times holds, hangs and stretches, after a 3-second count-in", () => {
    const plan = timerPlan({ modality: "HOLD", targetSeconds: 40, targetReps: null })!;
    expect(plan.phases).toEqual([
      { kind: "ready", seconds: COUNT_IN_SECONDS, rep: 0 },
      { kind: "work", seconds: 40, rep: 1 },
    ]);
    expect(totalSeconds(plan)).toBe(43);
  });

  it("times repeaters: hang and recovery, no recovery after the last rep", () => {
    const plan = timerPlan({ modality: "INTERVALS", targetSeconds: 7, targetReps: 6 })!;
    expect(plan.phases.filter((p) => p.kind === "work")).toHaveLength(6);
    expect(plan.phases.filter((p) => p.kind === "recover")).toHaveLength(5);
    expect(plan.phases.at(-1)).toEqual({ kind: "work", seconds: 7, rep: 6 });
    expect(totalSeconds(plan)).toBe(3 + 6 * 7 + 5 * 3);
  });

  it("times timed blocks (minutes)", () => {
    expect(timerPlan({ modality: "TIME", targetSeconds: 1200, targetReps: null })?.workSeconds).toBe(1200);
  });

  it("gives no timer to reps, routes, free work or a missing duration", () => {
    expect(timerPlan({ modality: "REPS", targetSeconds: 30, targetReps: 8 })).toBeNull();
    expect(timerPlan({ modality: "ROUTES", targetSeconds: null, targetReps: 4 })).toBeNull();
    expect(timerPlan({ modality: "FREE", targetSeconds: 600, targetReps: null })).toBeNull();
    expect(timerPlan({ modality: "HOLD", targetSeconds: null, targetReps: null })).toBeNull();
    expect(timerPlan({ modality: "HOLD", targetSeconds: 0, targetReps: null })).toBeNull();
  });
});

describe("timerBeeps", () => {
  it("a 10 s hang: 3, 2, 1, go, pips before the end, then the end beep", () => {
    const beeps = timerBeeps(timerPlan({ modality: "HOLD", targetSeconds: 10, targetReps: null })!, T0);
    expect(beeps).toEqual([
      { at: s(0), tone: "pip" }, { at: s(1), tone: "pip" }, { at: s(2), tone: "pip" },
      { at: s(3), tone: "go" },
      { at: s(10), tone: "pip" }, { at: s(11), tone: "pip" }, { at: s(12), tone: "pip" },
      { at: s(13), tone: "end" },
    ]);
  });

  it("repeaters: go at each hang, stop at each recovery, no pips inside 7 s hangs, one end", () => {
    const beeps = timerBeeps(timerPlan({ modality: "INTERVALS", targetSeconds: 7, targetReps: 2 })!, T0);
    expect(beeps).toEqual([
      { at: s(0), tone: "pip" }, { at: s(1), tone: "pip" }, { at: s(2), tone: "pip" },
      { at: s(3), tone: "go" },
      { at: s(10), tone: "stop" },
      { at: s(13), tone: "go" },
      { at: s(20), tone: "end" },
    ]);
  });

  it("ends exactly when the timer does", () => {
    const plan = timerPlan({ modality: "INTERVALS", targetSeconds: 7, targetReps: 6 })!;
    const beeps = timerBeeps(plan, T0);
    expect(beeps.filter((b) => b.tone === "end")).toEqual([{ at: s(totalSeconds(plan)), tone: "end" }]);
    expect(beeps.filter((b) => b.tone === "go")).toHaveLength(6);
  });
});

describe("timerState", () => {
  const plan = timerPlan({ modality: "INTERVALS", targetSeconds: 7, targetReps: 2 })!;

  it("counts in, then the hang, the recovery and the last hang, in whole seconds", () => {
    expect(timerState(plan, T0, s(0))).toMatchObject({ done: false, phase: { kind: "ready" }, remaining: 3 });
    expect(timerState(plan, T0, s(2.2))).toMatchObject({ phase: { kind: "ready" }, remaining: 1 });
    expect(timerState(plan, T0, s(3))).toMatchObject({ phase: { kind: "work", rep: 1 }, remaining: 7 });
    expect(timerState(plan, T0, s(9.5))).toMatchObject({ phase: { kind: "work", rep: 1 }, remaining: 1 });
    expect(timerState(plan, T0, s(10))).toMatchObject({ phase: { kind: "recover", rep: 1 }, remaining: 3 });
    expect(timerState(plan, T0, s(13))).toMatchObject({ phase: { kind: "work", rep: 2 }, remaining: 7 });
  });

  it("is done at the end, and stays done", () => {
    expect(timerState(plan, T0, s(20))).toEqual({ done: true });
    expect(timerState(plan, T0, s(500))).toEqual({ done: true });
  });
});

describe("restBeeps", () => {
  it("pips for the last 3 seconds of a rest, then go", () => {
    expect(restBeeps(s(60), s(0)).map((b) => [b.at - T0, b.tone])).toEqual([
      [57000, "pip"], [58000, "pip"], [59000, "pip"], [60000, "go"],
    ]);
  });

  it("only the beeps still to come (a rest restored late, or a short one)", () => {
    expect(restBeeps(s(60), s(58.5)).map((b) => b.tone)).toEqual(["pip", "go"]);
    expect(restBeeps(s(60), s(61))).toEqual([]);
  });
});

describe("spokenDuration", () => {
  it("says durations the way they are said", () => {
    expect(spokenDuration(10)).toBe("10 s");
    expect(spokenDuration(1200)).toBe("20 min");
    expect(spokenDuration(90)).toBe("1:30");
  });
});
