import { describe, expect, it } from "vitest";
import { computeSnapshot, summarizeRoutes, type ClimbingDataset } from "@/lib/analytics";
import { buildCoachContext, CONTEXT_CHAR_BUDGET, serializeContext, trainingContext } from "@/lib/coach/context";
import { programmeView } from "@/lib/training/programme";
import { attemptsFor, daysAgo, NOW, problem, session } from "./fixtures";

function dataset(): ClimbingDataset {
  const ark = Array.from({ length: 6 }, () => ({ ...problem("RED"), gymId: "ark", tags: ["slab" as const] }));
  const cd = Array.from({ length: 4 }, () => ({ ...problem("BLUE", "CLIMBING_DISTRICT_COLOR"), gymId: "cd" }));
  return {
    gyms: [
      { id: "ark", name: "Arkose X", brand: "ARKOSE", gradingSystem: "ARKOSE_COLOR" },
      { id: "cd", name: "CD Y", brand: "CLIMBING_DISTRICT", gradingSystem: "CLIMBING_DISTRICT_COLOR" },
    ],
    problems: [...ark, ...cd],
    attempts: [
      ...ark.flatMap((p, i) => attemptsFor(p, i < 4 ? ["ATTEMPT", "TOP"] : ["ATTEMPT"], daysAgo(5), "s1")),
      ...cd.flatMap((p) => attemptsFor(p, ["FLASH"], daysAgo(2), "s2")),
    ],
    sessions: [session("s1", daysAgo(5), 100), session("s2", daysAgo(2), 80)],
  };
}

describe("Patrick context", () => {
  const data = dataset();
  const target = { grade: "7A", system: "FONT" as const };
  const ctx = buildCoachContext({
    climber: { name: "Alex", language: "fr", target },
    snapshot30: computeSnapshot(data, target, NOW, 30),
    snapshot90: computeSnapshot(data, target, NOW, 90),
    recentSessions: [],
    activeProjects: [],
    now: NOW,
  });

  it("carries computed figures with counts, not raw rows", () => {
    expect(ctx.last30Days.sendRate).toEqual({ value: 0.8, count: "8/10" });
    expect(ctx.last30Days).not.toHaveProperty("attemptsList");
    expect(JSON.stringify(ctx)).not.toContain("problemId");
  });

  it("keeps native networks separate and states the normalised coverage", () => {
    expect(ctx.gyms.native.map((n) => n.network)).toEqual(["ARKOSE", "CLIMBING_DISTRICT"]);
    expect(ctx.gyms.normalizedFont.sufficient).toBe(false);
    expect(ctx.gyms.normalizedFont.grades).toEqual([]);
    expect(ctx.gyms.normalizedFont.coverage.none).toBe(10);
  });

  it("states missing data explicitly instead of inventing it", () => {
    expect(ctx.climber.fontWorkingGrade).toBeNull();
    expect(ctx.wearable.latestComparison).toBeNull();
    expect(ctx.focusSession).toBeNull();
    expect(ctx.definitions.workingLevel).toContain("60 days");
  });

  it("stays within the context budget", () => {
    expect(serializeContext(ctx).length).toBeLessThan(CONTEXT_CHAR_BUDGET + 50);
  });
});

describe("grade scales in Patrick's context", () => {
  it("lists only the real grades of the systems in use, easiest first", async () => {
    const { gradeScalesFor } = await import("@/lib/coach/context");
    const scales = gradeScalesFor(["ARKOSE_COLOR", "CLIMBING_DISTRICT_COLOR", "ARKOSE_COLOR"]);
    expect(Object.keys(scales)).toEqual(["ARKOSE_COLOR", "CLIMBING_DISTRICT_COLOR"]);
    expect(scales.ARKOSE_COLOR.ordered).toEqual(["YELLOW", "GREEN", "BLUE", "RED", "BLACK", "PURPLE"]);
    expect(scales.CLIMBING_DISTRICT_COLOR.unranked).toEqual(["PINK"]);
  });
});

describe("Patrick route context", () => {
  const data = dataset();
  const target = { grade: "7A", system: "FONT" as const };
  const route = (grade: string, result: "ONSIGHT" | "REDPOINT" | "TOP_WITH_REST", style: "LEAD" | "TOPROPE" = "LEAD") =>
    ({ id: grade + result + style, sessionId: "r1", grade, style, result, falls: result === "TOP_WITH_REST" ? 2 : 0, createdAt: daysAgo(3) });
  const ascents = [route("6b", "ONSIGHT"), route("6c", "REDPOINT"), route("7a", "TOP_WITH_REST"), route("7a+", "REDPOINT", "TOPROPE")];
  const summary = summarizeRoutes(ascents);
  const ctx = buildCoachContext({
    climber: { name: "Alex", language: "fr", target },
    snapshot30: computeSnapshot(data, target, NOW, 30),
    snapshot90: computeSnapshot(data, target, NOW, 90),
    recentSessions: [], activeProjects: [], now: NOW,
    routeClimbing: { last30: summary, last90: summary, leadWorkingGrade: { grade: null, sampleSize: 4 } },
    focusRouteProject: { name: "Le dièdre", grade: "7a", goalStyle: "LEAD", status: "ACTIVE", gymName: "Climb Up", startedAt: "2026-10-01",
      sentAt: null, notes: "", goes: [{ n: 1, date: "2026-10-10", style: "LEAD", result: "TOP_WITH_REST", falls: 2 }], sessionsCount: 1 },
    activeRouteProjects: [{ name: "Le dièdre", grade: "7a", goalStyle: "LEAD", gymName: "Climb Up", goes: 1 }],
  });

  it("gives route figures with counts, lead kept apart from top-rope", () => {
    expect(ctx.routeClimbing?.last30Days).toMatchObject({ routes: 4, clean: 3, hardestCleanLead: "6c", hardestOnsight: "6b",
      cleanRate: { count: "3/4" }, byStyle: { lead: 3, toprope: 1 } });
    expect(ctx.routeClimbing?.leadWorkingGrade.grade).toBeNull();
  });
  it("lists the French sport scale separately and defines route terms", () => {
    expect(ctx.gradeScales.FRENCH_SPORT_ROUTES?.ordered).toContain("6b+");
    expect(ctx.definitions.routeVsBoulder).toMatch(/Never convert/);
    expect(ctx.focusRouteProject?.goes).toHaveLength(1);
    expect(ctx.activeRouteProjects[0]).toMatchObject({ name: "Le dièdre", goes: 1 });
  });
  it("omits route data entirely for climbers who never logged routes", () => {
    const plain = buildCoachContext({
      climber: { name: "Alex", language: "fr", target },
      snapshot30: computeSnapshot(data, target, NOW, 30), snapshot90: computeSnapshot(data, target, NOW, 90),
      recentSessions: [], activeProjects: [], now: NOW,
    });
    expect(plain.routeClimbing).toBeNull();
    expect(plain.gradeScales).not.toHaveProperty("FRENCH_SPORT_ROUTES");
    expect(serializeContext(plain).length).toBeLessThan(CONTEXT_CHAR_BUDGET + 200);
  });
});

describe("Patrick training context", () => {
  const view = programmeView({
    assessment: {
      id: "a1", methodId: "technique", horizonWeeks: 8, sessionsPerWeek: 3, goal: "Réussir un 7A", startDate: "2026-11-02",
      context: {
        discipline: "BOULDER", experienceMonths: 24, sessionsPerWeekNow: 3, rested24h: false, warmedUp: false, venue: "", notes: "", observed: [],
        injuries: [{ area: "fingers", level: "PAIN" }],
        availability: { climbingPerWeek: 2, offWallPerWeek: 1, homeEquipment: ["pullupBar"] },
      },
    },
    plan: { id: "p1", name: "Programme", sessions: [{ day: 1, methodId: "technique", minutes: 90, place: "BOULDER_GYM", notes: "" }] },
    scheduled: [],
    today: "2026-11-09",
  });

  it("summarises the programme, declared areas and the last daily check-in", () => {
    const t = trainingContext({
      view,
      lastCheck: { date: "2026-11-09", outcome: "TECHNIQUE", reasons: ["pain:fingers"],
        input: { sleep: 2, fatigue: 2, soreness: 1, pain: [{ area: "fingers", level: "PAIN" }], minutes: 60, place: "BOULDER_GYM" } },
      replanSuggested: true,
    });
    expect(t?.programme).toMatchObject({ methodId: "technique", week: 2, horizonWeeks: 8, climbingSessionsPerWeek: 2, offWallSessionsPerWeek: 1 });
    expect(t?.programme?.nextSession).toMatchObject({ date: "2026-11-10", place: "BOULDER_GYM" });
    expect(t?.declaredBodyAreas).toEqual([{ area: "fingers", level: "PAIN" }]);
    expect(t?.lastDailyCheck).toMatchObject({ outcome: "TECHNIQUE", minutesAvailable: 60, pain: [{ area: "fingers", level: "PAIN" }] });
    expect(t?.replanSuggested).toBe(true);
  });

  it("is omitted when there is no programme and no check-in, and stays in budget otherwise", () => {
    expect(trainingContext(null)).toBeNull();
    expect(trainingContext({ view: null, lastCheck: null, replanSuggested: false })).toBeNull();
    const data = dataset();
    const target = { grade: "7A", system: "FONT" as const };
    const ctx = buildCoachContext({
      climber: { name: "Alex", language: "fr", target },
      snapshot30: computeSnapshot(data, target, NOW, 30), snapshot90: computeSnapshot(data, target, NOW, 90),
      recentSessions: [], activeProjects: [], now: NOW,
      training: { view, lastCheck: null, replanSuggested: false },
    });
    expect(ctx.training?.programme?.methodId).toBe("technique");
    expect(ctx.definitions.declaredBodyAreas).toMatch(/NOT a diagnosis/);
    expect(serializeContext(ctx).length).toBeLessThan(CONTEXT_CHAR_BUDGET + 50);
  });
});
