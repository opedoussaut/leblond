import { describe, expect, it } from "vitest";
import { routeWorkingGrade, summarizeRoutes, type RouteAscentFact } from "@/lib/analytics/routes";
import { logRouteAscentSchema, routeKey } from "@/lib/climbing/routes";

const NOW = new Date("2026-10-21T12:00:00Z");
let n = 0;
const a = (grade: string, result: RouteAscentFact["result"], style: RouteAscentFact["style"] = "LEAD", daysAgo = 1): RouteAscentFact =>
  ({ id: String(++n), sessionId: "s", grade, style, result, falls: null, createdAt: new Date(NOW.getTime() - daysAgo * 86_400_000) });

describe("route summaries", () => {
  it("separates clean ascents, styles and grades without touching boulder data", () => {
    const s = summarizeRoutes([
      a("6a", "ONSIGHT"), a("6b", "REDPOINT"), a("6c", "TOP_WITH_REST"), a("7a", "ATTEMPT"),
      a("6c+", "FLASH", "TOPROPE"), a("5c", "REDPOINT", "AUTOBELAY"),
    ]);
    expect(s).toMatchObject({ ascents: 6, topped: 5, clean: 4, onsights: 1, flashes: 1, redpoints: 2, lead: 4, toprope: 1, autobelay: 1 });
    // Lead reference ignores the harder top-rope flash; any-style best keeps its style.
    expect(s.highestLeadClean).toBe("6b");
    expect(s.highestClean).toEqual({ grade: "6c+", style: "TOPROPE" });
    expect(s.highestOnsight).toBe("6a");
    expect(s.cleanRate).toMatchObject({ numerator: 4, denominator: 6 });
    expect(s.pyramid.map((p) => p.grade)).toEqual(["6c+", "6b", "6a", "5c"]);
  });
  it("orders grades by the French scale, not alphabetically", () => {
    expect(summarizeRoutes([a("6a+", "REDPOINT"), a("6a", "REDPOINT"), a("5c+", "REDPOINT")]).highestLeadClean).toBe("6a+");
    expect(summarizeRoutes([a("7a", "REDPOINT"), a("6c+", "REDPOINT")]).highestLeadClean).toBe("7a");
  });
});

describe("observed route working grade", () => {
  it("needs enough recent ascents", () => {
    expect(routeWorkingGrade([a("6b", "REDPOINT"), a("6b", "REDPOINT")], NOW)).toEqual({ grade: null, sampleSize: 2 });
  });
  it("is the hardest grade sent clean on lead at least twice in 60 days", () => {
    const list = [a("6a", "REDPOINT"), a("6a", "ONSIGHT"), a("6b", "REDPOINT"), a("6b", "FLASH"),
      a("6c", "REDPOINT"), a("6c", "TOP_WITH_REST"), a("7a", "REDPOINT", "TOPROPE"), a("7a", "REDPOINT", "TOPROPE"),
      a("7b", "REDPOINT", "LEAD", 90), a("7b", "REDPOINT", "LEAD", 95)];
    expect(routeWorkingGrade(list, NOW)).toEqual({ grade: "6b", sampleSize: 8 });
  });
});

describe("route input validation", () => {
  const base = { sessionId: "6f1c1d1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f", clientId: "7f1c1d1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
    grade: "6b", style: "LEAD", result: "REDPOINT", falls: 0, routeName: "", wallAngle: "UNKNOWN" };
  it("accepts French sport grades only", () => {
    expect(logRouteAscentSchema.safeParse(base).success).toBe(true);
    expect(logRouteAscentSchema.safeParse({ ...base, grade: "7A" }).success).toBe(false);
    expect(logRouteAscentSchema.safeParse({ ...base, grade: "Rouge" }).success).toBe(false);
  });
  it("rejects falls on a clean ascent", () => {
    expect(logRouteAscentSchema.safeParse({ ...base, falls: 2 }).success).toBe(false);
    expect(logRouteAscentSchema.safeParse({ ...base, result: "TOP_WITH_REST", falls: 2 }).success).toBe(true);
  });
  it("recognises the same route name regardless of case and accents", () => {
    expect(routeKey("  Le Dièdre  Jaune ")).toBe(routeKey("le diedre jaune"));
  });
});
