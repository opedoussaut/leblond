import { describe, expect, it } from "vitest";
import { assessmentStatus } from "@/lib/training/assessment";

const a = { createdAt: "2026-11-02T10:00:00Z", horizonWeeks: 8 };

describe("assessmentStatus", () => {
  it("is in week 1 with nothing due the first week", () => {
    expect(assessmentStatus(a, [], new Date("2026-11-05T10:00:00Z")))
      .toEqual({ week: 1, horizon: 8, finished: false, checkins: 0, lastCheckin: null, dueCheckin: null });
  });
  it("asks for the week's check-in once a week has passed, until it is done", () => {
    const now = new Date("2026-11-16T12:00:00Z");
    expect(assessmentStatus(a, [1], now)).toMatchObject({ week: 3, checkins: 1, lastCheckin: 1, dueCheckin: 2 });
    expect(assessmentStatus(a, [2, 1, 2], now)).toMatchObject({ checkins: 2, lastCheckin: 2, dueCheckin: null });
  });
  it("caps the week at the horizon and says when the period is over", () => {
    expect(assessmentStatus(a, [], new Date("2027-02-01T00:00:00Z"))).toMatchObject({ week: 8, finished: true, dueCheckin: 8 });
  });
});
