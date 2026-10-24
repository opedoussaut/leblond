import { describe, expect, it } from "vitest";
import { fontRangeFor, formatFontRange, isColourSystem } from "@/lib/grading/conversions";
import { FONT_SCALE } from "@/lib/grading/systems";
import { logRouteAscentSchema } from "@/lib/climbing/routes";
import { utcToZoned, zonedToUtc } from "@/lib/time";

describe("Paris local time for past sessions", () => {
  it("converts summer and winter wall-clock times to the right instant", () => {
    expect(zonedToUtc("2026-07-14", "18:30").toISOString()).toBe("2026-07-14T16:30:00.000Z"); // UTC+2
    expect(zonedToUtc("2026-12-01", "18:30").toISOString()).toBe("2026-12-01T17:30:00.000Z"); // UTC+1
  });
  it("handles the October and March DST change days", () => {
    expect(zonedToUtc("2026-10-25", "10:00").toISOString()).toBe("2026-10-25T09:00:00.000Z");
    expect(zonedToUtc("2026-03-29", "10:00").toISOString()).toBe("2026-03-29T08:00:00.000Z");
  });
  it("round-trips to the local date and time", () => {
    expect(utcToZoned("2026-10-25T09:00:00.000Z")).toEqual({ date: "2026-10-25", time: "10:00" });
    expect(utcToZoned(zonedToUtc("2026-01-02", "07:05"))).toEqual({ date: "2026-01-02", time: "07:05" });
  });
});

describe("indicative Font ranges from the LEBLOND reference table", () => {
  it("gives Arkose and Climbing District colours a range in Font order", () => {
    expect(fontRangeFor("ARKOSE_COLOR", "RED")).toEqual({ from: "6A+", to: "6C+" });
    expect(formatFontRange(fontRangeFor("ARKOSE_COLOR", "BLACK")!)).toBe("≈ 7A–7A+");
    expect(fontRangeFor("CLIMBING_DISTRICT_COLOR", "BLUE")).toEqual({ from: "5b", to: "6A" });
    for (const system of ["ARKOSE_COLOR", "CLIMBING_DISTRICT_COLOR"] as const) {
      for (const colour of ["YELLOW", "GREEN", "BLUE", "RED", "BLACK", "PURPLE"]) {
        const r = fontRangeFor(system, colour)!;
        expect(FONT_SCALE.indexOf(r.from)).toBeLessThanOrEqual(FONT_SCALE.indexOf(r.to));
      }
    }
  });
  it("never invents a range for colours absent from the table", () => {
    expect(fontRangeFor("CLIMBING_DISTRICT_COLOR", "PINK")).toBeNull();
    expect(fontRangeFor("CLIMBING_DISTRICT_COLOR", "WHITE")).toBeNull();
    expect(fontRangeFor("CUSTOM_COLOR", "RED")).toBeNull();
    expect(fontRangeFor("FONT", "6A")).toBeNull();
  });
  it("treats colour systems (not Font) as needing a French route equivalent", () => {
    expect(isColourSystem("CLIMBING_DISTRICT_COLOR")).toBe(true);
    expect(isColourSystem("FONT")).toBe(false);
  });
});

describe("route ascents with a native colour", () => {
  const base = { sessionId: "6f1c1d1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f", clientId: "7f1c1d1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f",
    grade: "6a", style: "TOPROPE", result: "REDPOINT", falls: 0, routeName: "", wallAngle: "UNKNOWN" };
  it("accepts a colour alongside the French equivalent, and still requires the French grade", () => {
    expect(logRouteAscentSchema.safeParse({ ...base, nativeGrade: "BLUE" }).success).toBe(true);
    expect(logRouteAscentSchema.safeParse({ ...base, nativeGrade: "BLUE", grade: undefined }).success).toBe(false);
    expect(logRouteAscentSchema.safeParse({ ...base, style: "AUTOBELAY" }).success).toBe(true);
  });
});
