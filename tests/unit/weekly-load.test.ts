import { describe, expect, it } from "vitest";
import type { LoadSource, SessionLoad } from "@/lib/analytics/training-load";
import { gaugeGeometry, hoursReport, minutesBySource, hoursStatus, hoursZone, nextWeek, weeklyHours, zoneDays } from "@/lib/analytics/weekly-load";

const addDays = (d: string, n: number) => new Date(Date.parse(d + "T00:00:00Z") + n * 86_400_000).toISOString().slice(0, 10);
const s = (date: string, minutes: number, source: LoadSource = "BOULDER"): SessionLoad =>
  ({ date, source, minutes, intensity: 6, load: 6 * minutes, estimated: { minutes: false, intensity: true } });
/** A séance of `minutes` every `every` days for `days` days from `from`. */
const every = (from: string, days: number, gap: number, minutes: number, source: LoadSource = "BOULDER") =>
  Array.from({ length: days }, (_, i) => i).filter((i) => i % gap === 0).map((i) => s(addDays(from, i), minutes, source));

// 2026-11-22 is a Sunday; its ISO week starts on Monday 2026-11-16.
const TODAY = "2026-11-22";

describe("hoursStatus", () => {
  it("compares the last 7 days with the 4 weeks before, in minutes", () => {
    // 2 × 2 h a week for 5 weeks: habit 4 h, last 7 days 4 h → in the zone.
    const steady = Array.from({ length: 10 }, (_, k) => s(addDays(TODAY, -34 + Math.floor(k * 3.5)), 120));
    const st = hoursStatus(steady, TODAY);
    expect(st.habit?.minutes).toBe(240);
    expect(st.last7).toBe(240);
    expect(st.zone).toBe("zone");
  });

  it("says there is not enough history instead of a capped value for a first week", () => {
    // Only this week logged: the old coupled ratio read 4.0 here.
    const st = hoursStatus(every(addDays(TODAY, -6), 7, 2, 90), TODAY);
    expect(st.habit).toBeNull();
    expect(st.zone).toBeNull();
    expect(st.noHabit).toEqual({ reason: "history", daysLeft: 28 });
    expect(st.last7).toBe(360);
  });

  it("counts down the days of history left", () => {
    const st = hoursStatus(every(addDays(TODAY, -20), 21, 3, 60), TODAY);
    expect(st.noHabit).toEqual({ reason: "history", daysLeft: 14 });
  });

  it("needs activity in at least 2 of the 4 habit weeks", () => {
    // One old séance 40 days ago, then nothing until this week: history is long enough but the habit is empty.
    const st = hoursStatus([s(addDays(TODAY, -40), 90), ...every(addDays(TODAY, -6), 7, 2, 90)], TODAY);
    expect(st.noHabit).toEqual({ reason: "activity" });
    expect(st.zone).toBeNull();
  });

  it("leaves mobility out of the zone but reports it", () => {
    const base = every(addDays(TODAY, -34), 28, 7, 240);
    const week = [s(addDays(TODAY, -3), 240), ...every(addDays(TODAY, -6), 7, 1, 30, "MOBILITY")];
    const st = hoursStatus([...base, ...week], TODAY);
    expect(st.last7).toBe(240);
    expect(st.mobility7).toBe(210);
    expect(st.zone).toBe("zone");
  });

  it("reads too light and too heavy with the 0.8 and 1.3 limits", () => {
    const habit = { minutes: 240, low: 192, high: 312 };
    expect(hoursZone(190, habit)).toBe("light");
    expect(hoursZone(192, habit)).toBe("zone");
    expect(hoursZone(312, habit)).toBe("zone");
    expect(hoursZone(313, habit)).toBe("heavy");
  });
});

describe("weeklyHours", () => {
  it("stacks minutes by type per ISO week, empty weeks included, the current week partial", () => {
    const loads = [s("2026-11-03", 90), s("2026-11-04", 60, "ROUTE"), s("2026-11-05", 30, "MOBILITY"), s("2026-11-18", 45, "BOARD")];
    const rows = weeklyHours(loads, TODAY, "2026-11-02");
    expect(rows.map((r) => r.weekStart)).toEqual(["2026-11-02", "2026-11-09", "2026-11-16"]);
    expect(rows[0]).toMatchObject({ total: 180, effort: 150, sessions: 3, partial: false, habit: null, zone: null });
    expect(rows[0].bySource).toEqual({ BOULDER: 90, ROUTE: 60, BOARD: 0, TRAINING: 0, MOBILITY: 30 });
    expect(rows[1]).toMatchObject({ total: 0, sessions: 0 });
    expect(rows[2]).toMatchObject({ total: 45, partial: true, zone: null });
  });

  it("judges a finished week against the 4 weeks before it", () => {
    const loads = [...every("2026-10-05", 28, 7, 240), s("2026-11-03", 400)];
    const week = weeklyHours(loads, TODAY, "2026-11-02")[0];
    expect(week.habit?.minutes).toBe(240);
    expect(week.zone).toBe("heavy");
    expect(week.ratio).toBe(1.67);
  });

  it("ignores sessions after today", () => {
    const rows = weeklyHours([s("2026-11-21", 60), s("2026-11-23", 60)], TODAY, "2026-11-16");
    expect(rows).toHaveLength(1);
    expect(rows[0].total).toBe(60);
  });
});

describe("nextWeek", () => {
  it("turns the zone for the next 7 days into séances of the usual length", () => {
    // 4 h a week in 2 séances of 2 h for 6 weeks.
    const loads = every(addDays(TODAY, -41), 42, 7, 120).flatMap((l) => [l, s(addDays(l.date, 3), 120)]).filter((l) => l.date <= TODAY);
    const n = nextWeek(loads, TODAY)!;
    expect(n.typicalMinutes).toBe(120);
    expect(n.minMinutes).toBeGreaterThan(0);
    expect(n.minSessions).toBe(Math.max(1, Math.round(n.minMinutes / 120)));
    expect(n.maxSessions).toBeGreaterThanOrEqual(n.minSessions);
    expect(n).toMatchObject({ minSessions: 2, maxSessions: 3 });
  });

  it("gives nothing without a habit", () => {
    expect(nextWeek(every(addDays(TODAY, -10), 11, 2, 60), TODAY)).toBeNull();
  });
});

describe("zoneDays", () => {
  it("is null (not 0) while there is no habit, then the same comparison as the headline", () => {
    const loads = every(addDays(TODAY, -60), 61, 3, 90);
    const days = zoneDays(loads, TODAY, addDays(TODAY, -60));
    expect(days[0].ratio).toBeNull();
    expect(days.slice(0, 34).every((d) => d.ratio === null)).toBe(true);
    expect(days[34].ratio).not.toBeNull();
    const last = days.at(-1)!;
    const st = hoursStatus(loads, TODAY);
    expect(last.last7).toBe(st.last7);
    expect(last.habit).toBe(st.habit!.minutes);
    expect(last.ratio).toBeCloseTo(st.last7 / st.habit!.minutes, 2);
  });

  it("never reads 4.0 in the first weeks of logging", () => {
    const loads = every(addDays(TODAY, -40), 41, 2, 60);
    const values = zoneDays(loads, TODAY, addDays(TODAY, -40)).flatMap((d) => (d.ratio === null ? [] : [d.ratio]));
    expect(Math.max(...values)).toBeLessThan(1.5);
  });

  it("starts at the first day of history", () => {
    expect(zoneDays([s("2026-11-20", 60)], TODAY, "2026-11-01").map((d) => d.date)).toEqual(["2026-11-20", "2026-11-21", "2026-11-22"]);
    expect(zoneDays([], TODAY, "2026-11-01")).toEqual([]);
  });
});

describe("hoursReport", () => {
  it("bundles weeks, headline, next week and days", () => {
    const r = hoursReport(every(addDays(TODAY, -50), 51, 3, 90), TODAY, addDays(TODAY, -27));
    expect(r.weeks.length).toBeGreaterThanOrEqual(4);
    expect(r.status.zone).not.toBeNull();
    expect(r.next).not.toBeNull();
    expect(r.days.at(-1)?.date).toBe(TODAY);
  });
});

describe("gaugeGeometry", () => {
  it("places the zone, the habit and the week on a 0–1.8 × habit scale", () => {
    expect(gaugeGeometry(180, { minutes: 240, low: 192, high: 312 })).toEqual({ low: 44.4, high: 72.2, habit: 55.6, marker: 41.7, overflow: false });
    expect(gaugeGeometry(900, { minutes: 240, low: 192, high: 312 })).toMatchObject({ marker: 100, overflow: true });
  });
});

describe("minutesBySource", () => {
  it("sums minutes and séances per type over the last 28 days", () => {
    const loads = [s(addDays(TODAY, -30), 90), s(addDays(TODAY, -3), 90), s(addDays(TODAY, -2), 30, "MOBILITY"), s(addDays(TODAY, -1), 60)];
    expect(minutesBySource(loads, TODAY)).toEqual([{ source: "BOULDER", minutes: 150, sessions: 2 }, { source: "MOBILITY", minutes: 30, sessions: 1 }]);
  });
});
