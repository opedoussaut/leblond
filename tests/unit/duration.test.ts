import { describe, expect, it } from "vitest";
import { durationProblem, hourChoices, joinDuration, minuteChoices, splitMinutes } from "@/lib/duration";

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
  it("offers hours up to the maximum and minutes on the step, keeping an off-step value", () => {
    expect(hourChoices(720)).toHaveLength(13);
    expect(hourChoices(240).at(-1)).toBe(4);
    expect(minuteChoices(5)).toEqual([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]);
    expect(minuteChoices(15, 7)).toEqual([0, 7, 15, 30, 45]);
  });
  it("flags durations outside the allowed range", () => {
    expect(durationProblem(5, 10, 720)).toBe("tooShort");
    expect(durationProblem(721, 10, 720)).toBe("tooLong");
    expect(durationProblem(90, 10, 720)).toBeNull();
  });
});
