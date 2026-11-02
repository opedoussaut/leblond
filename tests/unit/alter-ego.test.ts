import { describe, expect, it } from "vitest";
import { signPactSchema, pactFromRow, type PactRow } from "@/lib/training/alter-ego";
import {
  PROGRESSION_V1, boulderPace, climberLedger, coachSummary, egoLedger, egoSchedule, egoSessionLedger, egoTimeline,
  isScalable, loadFactor, pactClock, pactIsOver, pactProgress, pactTransition, pactWeek, pauseLength, positionAt, routePace, scaleTarget, shouldEaseOff,
  standing, timelineSeconds, type ClimberWork, type Pact, type WorkTarget,
} from "@/lib/analytics/alter-ego";

const pact = (over: Partial<Pact> = {}): Pact => ({
  id: "p", displayName: "Patrick bis", planName: "Ma semaine",
  plan: [{ day: 1, methodId: "strength-conditioning", minutes: 45, notes: "" }, { day: 4, methodId: "easy-volume", minutes: 60, notes: "" }],
  progression: PROGRESSION_V1, startDate: "2026-11-02", horizonWeeks: 12, status: "ACTIVE",
  pausedSince: null, pausedDays: 0,
  startBoulderGrade: "6A", targetBoulderGrade: "7A", startRouteGrade: "6a", targetRouteGrade: "6c",
  ...over,
});
const pullUps: WorkTarget = { block: "MAIN", methodId: "strength-conditioning", modality: "REPS", targetSets: 3, targetReps: 6, targetSeconds: null, restSeconds: 120 };
const work = (date: string, reps: number, pain: number | null = 0, minutes = 40): ClimberWork =>
  ({ status: "COMPLETED", date, actualMinutes: minutes, pain, reps });

describe("load factor", () => {
  it("starts at the plan, gains steadily and caps at +50 %", () => {
    expect(loadFactor(0)).toBe(1);
    expect(loadFactor(4)).toBeCloseTo(1.1);
    expect(loadFactor(40)).toBe(1.5);
  });

  it("backs off every fourth week without dropping under the plan", () => {
    expect(loadFactor(3)).toBe(1);
    expect(loadFactor(39)).toBeCloseTo(1.5 * 0.85);
    expect(loadFactor(39)).toBeLessThan(loadFactor(38));
  });
});

describe("what the ego may scale", () => {
  it("only scales main block work that is safe to add to", () => {
    expect(isScalable(pullUps)).toBe(true);
    expect(isScalable({ ...pullUps, block: "WARMUP" })).toBe(false);
    expect(isScalable({ ...pullUps, modality: "FREE" })).toBe(false);
    expect(isScalable({ ...pullUps, modality: "INTERVALS" })).toBe(false);
  });

  it.each(["max-hangs", "repeaters", "campus", "limit-bouldering"])("never loads %s", (methodId) => {
    const fixed = { ...pullUps, methodId, modality: "HOLD" as const, targetReps: null, targetSeconds: 10 };
    expect(isScalable(fixed)).toBe(false);
    expect(scaleTarget(fixed, 1.5)).toEqual(fixed);
  });

  it("adds reps but never shortens the rest", () => {
    const scaled = scaleTarget(pullUps, 1.5);
    expect(scaled.targetReps).toBe(9);
    expect(scaled.restSeconds).toBe(120);
  });
});

describe("the ego's session, second by second", () => {
  const phases = egoTimeline([pullUps, { ...pullUps, methodId: "max-hangs", modality: "HOLD", targetSets: 2, targetReps: null, targetSeconds: 10, restSeconds: 180 }], 1);

  it("lays out work and rest, with no rest after the last set", () => {
    expect(phases.map((p) => [p.kind, p.seconds])).toEqual([
      ["WORK", 18], ["REST", 120], ["WORK", 18], ["REST", 120], ["WORK", 18], ["REST", 60],
      ["WORK", 10], ["REST", 180], ["WORK", 10],
    ]);
    expect(timelineSeconds(phases)).toBe(554);
  });

  it("counts reps during a set", () => {
    const at = positionAt(phases, 9);
    expect(at.phase).toMatchObject({ kind: "WORK", exercise: 0, set: 1, sets: 3 });
    expect(at.repsDone).toBe(3);
    expect(at.remaining).toBe(9);
  });

  it("rests through the rest and tells how long is left", () => {
    const at = positionAt(phases, 100);
    expect(at.phase?.kind).toBe("REST");
    expect(at.remaining).toBe(38);
  });

  it("has finished once the timeline is over", () => {
    expect(positionAt(phases, 554)).toEqual({ done: true, phase: null, remaining: 0, repsDone: null, fraction: 1 });
    expect(positionAt([], 0).done).toBe(true);
  });
});

describe("the ego's schedule", () => {
  it("follows the plan's weekdays and owes nothing before the start date", () => {
    const signedMidweek = egoSchedule(pact({ startDate: "2026-11-04", horizonWeeks: 2 }));
    expect(signedMidweek.map((s) => s.date)).toEqual(["2026-11-06", "2026-11-10", "2026-11-13"]);
    expect(signedMidweek.map((s) => s.week)).toEqual([0, 1, 1]);
  });

  it("does sessions whether or not the climber does", () => {
    const you = climberLedger([], "2026-11-02");
    const ego = egoLedger(pact(), "2026-11-10");
    expect(ego.sessions).toBe(2);
    expect(standing(you, ego).state).toBe("behind");
  });

  it("gets more done each week on the same session", () => {
    const plan = pact().plan[0];
    const early = egoSessionLedger({ date: "2026-11-03", week: 0, session: plan }, PROGRESSION_V1);
    const later = egoSessionLedger({ date: "2027-01-05", week: 9, session: plan }, PROGRESSION_V1);
    expect(later.reps).toBeGreaterThan(early.reps);
  });

  it("leaves today's session open: it trains alongside the climber", () => {
    expect(egoLedger(pact(), "2026-11-03").sessions).toBe(0);
    expect(egoLedger(pact(), "2026-11-04").sessions).toBe(1);
  });
});

describe("pause", () => {
  it("freezes the pact clock while paused and shifts it after resuming", () => {
    const paused = pact({ status: "PAUSED", pausedSince: "2026-11-10" });
    expect(pactClock(paused, "2026-11-20")).toBe("2026-11-10");
    const resumed = pact({ pausedDays: pauseLength("2026-11-10", "2026-11-20") });
    expect(resumed.pausedDays).toBe(10);
    expect(pactClock(resumed, "2026-11-21")).toBe("2026-11-11");
  });

  it("stops the ego from training during the pause", () => {
    const paused = pact({ status: "PAUSED", pausedSince: "2026-11-10" });
    expect(egoLedger(paused, pactClock(paused, "2026-12-20"))).toEqual(egoLedger(pact(), "2026-11-10"));
  });
});

describe("standing", () => {
  it("counts only completed work from the start date on", () => {
    const you = climberLedger([
      work("2026-11-01", 50), work("2026-11-03", 30),
      { ...work("2026-11-05", 99), status: "INTERRUPTED" },
    ], "2026-11-02");
    expect(you).toEqual({ sessions: 1, reps: 30, minutes: 40 });
  });

  it("reads sessions first, then reps", () => {
    const base = { sessions: 2, reps: 100, minutes: 90 };
    expect(standing({ ...base, sessions: 3, reps: 10 }, base).state).toBe("ahead");
    expect(standing({ ...base, reps: 120 }, base).state).toBe("ahead");
    expect(standing({ ...base, reps: 80 }, base).state).toBe("behind");
    expect(standing(base, base)).toMatchObject({ state: "level", gap: { sessions: 0, reps: 0, minutes: 0 } });
  });

  it("switches the race off after reported pain until a later session clears it", () => {
    expect(shouldEaseOff([work("2026-11-03", 10, 1), work("2026-11-05", 10, 3)])).toBe(true);
    expect(shouldEaseOff([work("2026-11-05", 10, 4), work("2026-11-07", 10, 0)])).toBe(false);
    expect(shouldEaseOff([])).toBe(false);
  });
});

describe("chosen pace", () => {
  it("runs from the start grade to the goal, without converting boulder and route", () => {
    expect(boulderPace(pact(), 0)).toBe("6A");
    expect(boulderPace(pact(), 12)).toBe("7A");
    expect(routePace(pact(), 0)).toBe("6a");
    expect(routePace(pact(), 12)).toBe("6c");
  });

  it("has nothing to say without grades, or with a goal under the start", () => {
    expect(boulderPace(pact({ startBoulderGrade: null }), 3)).toBeNull();
    expect(boulderPace(pact({ startBoulderGrade: "7A", targetBoulderGrade: "6A" }), 3)).toBeNull();
    expect(routePace(pact({ targetRouteGrade: null }), 3)).toBeNull();
  });
});

describe("pact dates", () => {
  it("numbers weeks from the Monday of the start week and ends after the horizon", () => {
    const p = pact({ startDate: "2026-11-04", horizonWeeks: 2 });
    expect(pactWeek(p, "2026-11-04")).toBe(0);
    expect(pactWeek(p, "2026-11-09")).toBe(1);
    expect(pactIsOver(p, "2026-11-15")).toBe(false);
    expect(pactIsOver(p, "2026-11-16")).toBe(true);
  });
});

describe("what Patrick receives", () => {
  it("is the computed gap and nothing else", () => {
    const s = standing({ sessions: 1, reps: 20, minutes: 40 }, { sessions: 2, reps: 50, minutes: 90 });
    expect(coachSummary(pact(), "2026-11-10", s, false)).toEqual({
      name: "Patrick bis", status: "ACTIVE", week: 2, horizonWeeks: 12,
      sessionsGap: -1, repsGap: -30, minutesGap: -50, state: "behind", easeOff: false,
    });
  });
});

describe("pact changes", () => {
  it("pauses an active pact and adds the days when it resumes", () => {
    expect(pactTransition(pact(), "pause", "2026-11-10")).toEqual({ status: "PAUSED", paused_since: "2026-11-10", paused_days: 0 });
    expect(pactTransition(pact({ status: "PAUSED", pausedSince: "2026-11-10", pausedDays: 2 }), "resume", "2026-11-15"))
      .toEqual({ status: "ACTIVE", paused_since: null, paused_days: 7 });
  });

  it("refuses what does not apply", () => {
    expect(pactTransition(pact(), "resume", "2026-11-10")).toBeNull();
    expect(pactTransition(pact({ status: "PAUSED", pausedSince: "2026-11-10" }), "pause", "2026-11-11")).toBeNull();
    expect(pactTransition(pact({ status: "ABANDONED" }), "abandon", "2026-11-11")).toBeNull();
    expect(pactTransition(pact(), "finish", "2026-11-11")).toBeNull();
  });

  it("closes a pact once its weeks are over, or whenever the climber leaves", () => {
    expect(pactTransition(pact({ horizonWeeks: 1 }), "finish", "2026-11-09")?.status).toBe("FINISHED");
    expect(pactTransition(pact({ status: "PAUSED", pausedSince: "2026-11-10" }), "abandon", "2026-11-12"))
      .toEqual({ status: "ABANDONED", paused_since: null, paused_days: 2 });
  });
});

describe("a pact's progress", () => {
  it("brings the score, the week, the next session and the chosen pace together", () => {
    const p = pactProgress(pact(), [work("2026-11-03", 20)], "2026-11-10");
    expect(p.week).toBe(1);
    expect(p.over).toBe(false);
    expect(p.standing.you.sessions).toBe(1);
    expect(p.standing.ego.sessions).toBe(2);
    expect(p.next?.date).toBe("2026-11-10");
    expect(p.boulderPace).not.toBeNull();
  });

  it("gives real dates after a pause", () => {
    const p = pactProgress(pact({ pausedDays: 7 }), [], "2026-11-17");
    expect(p.next?.date).toBe("2026-11-17");
  });
});

describe("signing", () => {
  const input = {
    displayName: "Mon double", planId: "e3000000-0000-4000-8000-00000000000a", startDate: "2026-11-02", horizonWeeks: 12,
    startBoulderGrade: "6A", targetBoulderGrade: "7A", startRouteGrade: "6a", targetRouteGrade: null,
  };

  it("takes a start and a goal together, in order", () => {
    expect(signPactSchema.safeParse({ ...input, startRouteGrade: null }).success).toBe(true);
    expect(signPactSchema.safeParse(input).success).toBe(false);
    expect(signPactSchema.safeParse({ ...input, startRouteGrade: null, targetBoulderGrade: "5A" }).success).toBe(false);
  });

  it("refuses unknown grades and an empty name", () => {
    expect(signPactSchema.safeParse({ ...input, startRouteGrade: null, startBoulderGrade: "V5" }).success).toBe(false);
    expect(signPactSchema.safeParse({ ...input, startRouteGrade: null, displayName: "  " }).success).toBe(false);
  });
});

describe("stored pacts", () => {
  const row: PactRow = {
    id: "p", display_name: "Double", plan_name: "Plan", plan_snapshot: pact().plan, progression: PROGRESSION_V1,
    start_date: "2026-11-02", horizon_weeks: 12, status: "ACTIVE", paused_since: null, paused_days: 0,
    start_boulder_grade: "6A", target_boulder_grade: "7A", start_route_grade: null, target_route_grade: null,
  };

  it("reads the signed terms back", () => {
    expect(pactFromRow(row)).toMatchObject({ displayName: "Double", horizonWeeks: 12, plan: pact().plan });
  });

  it("ignores a pact whose plan no longer parses, and keeps the default progression if that one does not", () => {
    expect(pactFromRow({ ...row, plan_snapshot: [{ day: 9 }] })).toBeNull();
    expect(pactFromRow({ ...row, progression: {} })?.progression).toEqual(PROGRESSION_V1);
  });
});
