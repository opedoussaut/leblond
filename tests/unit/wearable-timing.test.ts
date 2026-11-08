import { describe, expect, it } from "vitest";
import { activityMinutes, compareTiming } from "@/lib/integrations/wearables/timing";

const NOW = new Date("2026-11-08T12:00:00Z");

describe("compareTiming", () => {
  it("shows both sides in Paris time (summer, UTC+2)", () => {
    const c = compareTiming(
      { startedAt: "2026-09-21T16:02:30Z", durationSeconds: 6300 },
      { startedAt: "2026-09-21T16:00:00Z", endedAt: "2026-09-21T17:30:00Z", durationMinutes: 90 },
      NOW,
    );
    expect(c.activity).toEqual({ date: "2026-09-21", start: "18:02", end: "19:47", minutes: 105 });
    expect(c.session).toEqual({ date: "2026-09-21", start: "18:00", end: "19:30", minutes: 90 });
    expect(c.differs).toBe(true);
    expect(c.usable).toBe(true);
  });

  it("uses winter time after the October change (UTC+1)", () => {
    const c = compareTiming(
      { startedAt: "2026-11-02T17:00:00Z", durationSeconds: 3600 },
      { startedAt: "2026-11-02T17:00:00Z", endedAt: "2026-11-02T18:00:00Z", durationMinutes: 60 },
      NOW,
    );
    expect(c.activity.start).toBe("18:00");
    expect(c.differs).toBe(false);
  });

  it("crosses midnight in local time, not UTC", () => {
    const c = compareTiming(
      { startedAt: "2026-07-01T22:30:00Z", durationSeconds: 1800 },
      { startedAt: "2026-07-01T20:00:00Z", endedAt: "2026-07-01T21:00:00Z", durationMinutes: 60 },
      NOW,
    );
    expect(c.activity).toMatchObject({ date: "2026-07-02", start: "00:30", end: "01:00" });
  });

  it("ignores seconds when comparing the start", () => {
    const c = compareTiming(
      { startedAt: "2026-09-21T16:00:59Z", durationSeconds: 5400 },
      { startedAt: "2026-09-21T16:00:00Z", endedAt: "2026-09-21T17:30:00Z", durationMinutes: 90 },
      NOW,
    );
    expect(c.differs).toBe(false);
  });

  it("refuses live sessions, unusable durations and future starts", () => {
    const session = { startedAt: "2026-09-21T16:00:00Z", endedAt: "2026-09-21T17:30:00Z", durationMinutes: 90 };
    expect(compareTiming({ startedAt: "2026-09-21T16:00:00Z", durationSeconds: 5400 }, { ...session, endedAt: null, durationMinutes: null }, NOW).reason).toBe("live");
    expect(compareTiming({ startedAt: "2026-09-21T16:00:00Z", durationSeconds: 20 }, session, NOW).reason).toBe("noTiming");
    expect(compareTiming({ startedAt: "2026-09-21T16:00:00Z", durationSeconds: 90_000 }, session, NOW).usable).toBe(false);
    expect(compareTiming({ startedAt: "2026-12-01T16:00:00Z", durationSeconds: 3600 }, session, NOW).reason).toBe("future");
  });

  it("rounds the watch duration to the minute", () => {
    expect(activityMinutes(5329)).toBe(89);
    expect(activityMinutes(5330)).toBe(89);
    expect(activityMinutes(5340)).toBe(89);
    expect(activityMinutes(5370)).toBe(90);
  });
});
