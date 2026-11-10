import { describe, expect, it } from "vitest";
import { durationPresets, durationProblem, durationSuggestions, formatDuration, joinDuration, parseDuration, splitMinutes } from "@/lib/duration";

describe("hours + minutes durations", () => {
  it("splits stored minutes into hours and minutes", () => {
    expect(splitMinutes(135)).toEqual({ hours: 2, minutes: 15 });
    expect(splitMinutes(45)).toEqual({ hours: 0, minutes: 45 });
    expect(splitMinutes(60)).toEqual({ hours: 1, minutes: 0 });
    expect(splitMinutes(0)).toEqual({ hours: 0, minutes: 0 });
  });
  it("joins hours and minutes back into minutes", () => {
    expect(joinDuration(2, 15)).toBe(135);
    expect(joinDuration(0, 45)).toBe(45);
    for (const total of [1, 59, 61, 127, 720, 1440]) {
      const { hours, minutes } = splitMinutes(total);
      expect(joinDuration(hours, minutes)).toBe(total);
    }
  });
  it("reads durations typed the way people say them", () => {
    for (const [text, minutes] of [
      ["90", 90], ["90 min", 90], ["45mn", 45], ["45m", 45], ["  75  ", 75],
      ["1h30", 90], ["1 h 30", 90], ["1H30", 90], ["1h30min", 90], ["2h", 120], ["2 h", 120], ["1h05", 65], ["1h5", 65],
      ["1:30", 90], ["0:45", 45], ["1,5 h", 90], ["1.5h", 90], ["0,75h", 45],
    ] as const) expect(parseDuration(text), text).toBe(minutes);
    expect(parseDuration("")).toBeNull();
    expect(parseDuration("   ")).toBeNull();
    for (const text of ["abc", "1h75", "1:60", "-30", "1h30h", "1.5", "h30"]) expect(parseDuration(text), text).toBeUndefined();
  });
  it("writes durations back the same way, and reads its own output", () => {
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(90)).toBe("1 h 30");
    expect(formatDuration(125)).toBe("2 h 05");
    for (const total of [0, 5, 59, 60, 61, 90, 135, 720, 1440]) expect(parseDuration(formatDuration(total))).toBe(total);
  });
  it("offers common durations and a 15-minute list within the allowed range", () => {
    expect(durationPresets(10, 240)).toEqual([30, 45, 60, 90, 120, 180]);
    expect(durationPresets(60, 120)).toEqual([60, 90, 120]);
    expect(durationSuggestions(10, 1440)).toHaveLength(24);
    expect(durationSuggestions(30, 90)).toEqual([30, 45, 60, 75, 90]);
  });
  it("flags durations outside the allowed range", () => {
    expect(durationProblem(5, 10, 720)).toBe("tooShort");
    expect(durationProblem(721, 10, 720)).toBe("tooLong");
    expect(durationProblem(90, 10, 720)).toBeNull();
  });
});
