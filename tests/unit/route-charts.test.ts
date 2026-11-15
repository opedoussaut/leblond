import { describe, expect, it } from "vitest";
import { routePyramid, routeWeeklyActivity, routeWeeklyHardest, type RouteAscentFact } from "@/lib/analytics/routes";

let n = 0;
const r = (grade: string, result: RouteAscentFact["result"], at: string, sessionId = "s1"): RouteAscentFact =>
  ({ id: String(++n), sessionId, grade, style: "LEAD", result, falls: null, createdAt: new Date(at) });
const now = new Date("2026-11-15T12:00:00Z");

describe("route diagrams", () => {
  const ascents = [
    r("6a", "REDPOINT", "2026-11-03T18:00:00Z"), r("6b", "ATTEMPT", "2026-11-03T18:30:00Z"), r("5c", "ONSIGHT", "2026-11-04T18:00:00Z", "s2"),
    r("6a+", "FLASH", "2026-11-12T18:00:00Z", "s3"), r("6b", "TOP_WITH_REST", "2026-11-12T18:30:00Z", "s3"),
    r("7a", "REDPOINT", "2025-01-01T10:00:00Z"),
  ];
  it("gives the hardest clean route per week, never an unclean one", () => {
    expect(routeWeeklyHardest(ascents, now, 84)).toEqual([
      { weekStart: "2026-11-02", grade: "6a", score: expect.any(Number), sends: 2 },
      { weekStart: "2026-11-09", grade: "6a+", score: expect.any(Number), sends: 1 },
    ]);
  });
  it("builds the pyramid hardest first with onsight/flash, clean and tried", () => {
    const rows = routePyramid(ascents, now, 84);
    expect(rows.map((x) => x.grade)).toEqual(["6b", "6a+", "6a", "5c"]);
    expect(rows[0]).toMatchObject({ sent: 0, tried: 2, flashed: 0 });
    expect(rows[1]).toMatchObject({ sent: 1, flashed: 1 });
  });
  it("counts weekly sessions, ascents and clean ascents with empty weeks", () => {
    const weeks = routeWeeklyActivity(ascents, now, 3);
    expect(weeks.map((w) => w.weekStart)).toEqual(["2026-10-26", "2026-11-02", "2026-11-09"]);
    expect(weeks[1]).toEqual({ weekStart: "2026-11-02", sessions: 2, attempts: 3, tops: 2, flashes: 1 });
    expect(weeks[0].attempts).toBe(0);
  });
});
