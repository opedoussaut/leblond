import { describe, expect, it } from "vitest";
import {
  doneMobilitySessions, mobilityActivity, mobilityCompass, mobilitySource, nextCheckpoint, nextMobilitySession, type MobilitySessionFact,
} from "@/lib/analytics/mobility-follow-up";

const fact = (id: string, extra: Partial<MobilitySessionFact> = {}): MobilitySessionFact => ({
  id, title: "Séance " + id, methodId: null, enrollmentId: null, status: "COMPLETED", date: "2026-11-20",
  actualMinutes: 30, plannedMinutes: 30, exerciseMethodIds: [], ...extra,
});

describe("mobilitySource", () => {
  it("recognises the three kinds of mobility séance", () => {
    expect(mobilitySource(fact("a", { methodId: "hip-mobility" }))).toBe("HIP");
    expect(mobilitySource(fact("b", { methodId: "mobility-rebuild" }))).toBe("REBUILD");
    expect(mobilitySource(fact("c", { enrollmentId: "e1" }))).toBe("REBUILD");
    // A coach séance has no method of its own; its exercises say it is mobility work.
    expect(mobilitySource(fact("d", { exerciseMethodIds: ["mobility", "mobility", null] }))).toBe("LIBRARY");
    expect(mobilitySource(fact("e", { methodId: "mobility" }))).toBe("LIBRARY");
  });

  it("leaves other training out", () => {
    expect(mobilitySource(fact("f", { methodId: "max-hangs" }))).toBeNull();
    expect(mobilitySource(fact("g", { exerciseMethodIds: ["max-hangs", "max-hangs", "mobility"] }))).toBeNull();
    expect(mobilitySource(fact("h"))).toBeNull();
  });
});

describe("doneMobilitySessions", () => {
  const facts = [
    fact("hip", { methodId: "hip-mobility", date: "2026-11-10" }),
    fact("coach", { exerciseMethodIds: ["mobility"], date: "2026-11-18", actualMinutes: null, plannedMinutes: 45 }),
    fact("coach", { exerciseMethodIds: ["mobility"], date: "2026-11-18" }), // returned twice
    fact("rebuild", { methodId: "mobility-rebuild", enrollmentId: "e1", date: "2026-11-21", status: "INTERRUPTED", actualMinutes: 12 }),
    fact("planned", { methodId: "hip-mobility", status: "PLANNED", date: "2026-11-25" }),
    fact("hangs", { methodId: "max-hangs" }),
  ];

  it("counts every source once, newest first, completed and interrupted only", () => {
    const done = doneMobilitySessions(facts, "2026-11-22");
    expect(done.map((s) => s.id)).toEqual(["rebuild", "coach", "hip"]);
    expect(done.map((s) => s.source)).toEqual(["REBUILD", "LIBRARY", "HIP"]);
    expect(done[0].status).toBe("INTERRUPTED");
  });

  it("marks planned minutes as planned, never as recorded", () => {
    const coach = doneMobilitySessions(facts, "2026-11-22").find((s) => s.id === "coach")!;
    expect(coach).toMatchObject({ minutes: 45, minutesPlanned: true });
    const none = doneMobilitySessions([fact("x", { methodId: "hip-mobility", actualMinutes: null, plannedMinutes: null })], "2026-11-22");
    expect(none[0]).toMatchObject({ minutes: null, minutesPlanned: false });
  });

  it("ignores séances dated after today", () => {
    expect(doneMobilitySessions([fact("f", { methodId: "hip-mobility", date: "2026-11-30" })], "2026-11-22")).toEqual([]);
  });
});

describe("nextMobilitySession", () => {
  it("prefers the séance in progress, then the soonest planned one from today", () => {
    const list = [
      fact("old", { methodId: "hip-mobility", status: "PLANNED", date: "2026-11-01" }),
      fact("later", { methodId: "mobility-rebuild", status: "PLANNED", date: "2026-11-28" }),
      fact("soon", { exerciseMethodIds: ["mobility"], status: "PLANNED", date: "2026-11-24" }),
    ];
    expect(nextMobilitySession(list, "2026-11-22")?.id).toBe("soon");
    expect(nextMobilitySession([...list, fact("live", { methodId: "hip-mobility", status: "IN_PROGRESS", date: "2026-11-20" })], "2026-11-22"))
      .toMatchObject({ id: "live", inProgress: true });
    expect(nextMobilitySession([fact("hangs", { methodId: "max-hangs", status: "PLANNED", date: "2026-11-24" })], "2026-11-22")).toBeNull();
  });
});

describe("mobilityActivity", () => {
  const done = doneMobilitySessions([
    fact("1", { methodId: "hip-mobility", date: "2026-11-02" }),
    fact("2", { methodId: "hip-mobility", date: "2026-11-09" }),
    fact("3", { methodId: "hip-mobility", date: "2026-11-12" }),
    fact("4", { methodId: "hip-mobility", date: "2026-11-17", actualMinutes: 20 }),
    fact("5", { methodId: "hip-mobility", date: "2026-11-20", actualMinutes: 25 }),
  ], "2026-11-22");

  it("counts this week, the last 28 days and in total", () => {
    // 2026-11-22 is a Sunday: the week started on Monday 17.
    const a = mobilityActivity(done, "2026-11-22");
    expect(a).toMatchObject({ total: 5, thisWeek: 2, minutesThisWeek: 45, last28: 5, lastDate: "2026-11-20" });
    expect(a.weeks).toHaveLength(8);
    expect(a.weeks.at(-1)).toEqual({ start: "2026-11-16", sessions: 2 });
  });

  it("counts weeks in a row; an empty current week does not break the streak yet", () => {
    expect(mobilityActivity(done, "2026-11-22").streakWeeks).toBe(3);
    expect(mobilityActivity(done, "2026-11-24").streakWeeks).toBe(3);
    expect(mobilityActivity(done, "2026-12-01").streakWeeks).toBe(0);
    expect(mobilityActivity([], "2026-11-22")).toMatchObject({ total: 0, streakWeeks: 0, lastDate: null });
  });
});

describe("nextCheckpoint", () => {
  // Starting on Tuesday 24 Nov: S4 opens 21 Dec, S8 18 Jan, S12 15 Feb.
  it("gives the next reassessment not yet done", () => {
    expect(nextCheckpoint("2026-11-24", ["2026-11-21"], "2026-11-22")).toEqual({ key: "S4", from: "2026-12-21", due: false, daysLeft: 29 });
    expect(nextCheckpoint("2026-11-24", ["2026-11-21"], "2026-12-23")).toMatchObject({ key: "S4", due: true, daysLeft: 0 });
    expect(nextCheckpoint("2026-11-24", ["2026-11-21", "2026-12-22"], "2026-12-23")).toMatchObject({ key: "S8", from: "2027-01-18" });
    expect(nextCheckpoint("2026-11-24", ["2027-02-16"], "2027-02-20")).toBeNull();
  });

  it("has no checkpoint without the programme", () => {
    expect(nextCheckpoint(null, [], "2026-11-22")).toBeNull();
  });
});

describe("mobilityCompass", () => {
  const view = { assessed: true, next: 1 as const, nextMetCount: 1, nextCounted: 3, nextBlockers: ["A", "C"] as ("A" | "C")[] };

  it("answers where I am and what I aim for from the latest assessment", () => {
    const c = mobilityCompass({
      latestAssessment: { stage: 0, date: "2026-11-12" }, view,
      bilans: [{ startedOn: "2026-11-21", status: "STOPPED" }, { startedOn: "2026-11-23", status: "IN_PROGRESS" }],
      rebuildStartedOn: "2026-11-24", today: "2026-11-22",
    });
    expect(c.where).toEqual({ stage: 0, date: "2026-11-12" });
    expect(c.lastBilan).toEqual({ date: "2026-11-21", stopped: true });
    expect(c.goal).toEqual({ stage: 1, met: 1, counted: 3, blockers: ["A", "C"] });
    expect(c.atTop).toBe(false);
    expect(c.checkpoint?.key).toBe("S4");
  });

  it("invents nothing when nothing was measured", () => {
    const c = mobilityCompass({
      latestAssessment: null, view: { ...view, assessed: false }, bilans: [], rebuildStartedOn: null, today: "2026-11-22",
    });
    expect(c).toEqual({ where: null, lastBilan: null, goal: null, atTop: false, checkpoint: null });
  });

  it("says when the top level is reached instead of a goal", () => {
    const c = mobilityCompass({
      latestAssessment: { stage: 4, date: "2026-11-12" }, view: { ...view, next: null }, bilans: [], rebuildStartedOn: null, today: "2026-11-22",
    });
    expect(c.goal).toBeNull();
    expect(c.atTop).toBe(true);
  });
});
