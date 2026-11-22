import { describe, expect, it } from "vitest";
import { assessmentOverview, checkinTimeline, historyFacts, ratingTrend, trendFromDirection } from "@/lib/training/assessment-overview";

// Monday 2 November 2026, 8 weeks: check-in n opens on 2 Nov + n weeks; a new full assessment is suggested after 4 weeks (30 Nov).
const a = { createdAt: "2026-11-02T10:00:00Z", horizonWeeks: 8 };

describe("checkinTimeline", () => {
  it("lists every week of the period with the day its check-in opens", () => {
    const weeks = checkinTimeline(a.createdAt, 8, [], new Date("2026-11-05T10:00:00Z"));
    expect(weeks).toHaveLength(8);
    expect(weeks[0]).toEqual({ week: 1, state: "upcoming", opens: "2026-11-09" });
    expect(weeks[7].opens).toBe("2026-12-28");
  });
  it("marks done, due, late and upcoming check-ins", () => {
    const weeks = checkinTimeline(a.createdAt, 8, [1], new Date("2026-11-24T12:00:00Z")); // 3 weeks elapsed
    expect(weeks.slice(0, 4).map((w) => w.state)).toEqual(["done", "late", "due", "upcoming"]);
  });
  it("never leaves a week due once it is done", () => {
    const weeks = checkinTimeline(a.createdAt, 8, [1, 2, 3], new Date("2026-11-24T12:00:00Z"));
    expect(weeks.filter((w) => w.state === "due")).toHaveLength(0);
  });
});

describe("assessmentOverview", () => {
  it("is upcoming during the first week, with the first check-in date", () => {
    const o = assessmentOverview(a, [], new Date("2026-11-05T10:00:00Z"), "2026-11-05");
    expect(o).toMatchObject({ state: "upcoming", next: { kind: "wait", date: "2026-11-09" }, nextCheckin: "2026-11-09", missed: 0, reassessOn: "2026-11-30", createdOn: "2026-11-02" });
  });
  it("asks for the open check-in, and says late when an earlier one was missed", () => {
    expect(assessmentOverview(a, [], new Date("2026-11-10T10:00:00Z"), "2026-11-10"))
      .toMatchObject({ state: "due", next: { kind: "checkin", week: 1 }, nextCheckin: null });
    expect(assessmentOverview(a, [], new Date("2026-11-17T10:00:00Z"), "2026-11-17"))
      .toMatchObject({ state: "late", missed: 1, next: { kind: "checkin", week: 2 } });
  });
  it("is on track when the open check-in is done, and points to the next one", () => {
    expect(assessmentOverview(a, [1, 2], new Date("2026-11-17T10:00:00Z"), "2026-11-17"))
      .toMatchObject({ state: "on-track", next: { kind: "wait", date: "2026-11-23" } });
  });
  it("asks for a new full assessment from its suggested date, before any check-in", () => {
    expect(assessmentOverview(a, [1, 2, 3, 4], new Date("2026-11-30T10:00:00Z"), "2026-11-30"))
      .toMatchObject({ state: "reassess", next: { kind: "reassess", since: "2026-11-30" } });
  });
  it("has nothing left to wait for once every check-in is done (period over, reassessment shown first)", () => {
    const o = assessmentOverview({ ...a, horizonWeeks: 4 }, [1, 2, 3, 4], new Date("2026-12-01T10:00:00Z"), "2026-11-29");
    expect(o.nextCheckin).toBeNull();
    expect(o.next).toEqual({ kind: "done" });
  });
});

describe("trends", () => {
  it("reads measured directions as trends", () => {
    expect(trendFromDirection("better")).toBe("improving");
    expect(trendFromDirection("worse")).toBe("declining");
    expect(trendFromDirection("same")).toBe("stable");
  });
  it("needs at least one scale step (0.5) on a 1–5 rating to call a change", () => {
    expect(ratingTrend(3, 3.5)).toBe("improving");
    expect(ratingTrend(3, 3.4)).toBe("stable");
    expect(ratingTrend(3.5, 3)).toBe("declining");
  });
});

describe("historyFacts", () => {
  it("counts measured tests, observed figures and self-ratings apart", () => {
    const ratings = { technique: 3, fingers: 3, power: 3, endurance: 3, mental: 3, structure: 3 };
    expect(historyFacts({ ratings, measurements: undefined, context: undefined })).toEqual({ measured: 0, observed: 0, selfRated: 6 });
  });
});
