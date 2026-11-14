import { describe, expect, it } from "vitest";
import type { ClimberWork, Pact } from "@/lib/analytics/alter-ego";
import {
  RIVAL_DEFAULTS, duelRace, levelLedger, raceMargin, rivalBoulderGrade, rivalFeed, rivalSettingsFromRow, rivalStanding, seeded, weeklyDuels,
} from "@/lib/analytics/rival";
import { PROGRESSION_V1 } from "@/lib/analytics/alter-ego";

const pact: Pact = {
  id: "11111111-1111-4111-8111-111111111111", displayName: "Max", planName: "Plan",
  plan: [{ day: 1, methodId: "technique", minutes: 60, notes: "" }, { day: 3, methodId: "technique", minutes: 60, notes: "" }],
  progression: PROGRESSION_V1, startDate: "2026-11-02", horizonWeeks: 8, status: "ACTIVE", pausedSince: null, pausedDays: 0,
  startBoulderGrade: "6A", targetBoulderGrade: "6C", startRouteGrade: null, targetRouteGrade: null,
};
const done = (date: string, minutes = 60, pain: number | null = null): ClimberWork => ({ status: "COMPLETED", date, actualMinutes: minutes, pain, reps: 0 });
const weekdays = ["lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi", "dimanche"];

describe("rival settings", () => {
  it("uses the approved defaults: sharp, within reach, may chase projects", () => {
    expect(rivalSettingsFromRow({})).toEqual(RIVAL_DEFAULTS);
    expect(RIVAL_DEFAULTS).toMatchObject({ tone: "PIQUANT", level: "REACH", chaseProjects: true });
  });
  it("falls back to within reach when the goal level has no date", () => {
    expect(rivalSettingsFromRow({ level: "GOAL" }).level).toBe("REACH");
    expect(rivalSettingsFromRow({ level: "GOAL", goal_date: "2027-03-01" }).level).toBe("GOAL");
  });
});

describe("rival levels", () => {
  it("within reach stays at most one séance and 10 % ahead, and never above the programme", () => {
    expect(levelLedger("REACH", { sessions: 6, reps: 100, minutes: 360 }, { sessions: 2, reps: 50, minutes: 100 }))
      .toEqual({ sessions: 3, reps: 55, minutes: 110 });
    expect(levelLedger("REACH", { sessions: 2, reps: 0, minutes: 120 }, { sessions: 5, reps: 0, minutes: 300 }))
      .toEqual({ sessions: 2, reps: 0, minutes: 120 });
    expect(levelLedger("RELENTLESS", { sessions: 6, reps: 0, minutes: 360 }, { sessions: 0, reps: 0, minutes: 0 }).sessions).toBe(6);
  });

  it("can always be caught within reach", () => {
    const s = rivalStanding(pact, { level: "REACH" }, [], "2026-11-20");
    expect(s.ego.sessions).toBe(1);
    expect(rivalStanding(pact, { level: "RELENTLESS" }, [], "2026-11-20").ego.sessions).toBeGreaterThan(1);
  });

  it("the goal level climbs at the pace that reaches the goal grade on its date", () => {
    expect(rivalBoulderGrade(pact, { level: "GOAL", goalDate: "2026-11-30" }, "2026-12-15")).toBe("6C");
    expect(rivalBoulderGrade(pact, { level: "GOAL", goalDate: "2027-06-01" }, "2026-11-03")).toBe("6A");
  });
});

describe("rival feed and duels", () => {
  it("is the same every time it is opened", () => {
    expect(seeded("a")).toBe(seeded("a"));
    const input = { pact, settings: RIVAL_DEFAULTS, work: [done("2026-11-09")], today: "2026-11-13", projects: ["Toit"], board: null, weekdays };
    expect(rivalFeed(input)).toEqual(rivalFeed(input));
  });

  it("trains on planned days, says so when the climber skipped, and goes after a project", () => {
    // Plan days count from Monday (0): day 1 is Tuesday, day 3 is Thursday.
    const feed = rivalFeed({ pact, settings: RIVAL_DEFAULTS, work: [done("2026-11-10")], today: "2026-11-13", projects: ["Toit"],
      board: { name: "Kilter Board", angle: 40 }, weekdays });
    expect(feed.filter((i) => i.kind === "session").map((i) => i.date)).toEqual(["2026-11-12", "2026-11-10"]);
    const skipped = feed.filter((i) => i.kind === "message" && i.message === "skipped");
    expect(skipped).toEqual([expect.objectContaining({ date: "2026-11-13", vars: { name: "Max", day: "jeudi" } })]);
    expect(feed.some((i) => i.kind === "project")).toBe(true);
    expect(feed.some((i) => i.kind === "send" && i.board?.angle === 40)).toBe(true);
    // Newest first.
    expect(feed.map((i) => i.date + i.time)).toEqual([...feed.map((i) => i.date + i.time)].sort().reverse());
  });

  it("keeps racing after reported pain (the climber decides), and stays silent when paused", () => {
    const feed = rivalFeed({ pact, settings: RIVAL_DEFAULTS, work: [done("2026-11-11", 60, 4)], today: "2026-11-13", projects: [], board: null, weekdays });
    expect(feed.some((i) => i.kind === "session")).toBe(true);
    expect(rivalFeed({ pact: { ...pact, status: "PAUSED" }, settings: RIVAL_DEFAULTS, work: [], today: "2026-11-13", projects: [], board: null, weekdays })).toEqual([]);
  });

  it("does not chase projects when not allowed", () => {
    const feed = rivalFeed({ pact, settings: { ...RIVAL_DEFAULTS, chaseProjects: false }, work: [], today: "2026-11-13", projects: ["Toit"], board: null, weekdays });
    expect(feed.some((i) => i.kind === "project")).toBe(false);
  });

  it("scores each finished week on séances, minutes and reps", () => {
    const duels = weeklyDuels(pact, { level: "RELENTLESS" }, [done("2026-11-02", 90), done("2026-11-04", 90), done("2026-11-06", 90)], "2026-11-17");
    expect(duels).toHaveLength(2);
    expect(duels[0]).toMatchObject({ week: 1, winner: "you" });
    expect(duels[1]).toMatchObject({ week: 2, winner: "rival" });
  });

  it("states the race result in the player", () => {
    expect(raceMargin(1800, 1640)).toBe(160);
    expect(raceMargin(1800, 1900)).toBe(-100);
  });
});

describe("duel race", () => {
  it("adds up séances week by week and stops at today, matching the score card", () => {
    const work = [done("2026-11-03"), done("2026-11-05"), done("2026-11-12")];
    const race = duelRace(pact, { level: "RELENTLESS" }, work, "2026-11-13");
    expect(race.map((r) => r.week)).toEqual([1, 2]);
    expect(race.map((r) => r.you)).toEqual([2, 3]);
    expect(race.at(-1)!.rival).toBe(rivalStanding(pact, { level: "RELENTLESS" }, work, "2026-11-13").ego.sessions);
    expect(race[1].rival).toBeGreaterThanOrEqual(race[0].rival);
  });
});
