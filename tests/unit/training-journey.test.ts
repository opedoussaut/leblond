import { describe, expect, it } from "vitest";
import { PROTOCOL_TESTS, assessmentContextSchema, parseContext, testStatus } from "@/lib/training/assessment-protocol";
import { recommendToday, painDefaults, type DayCheckInput, type DayContext } from "@/lib/training/day-check";
import { healthFromContext, loadVerdict, methodVerdict, restrictionsOf, testVerdict, type Health } from "@/lib/training/health";
import { planSessionSchema, trainingPlanSchema, type PlanSession } from "@/lib/training/plans";
import {
  methodSuggestions, programmeView, proposeProgramme, replanSignal, weekdayOf, type ProgrammeAssessment,
} from "@/lib/training/programme";
import { DEFAULT_SKILLS } from "@/lib/training/assessment";

const shoulder: Health = { injuries: [{ area: "shoulder", level: "DISCOMFORT" }], unspecifiedPain: false };
const test = (id: string) => PROTOCOL_TESTS.find((t) => t.id === id)!;

describe("health: areas and levels instead of yes/no", () => {
  it("applies the rule table per load and level", () => {
    const heavy = { shoulder: 3 } as const, moderate = { shoulder: 2 } as const, light = { shoulder: 1 } as const;
    const at = (level: "DISCOMFORT" | "PAIN" | "ACUTE") => [{ area: "shoulder" as const, level }];
    expect(loadVerdict(light, at("DISCOMFORT"), false).status).toBe("ok");
    expect(loadVerdict(moderate, at("DISCOMFORT"), false).status).toBe("adapt");
    expect(loadVerdict(heavy, at("DISCOMFORT"), false).status).toBe("adapt");
    expect(loadVerdict(heavy, at("DISCOMFORT"), true).status).toBe("avoid");
    expect(loadVerdict(light, at("PAIN"), false).status).toBe("adapt");
    expect(loadVerdict(moderate, at("PAIN"), false).status).toBe("avoid");
    expect(loadVerdict(light, at("ACUTE"), false).status).toBe("avoid");
    expect(loadVerdict({ knee: 3 }, at("ACUTE"), true).status).toBe("ok");
  });
  it("only disables the tests that load the declared area, and says why", () => {
    const ctx = { experienceMonths: 36, warmedUp: true, injuries: shoulder.injuries };
    expect(testStatus(test("pull-ups"), ctx)).toMatchObject({ allowed: false, blockedBy: "health" });
    expect(testStatus(test("pull-ups"), ctx).verdict.because[0]).toMatchObject({ area: "shoulder", level: "DISCOMFORT", load: 3 });
    expect(testStatus(test("hang-20mm"), ctx)).toMatchObject({ allowed: true, verdict: { status: "adapt" } });
    expect(testStatus(test("continuous-climb"), ctx)).toMatchObject({ allowed: true, verdict: { status: "ok" } });
    // A knee problem leaves the finger and pulling tests alone.
    const knee = { experienceMonths: 36, warmedUp: true, injuries: [{ area: "knee" as const, level: "PAIN" as const }] };
    expect(testStatus(test("hang-20mm"), knee).allowed).toBe(true);
    expect(testStatus(test("pull-ups"), knee).allowed).toBe(true);
    expect(testStatus(test("quiet-feet"), knee).verdict.status).toBe("adapt");
  });
  it("reports the most important blocker first", () => {
    expect(testStatus(test("hang-20mm"), { experienceMonths: 6, warmedUp: false }).blockedBy).toBe("experience");
    expect(testStatus(test("hang-20mm"), { experienceMonths: 36, warmedUp: false }).blockedBy).toBe("warmup");
    expect(testStatus(test("hang-20mm"), { experienceMonths: 6, warmedUp: true, injuries: [{ area: "fingers", level: "PAIN" }] }).blockedBy).toBe("health");
  });
  it("keeps legacy yes/no pain as unlocalised pain with the old, cautious restrictions", () => {
    const legacy = healthFromContext({ currentPain: true });
    expect(legacy).toEqual({ injuries: [], unspecifiedPain: true });
    expect(restrictionsOf(legacy).map((i) => i.area)).toEqual(["fingers", "elbow", "shoulder"]);
    expect(testVerdict("hang-20mm", legacy).status).toBe("avoid");
    expect(testVerdict("pull-ups", legacy).status).toBe("avoid");
    expect(testVerdict("quiet-feet", legacy).status).toBe("adapt");
    expect(healthFromContext({ currentPain: false })).toEqual({ injuries: [], unspecifiedPain: false });
    expect(healthFromContext(null)).toEqual({ injuries: [], unspecifiedPain: false });
  });
  it("adapts methods to a shoulder discomfort instead of banning all training", () => {
    expect(methodVerdict("technique", shoulder).status).toBe("ok");
    expect(methodVerdict("strength-conditioning", shoulder).status).toBe("adapt");
    expect(methodVerdict("limit-bouldering", shoulder).status).toBe("avoid");
    expect(methodVerdict("campus", shoulder).status).toBe("avoid");
    expect(methodVerdict(null, shoulder).status).toBe("ok");
  });
});

describe("assessment context: legacy rows keep parsing", () => {
  const legacy = {
    discipline: "BOULDER", experienceMonths: 36, sessionsPerWeekNow: 2, currentPain: false, rested24h: true, warmedUp: true,
    venue: "Salle", notes: "", observed: [],
  };
  it("parses a v2 context (currentPain yes/no, strict)", () => {
    expect(parseContext(legacy)).not.toBeNull();
    expect(parseContext({ ...legacy, unexpected: 1 })).toBeNull();
  });
  it("parses a v3 context with areas, availability and the test day", () => {
    const { currentPain: _drop, ...rest } = legacy;
    void _drop;
    const v3 = {
      ...rest, discipline: "BOTH", testDay: false,
      injuries: [{ area: "shoulder", level: "DISCOMFORT" }],
      availability: { climbingPerWeek: 3, offWallPerWeek: 2, homeEquipment: ["hangboard", "pullupBar"] },
    };
    expect(assessmentContextSchema.safeParse(v3).success).toBe(true);
    expect(assessmentContextSchema.safeParse({ ...v3, injuries: [{ area: "shoulder", level: "PAIN" }, { area: "shoulder", level: "ACUTE" }] }).success).toBe(false);
    expect(assessmentContextSchema.safeParse({ ...v3, injuries: [{ area: "ear", level: "PAIN" }] }).success).toBe(false);
  });
});

describe("plans: off-wall and mobility sessions", () => {
  it("keeps old plan sessions valid and accepts place/title/mobility", () => {
    expect(planSessionSchema.safeParse({ day: 1, methodId: "technique", minutes: 60, notes: "" }).success).toBe(true);
    expect(planSessionSchema.safeParse({ day: 2, methodId: null, minutes: 30, notes: "", place: "HOME", title: "Mobilité" }).success).toBe(true);
    expect(planSessionSchema.safeParse({ day: 2, methodId: null, minutes: 30, notes: "" }).success).toBe(false);
    expect(planSessionSchema.safeParse({ day: 2, methodId: "made-up", minutes: 30, notes: "" }).success).toBe(false);
  });
});

describe("programme proposal", () => {
  const base = {
    methodId: "limit-bouldering", discipline: "BOULDER" as const, experienceMonths: 36, locale: "fr" as const,
    availability: { climbingPerWeek: 3, offWallPerWeek: 2, homeEquipment: ["hangboard", "pullupBar"] as ("hangboard" | "pullupBar")[] },
  };
  it("uses climbing and off-wall sessions, on separate days, and stays a valid plan", () => {
    const sessions = proposeProgramme({ ...base, health: { injuries: [], unspecifiedPain: false } });
    expect(sessions.filter((s) => s.place === "HOME")).toHaveLength(2);
    expect(sessions.filter((s) => s.place === "BOULDER_GYM")).toHaveLength(3);
    expect(sessions[0].methodId).toBe("limit-bouldering");
    expect(new Set(sessions.map((s) => s.day)).size).toBe(5);
    expect(trainingPlanSchema.safeParse({ name: "P", goal: "", weeks: 8, sessions }).success).toBe(true);
  });
  it("replaces methods that load an injured area and notes reduced load", () => {
    const sessions = proposeProgramme({ ...base, health: shoulder });
    expect(sessions.some((s) => s.methodId === "limit-bouldering")).toBe(false);
    expect(sessions.find((s) => s.place === "BOULDER_GYM")!.notes).toMatch(/Remplace « Limit bouldering »/);
    const home = sessions.filter((s) => s.place === "HOME");
    expect(home.at(-1)).toMatchObject({ methodId: null, title: "Mobilité et gainage doux" });
    expect(home.some((s) => /Charge réduite \(épaule\)/.test(s.notes))).toBe(true);
  });
  it("routes and both disciplines get route-gym sessions", () => {
    const route = proposeProgramme({ ...base, methodId: "four-by-four", discipline: "ROUTE", health: { injuries: [], unspecifiedPain: false } });
    expect(route.filter((s) => s.place !== "HOME").every((s) => s.place === "ROUTE_GYM")).toBe(true);
    const both = proposeProgramme({ ...base, discipline: "BOTH", health: { injuries: [], unspecifiedPain: false } });
    expect(new Set(both.filter((s) => s.place !== "HOME").map((s) => s.place))).toEqual(new Set(["BOULDER_GYM", "ROUTE_GYM"]));
  });
  it("falls back to mobility at home without equipment", () => {
    const sessions = proposeProgramme({ ...base, availability: { climbingPerWeek: 0, offWallPerWeek: 1, homeEquipment: [] }, health: { injuries: [], unspecifiedPain: false } });
    expect(sessions).toEqual([expect.objectContaining({ methodId: null, place: "HOME" })]);
  });
  it("suggests methods filtered by health", () => {
    const low = { ...DEFAULT_SKILLS, power: 1, fingers: 1.5 };
    const { suggested, setAside } = methodSuggestions(low, shoulder);
    expect(suggested.every((s) => s.verdict.status !== "avoid")).toBe(true);
    expect(setAside.map((s) => s.method.id)).toContain("campus");
  });
});

describe("programme in progress", () => {
  const assessment: ProgrammeAssessment = {
    id: "a", methodId: "technique", horizonWeeks: 8, sessionsPerWeek: 3, goal: "7A", startDate: "2026-11-02", context: null,
  };
  const plan = { id: "p", name: "P", sessions: [
    { day: 1, methodId: "technique", minutes: 90, notes: "", place: "BOULDER_GYM" },
    { day: 4, methodId: null, minutes: 30, notes: "", place: "HOME", title: "Mobilité" },
  ] satisfies PlanSession[] };
  it("gives week X of N, the next template session and the reassessment date", () => {
    const view = programmeView({ assessment, plan, scheduled: [], today: "2026-11-12" }); // Thursday
    expect(view.week).toBe(2);
    expect(view.finished).toBe(false);
    expect(view.next).toMatchObject({ date: "2026-11-13", title: "Mobilité", source: "template" });
    expect(view.nextReassessment).toBe("2026-11-30");
    expect(view.availability).toEqual({ climbingPerWeek: 3, offWallPerWeek: 0, homeEquipment: [] });
  });
  it("prefers an earlier scheduled session and ends with the programme", () => {
    const scheduled = [{ id: "s", title: "Max hangs", methodId: "max-hangs", date: "2026-11-12", minutes: 60 }];
    expect(programmeView({ assessment, plan, scheduled, today: "2026-11-12" }).next).toMatchObject({ source: "scheduled", sessionId: "s" });
    const done = programmeView({ assessment, plan, scheduled: [], today: "2027-01-05" });
    expect(done).toMatchObject({ finished: true, week: 8, next: null, reassessmentDue: true });
  });
  it("works for a legacy assessment without a weekly template", () => {
    expect(programmeView({ assessment, plan: null, scheduled: [], today: "2026-11-02" })).toMatchObject({ week: 1, next: null, plan: null });
  });
});

describe("daily check-in", () => {
  const plan: PlanSession[] = [
    { day: 0, methodId: "limit-bouldering", minutes: 90, notes: "", place: "BOULDER_GYM" },
    { day: 2, methodId: "strength-conditioning", minutes: 45, notes: "", place: "HOME" },
    { day: 4, methodId: "technique", minutes: 90, notes: "", place: "BOULDER_GYM" },
  ];
  const monday = "2026-11-09";
  const ctx: DayContext = { today: monday, discipline: "BOULDER", plan, scheduledToday: null };
  const fresh: DayCheckInput = { sleep: 3, fatigue: 1, soreness: 0, pain: [], minutes: 120, place: "BOULDER_GYM" };
  it("keeps the planned session when everything is fine", () => {
    expect(weekdayOf(monday)).toBe(0);
    expect(recommendToday(fresh, ctx)).toMatchObject({ outcome: "AS_PLANNED", methodId: "limit-bouldering", minutes: 90, reasons: ["today"] });
  });
  it("rests on acute pain", () => {
    expect(recommendToday({ ...fresh, pain: [{ area: "knee", level: "ACUTE" }] }, ctx)).toMatchObject({ outcome: "REST", minutes: 0, reasons: ["acute:knee"] });
  });
  it("swaps a limit session for technique with a shoulder issue, and lightens adapted work", () => {
    const r = recommendToday({ ...fresh, pain: [{ area: "shoulder", level: "DISCOMFORT" }] }, ctx);
    expect(r).toMatchObject({ outcome: "TECHNIQUE", methodId: "technique", reasons: ["today", "pain:shoulder"] });
    const home = recommendToday({ ...fresh, place: "HOME", pain: [{ area: "shoulder", level: "DISCOMFORT" }] }, { ...ctx, today: "2026-11-11" });
    expect(home).toMatchObject({ outcome: "REDUCED", methodId: "strength-conditioning", minutes: 35 });
  });
  it("swaps intense work for technique when run down, and mobility when very tired", () => {
    expect(recommendToday({ ...fresh, sleep: 1 }, ctx)).toMatchObject({ outcome: "TECHNIQUE", methodId: "technique" });
    expect(recommendToday({ ...fresh, sleep: 1, fatigue: 3 }, ctx)).toMatchObject({ outcome: "MOBILITY", methodId: null, minutes: 30 });
    expect(recommendToday({ ...fresh, soreness: 2 }, { ...ctx, today: "2026-11-13" })).toMatchObject({ outcome: "REDUCED", methodId: "technique", minutes: 70 });
  });
  it("pulls the next session of the week forward when today has none for this place", () => {
    expect(recommendToday(fresh, { ...ctx, today: "2026-11-10" })).toMatchObject({ methodId: "technique", reasons: ["pulledForward"] });
  });
  it("shortens the session when time is short, and handles no climbing", () => {
    expect(recommendToday({ ...fresh, minutes: 60 }, ctx)).toMatchObject({ outcome: "REDUCED", minutes: 60, reasons: ["today", "lessTime"] });
    expect(recommendToday({ ...fresh, minutes: 10 }, ctx)).toMatchObject({ outcome: "MOBILITY", minutes: 10 });
    expect(recommendToday({ ...fresh, place: "NONE", minutes: 30 }, ctx)).toMatchObject({ outcome: "MOBILITY", minutes: 20 });
    expect(recommendToday({ ...fresh, place: "NONE", minutes: 0 }, ctx)).toMatchObject({ outcome: "REST" });
  });
  it("uses a scheduled session first and defaults sensibly without programme", () => {
    const scheduledToday = { id: "s1", title: "4×4", methodId: "four-by-four", date: monday, minutes: 75 };
    expect(recommendToday(fresh, { ...ctx, scheduledToday })).toMatchObject({ methodId: "four-by-four", planned: { sessionId: "s1" } });
    expect(recommendToday({ ...fresh, place: "ROUTE_GYM" }, { ...ctx, plan: null })).toMatchObject({ methodId: "easy-volume", reasons: ["noProgramme"] });
    expect(recommendToday({ ...fresh, place: "HOME" }, { ...ctx, plan: null })).toMatchObject({ outcome: "MOBILITY" });
  });
  it("pre-fills today's pain from the programme, without acute entries", () => {
    expect(painDefaults({ injuries: [{ area: "shoulder", level: "DISCOMFORT" }, { area: "knee", level: "ACUTE" }], unspecifiedPain: false }))
      .toEqual([{ area: "shoulder", level: "DISCOMFORT" }]);
  });
});

describe("re-adjust the plan", () => {
  const check = (date: string, outcome: "AS_PLANNED" | "REDUCED" | "TECHNIQUE" | "REST", reasons: string[], pain: { area: "shoulder"; level: "PAIN" | "ACUTE" }[] = []) =>
    ({ date, outcome, reasons, pain });
  it("stays quiet for time or place changes", () => {
    const checks = [check("2026-11-05", "REDUCED", ["lessTime"]), check("2026-11-06", "REDUCED", ["lessTime"]), check("2026-11-07", "REDUCED", ["lessTime"])];
    expect(replanSignal(checks, "2026-11-09").suggested).toBe(false);
  });
  it("suggests re-adjusting after repeated pain or fatigue, or acute pain", () => {
    const repeated = [check("2026-11-05", "TECHNIQUE", ["today", "tired"]), check("2026-11-06", "REDUCED", ["painAdapt:shoulder"]), check("2026-11-08", "TECHNIQUE", ["pain:shoulder"])];
    expect(replanSignal(repeated, "2026-11-09")).toMatchObject({ suggested: true, flagged: 3 });
    expect(replanSignal(repeated, "2026-11-20").suggested).toBe(false);
    const sameArea = [1, 2, 3].map((d) => check(`2026-11-0${d}`, "AS_PLANNED", [], [{ area: "shoulder", level: "PAIN" }]));
    expect(replanSignal(sameArea, "2026-11-05")).toMatchObject({ suggested: true, areas: ["shoulder"] });
    expect(replanSignal([check("2026-11-09", "REST", ["acute:shoulder"], [{ area: "shoulder", level: "ACUTE" }])], "2026-11-09")).toMatchObject({ suggested: true, acute: true });
  });
});
