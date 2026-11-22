import { describe, expect, it } from "vitest";
import { followedProgrammes } from "@/lib/analytics/followed-programmes";

describe("followed programmes", () => {
  it("lists each programme with its progress, soonest séance first", () => {
    const out = followedProgrammes({
      plan: { title: "Bloc 7A · 12 semaines", week: 3, horizonWeeks: 12, finished: false, next: "2026-12-03" },
      rebuild: { title: "Rebuild", done: 9, total: 36, next: "2026-12-01" },
      hip: { title: "Hanches", level: 2, next: null },
    });
    expect(out.map((p) => p.kind)).toEqual(["REBUILD", "PLAN", "HIP"]);
    expect(out[0]).toMatchObject({ ratio: 0.25, progress: { unit: "SESSIONS", done: 9, total: 36 }, href: "/train/mobility/rebuild" });
    expect(out[1]).toMatchObject({ ratio: 0.25, progress: { unit: "WEEK", current: 3, total: 12 } });
    expect(out[2]).toMatchObject({ ratio: null, progress: { unit: "LEVEL", level: 2 } });
  });

  it("clamps out-of-range weeks and counts, and marks finished ones", () => {
    const out = followedProgrammes({
      plan: { title: "P", week: 15, horizonWeeks: 12, finished: true, next: "2026-12-03" },
      rebuild: { title: "R", done: 40, total: 36, next: null },
      hip: null,
    });
    expect(out.find((p) => p.kind === "PLAN")).toMatchObject({ ratio: 1, finished: true, next: null, progress: { current: 12 } });
    expect(out.find((p) => p.kind === "REBUILD")).toMatchObject({ ratio: 1, finished: true, progress: { done: 36 } });
  });

  it("shows nothing when nothing is followed", () => {
    expect(followedProgrammes({ plan: null, rebuild: null, hip: null })).toEqual([]);
  });
});
