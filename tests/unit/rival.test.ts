import { describe, expect, it } from "vitest";
import type { ClimberWork, Pact } from "@/lib/analytics/alter-ego";
import {
  RIVAL_DEFAULTS, RIVAL_MESSAGES, duelRace, recentEndTimes, usualTrainingTime, variantOf, yourDays, levelLedger, raceMargin, rivalBoulderGrade, rivalFeed, rivalSettingsFromRow, rivalStanding, seeded, weeklyDuels,
} from "@/lib/analytics/rival";
import { PROGRESSION_V1 } from "@/lib/analytics/alter-ego";
import { rivalDictionary } from "@/lib/i18n/rival";

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
    // On climbing days it goes for something at its level: sent or not yet.
    expect(feed.filter((i) => i.kind === "send" || i.kind === "attempt").map((i) => i.date).sort()).toEqual(["2026-11-10", "2026-11-12"]);
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

describe("a feed that feels alive", () => {
  const base = { pact, settings: RIVAL_DEFAULTS, today: "2026-11-15", projects: [], board: null, weekdays, days: 7 };
  const msgs = (feed: ReturnType<typeof rivalFeed>) => feed.flatMap((i) => (i.kind === "message" ? [i] : []));

  it("says something every day of the week, plan days or not", () => {
    const feed = rivalFeed({ ...base, work: [done("2026-11-10"), done("2026-11-12")] });
    const daysWithWords = new Set(msgs(feed).map((m) => m.date));
    // A message or a séance on most days; never a whole silent week.
    const active = new Set(feed.map((i) => i.date));
    expect(active.size).toBeGreaterThanOrEqual(5);
    expect(daysWithWords.size).toBeGreaterThanOrEqual(3);
    // After each of its séances it reports back.
    expect(msgs(feed).filter((m) => m.message === "sessionReport" || m.message === "sessionTired" || m.message === "sessionFresh").map((m) => m.date).sort())
      .toEqual(["2026-11-10", "2026-11-12"]);
  });

  it("reports how its séance went from its form", () => {
    const twin = [{ date: "2026-11-10", grade: "6A+", form: "tired" as const }, { date: "2026-11-12", grade: "6A+", form: "fresh" as const }];
    const feed = msgs(rivalFeed({ ...base, work: [], twin }));
    expect(feed.find((m) => m.date === "2026-11-10" && m.message.startsWith("session"))?.message).toBe("sessionTired");
    expect(feed.find((m) => m.date === "2026-11-12" && m.message.startsWith("session"))?.message).toBe("sessionFresh");
  });

  it("reacts the same evening to what the climber logged, and says nothing after reported pain", () => {
    const yours = [
      { date: "2026-11-13", time: "19:40", pain: null, best: "6B", hard: true },
      { date: "2026-11-14", time: "12:00", pain: null, best: null, hard: false },
      { date: "2026-11-11", time: "20:00", pain: 4, best: "6B", hard: true },
    ];
    const feed = msgs(rivalFeed({ ...base, work: [], yours }));
    const send = feed.find((m) => m.message === "sawSend");
    expect(send).toMatchObject({ date: "2026-11-13", vars: { grade: "6B" } });
    expect(send!.time > "19:40").toBe(true);
    expect(feed.some((m) => m.message === "sawSession" && m.date === "2026-11-14")).toBe(true);
    expect(feed.some((m) => m.date === "2026-11-11" && (m.message === "sawSend" || m.message === "sawSession"))).toBe(false);
  });

  it("announces a new grade the day it gets there, and a plateau after four weeks", () => {
    const twin = [
      { date: "2026-11-12", grade: "6A", form: "normal" as const }, { date: "2026-11-13", grade: "6A+", form: "normal" as const },
    ];
    const feed = msgs(rivalFeed({ ...base, work: [], twin, plateauWeeks: 5 }));
    expect(feed.find((m) => m.message === "newGrade")).toMatchObject({ date: "2026-11-13", vars: { grade: "6A+" } });
    expect(feed.find((m) => m.message === "plateau")).toMatchObject({ date: "2026-11-09", vars: { weeks: 5 } });
  });

  it("trains around the climber's usual time", () => {
    expect(usualTrainingTime(["19:30", "20:10", "21:00"])).toBe("19:10");
    expect(usualTrainingTime(["19:30"])).toBeNull();
    const feed = rivalFeed({ ...base, work: [], usualTime: "18:00" });
    for (const s of feed.filter((i) => i.kind === "session")) expect(s.time >= "17:15" && s.time <= "18:45").toBe(true);
  });

  it("never repeats the same wording of a message within as many days as it has wordings", () => {
    const seen = Array.from({ length: 6 }, (_, i) => variantOf("restDay", `2026-11-${String(10 + i).padStart(2, "0")}`, 6));
    expect(new Set(seen).size).toBe(6);
  });

  it("has every message in every tone, in French and English, with several wordings each", () => {
    for (const locale of ["fr", "en"] as const) {
      const r = rivalDictionary(locale);
      for (const tone of ["SYMPA", "PIQUANT", "SANS_PITIE"] as const) {
        for (const m of RIVAL_MESSAGES) expect(r.messages[tone][m].length).toBeGreaterThanOrEqual(4);
      }
    }
  });

  it("reads the climber's days: latest end time, worst pain, hardest send at their level", () => {
    const work: ClimberWork[] = [
      { ...done("2026-11-13"), endedAt: "2026-11-13T17:30:00Z" }, { ...done("2026-11-13", 60, 2), endedAt: "2026-11-13T19:00:00Z" },
    ];
    const days = yourDays(work, new Map([["2026-11-13", "6B"]]), "6A+", "2026-11-09");
    expect(days).toEqual([{ date: "2026-11-13", time: "20:00", pain: 2, best: "6B", hard: true }]);
    expect(yourDays(work, new Map([["2026-11-13", "6A"]]), "6A+", "2026-11-09")[0].hard).toBe(false);
    expect(recentEndTimes(work, "2026-11-15")).toEqual(["18:30", "20:00"]);
  });
});
