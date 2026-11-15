import { describe, expect, it } from "vitest";
import { datasetAt, placeOfBrand, routeAscentsAt } from "@/lib/analytics/place";
import type { RouteAscentFact } from "@/lib/analytics/routes";
import type { ClimbingDataset } from "@/lib/analytics/types";
import { areasDictionary } from "@/lib/i18n/areas";
import { PROGRESS_SCOPES, PROGRESS_TABS, parseProgressTab, progressHref } from "@/lib/navigation/progress-tabs";

describe("Grimpe sections", () => {
  it("reads the section from ?tab=, falling back to everything", () => {
    expect(parseProgressTab(undefined)).toBe("overview");
    expect(parseProgressTab("route-outdoor")).toBe("route-outdoor");
    expect(parseProgressTab(["boards", "route-indoor"])).toBe("boards");
    expect(parseProgressTab("bloc")).toBe("overview");
  });

  it("gives each section a shareable address that keeps the period", () => {
    expect(progressHref("overview")).toBe("/progress");
    expect(progressHref("overview", "30")).toBe("/progress?period=30");
    expect(progressHref("boulder-indoor", "all")).toBe("/progress?tab=boulder-indoor&period=all");
    for (const tab of PROGRESS_TABS) expect(parseProgressTab(new URL(progressHref(tab), "http://x").searchParams.get("tab") ?? undefined)).toBe(tab);
  });

  it("scopes every section except the overview, with a label in both languages", () => {
    expect(Object.keys(PROGRESS_SCOPES).sort()).toEqual(PROGRESS_TABS.filter((t) => t !== "overview").sort());
    for (const locale of ["fr", "en"] as const) {
      for (const tab of PROGRESS_TABS) expect(areasDictionary(locale).climbing.tabs[tab]).toBeTruthy();
    }
  });
});

describe("indoor / outdoor filters", () => {
  const data: ClimbingDataset = {
    gyms: [
      { id: "g-in", name: "Arkose", brand: "ARKOSE", gradingSystem: "ARKOSE_COLOR" },
      { id: "g-out", name: "Bas Cuvier", brand: "OUTDOOR", gradingSystem: "FONT" },
    ],
    problems: [
      { id: "p-in", gymId: "g-in", nativeGrade: "BLUE", nativeGradeSystem: "ARKOSE_COLOR", wallAngle: "UNKNOWN", tags: [] },
      { id: "p-out", gymId: "g-out", nativeGrade: "6A", nativeGradeSystem: "FONT", wallAngle: "UNKNOWN", tags: [] },
    ],
    attempts: [
      { id: "a-in", problemId: "p-in", sessionId: "s-in", result: "TOP", attemptNumber: 1, createdAt: new Date("2026-11-01") },
      { id: "a-out", problemId: "p-out", sessionId: "s-out", result: "FLASH", attemptNumber: 1, createdAt: new Date("2026-11-02") },
    ],
    sessions: [
      { id: "s-in", gymId: "g-in", startedAt: new Date("2026-11-01"), endedAt: null, durationMinutes: null },
      { id: "s-out", gymId: "g-out", startedAt: new Date("2026-11-02"), endedAt: null, durationMinutes: null },
    ],
  };

  it("treats only crags (brand OUTDOOR) as outdoor", () => {
    expect(placeOfBrand("OUTDOOR")).toBe("outdoor");
    expect(placeOfBrand("ARKOSE")).toBe("indoor");
  });

  it("keeps the gyms, boulders, tries and séances of one kind of place", () => {
    const outdoor = datasetAt(data, "outdoor");
    expect(outdoor.gyms.map((g) => g.id)).toEqual(["g-out"]);
    expect(outdoor.problems.map((p) => p.id)).toEqual(["p-out"]);
    expect(outdoor.attempts.map((a) => a.id)).toEqual(["a-out"]);
    expect(outdoor.sessions.map((s) => s.id)).toEqual(["s-out"]);
    expect(datasetAt(data, "indoor").attempts.map((a) => a.id)).toEqual(["a-in"]);
  });

  it("counts a route ascent with no known place as indoor", () => {
    const base = { sessionId: "s", grade: "6a", style: "LEAD", result: "REDPOINT", falls: null, createdAt: new Date() } as const;
    const ascents = [
      { ...base, id: "r1", outdoor: true },
      { ...base, id: "r2", outdoor: false },
      { ...base, id: "r3" },
    ] as unknown as RouteAscentFact[];
    expect(routeAscentsAt(ascents, "outdoor").map((a) => a.id)).toEqual(["r1"]);
    expect(routeAscentsAt(ascents, "indoor").map((a) => a.id)).toEqual(["r2", "r3"]);
  });
});
