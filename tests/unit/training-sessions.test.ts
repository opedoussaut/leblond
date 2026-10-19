import { describe, expect, it } from "vitest";
import { METHODS_FOR_PLANS } from "@/lib/training/catalogue";
import { snapshotOf, templateFor } from "@/lib/training/session-templates";
import {
  activeSeconds, adherence, canTransition, createTrainingSessionSchema, dateForPlanDay, formatClock, mondayOf,
  restRemaining, saveSetSchema, settledExerciseStatus, summarize, type TrainingExercise,
} from "@/lib/training/sessions";

const ex = (over: Partial<TrainingExercise>): TrainingExercise => ({
  id: "e", position: 0, block: "MAIN", methodId: null, name: "x", instructions: {}, modality: "REPS",
  targetSets: 3, targetReps: 6, targetSeconds: null, restSeconds: 60, intensity: "", status: "PENDING",
  rpe: null, notes: "", sets: [], ...over,
});
const set = (i: number, reps: number | null, seconds: number | null = null) =>
  ({ id: String(i), setIndex: i, reps, seconds, loadKg: null, completed: true, notes: "" });

describe("training session lifecycle", () => {
  it("allows only the documented transitions", () => {
    expect(canTransition("PLANNED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("IN_PROGRESS", "COMPLETED")).toBe(true);
    expect(canTransition("INTERRUPTED", "IN_PROGRESS")).toBe(true);
    expect(canTransition("PLANNED", "COMPLETED")).toBe(false);
    expect(canTransition("COMPLETED", "IN_PROGRESS")).toBe(false);
    expect(canTransition("SKIPPED", "PLANNED")).toBe(true);
  });
});

describe("timers derive from timestamps", () => {
  const startedAt = "2026-10-20T10:00:00.000Z";
  it("counts active time minus completed pauses", () => {
    const now = new Date("2026-10-20T10:30:00.000Z");
    expect(activeSeconds({ startedAt, pausedAt: null, pausedSeconds: 300, completedAt: null }, now)).toBe(25 * 60);
  });
  it("freezes while paused, even if the page was backgrounded for an hour", () => {
    const now = new Date("2026-10-20T11:30:00.000Z");
    expect(activeSeconds({ startedAt, pausedAt: "2026-10-20T10:20:00.000Z", pausedSeconds: 0, completedAt: null }, now)).toBe(20 * 60);
  });
  it("uses completion time once finished", () => {
    const later = new Date("2026-10-21T00:00:00.000Z");
    expect(activeSeconds({ startedAt, pausedAt: null, pausedSeconds: 0, completedAt: "2026-10-20T11:00:00.000Z" }, later)).toBe(3600);
  });
  it("computes rest countdowns from an end timestamp", () => {
    expect(restRemaining(10_000, 4_500)).toBe(6);
    expect(restRemaining(10_000, 12_000)).toBe(0);
    expect(restRemaining(null, 0)).toBe(0);
    expect(formatClock(65)).toBe("1:05");
    expect(formatClock(3725)).toBe("1:02:05");
  });
});

describe("exercise settlement and summaries", () => {
  it("marks untouched exercises skipped and partial ones modified", () => {
    expect(settledExerciseStatus(ex({}))).toBe("SKIPPED");
    expect(settledExerciseStatus(ex({ sets: [set(1, 6)] }))).toBe("MODIFIED");
    expect(settledExerciseStatus(ex({ sets: [set(1, 6), set(2, 6), set(3, 5)] }))).toBe("DONE");
    expect(settledExerciseStatus(ex({ status: "SKIPPED", sets: [set(1, 6)] }))).toBe("SKIPPED");
  });
  it("summarizes planned versus actual work without double counting", () => {
    const s = summarize({ plannedMinutes: 60, actualMinutes: 52 }, [
      ex({ id: "a", status: "DONE", sets: [set(1, 6), set(2, 5)] }),
      ex({ id: "b", modality: "HOLD", targetSets: 5, targetReps: null, targetSeconds: 10, status: "MODIFIED", sets: [set(1, null, 10), set(2, null, 8)] }),
      ex({ id: "c", status: "SKIPPED" }),
    ]);
    expect(s).toMatchObject({ exercises: 3, done: 1, modified: 1, skipped: 1, plannedSets: 11, completedSets: 4, totalReps: 11, totalHoldSeconds: 18 });
  });
});

describe("adherence", () => {
  const base = { scheduledDate: null, createdAt: "2026-10-01T00:00:00Z", actualMinutes: null, rpe: null, pain: null };
  it("never counts upcoming sessions as missed", () => {
    const a = adherence([
      { ...base, status: "COMPLETED", scheduledDate: "2026-10-10", actualMinutes: 50, rpe: 7 },
      { ...base, status: "COMPLETED", scheduledDate: "2026-10-12", actualMinutes: 40, rpe: 8, pain: 4 },
      { ...base, status: "PLANNED", scheduledDate: "2026-10-14" },
      { ...base, status: "PLANNED", scheduledDate: "2026-10-30" },
      { ...base, status: "CANCELED", scheduledDate: "2026-10-11" },
    ], "2026-10-20");
    expect(a).toMatchObject({ planned: 3, completed: 2, skipped: 1, upcoming: 1, activeMinutes: 90, averageRpe: 7.5, painReports: 1 });
    expect(a.completionRate).toBeCloseTo(2 / 3);
  });
});

describe("local dates across the Paris DST change", () => {
  it("maps plan weekdays onto local calendar dates", () => {
    // Week of the 2026-10-25 DST change (clocks go back on Sunday).
    expect(mondayOf("2026-10-25")).toBe("2026-10-19");
    expect(dateForPlanDay("2026-10-19", 6)).toBe("2026-10-25");
    expect(dateForPlanDay("2026-10-19", 0)).toBe("2026-10-19");
    expect(mondayOf("2026-03-29")).toBe("2026-03-23");
  });
});

describe("templates and validation", () => {
  it("builds an executable sequence for every plan method", () => {
    for (const m of METHODS_FOR_PLANS) {
      const t = templateFor(m.id, 60);
      expect(t.some((e) => e.block === "WARMUP")).toBe(true);
      expect(t.some((e) => e.block === "MAIN")).toBe(true);
      expect(t.at(-1)?.block).toBe("COOLDOWN");
      for (const e of t) expect(snapshotOf(e).steps.length).toBeGreaterThan(0);
    }
  });
  it("adds a finger warm-up before finger loading and shortens short sessions", () => {
    expect(templateFor("max-hangs", 60).map((e) => e.key)).toContain("finger-warmup");
    expect(templateFor("technique", 30).some((e) => e.block === "COOLDOWN")).toBe(false);
    expect(templateFor(null, 45).find((e) => e.block === "MAIN")?.modality).toBe("FREE");
  });
  it("validates inputs strictly", () => {
    expect(createTrainingSessionSchema.safeParse({ source: "quick", methodId: "nope", title: "", minutes: 60, date: "2026-10-20", time: "", startNow: true }).success).toBe(false);
    expect(createTrainingSessionSchema.safeParse({ source: "quick", methodId: "technique", title: "", minutes: 60, date: "2026-10-20", time: "", startNow: true }).success).toBe(true);
    expect(saveSetSchema.safeParse({ exerciseId: "6f1c1d1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f", setIndex: 1, reps: 6, seconds: null, loadKg: 2.5, completed: true, notes: "" }).success).toBe(true);
    expect(saveSetSchema.safeParse({ exerciseId: "6f1c1d1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f", setIndex: 0, reps: 6, seconds: null, loadKg: null, completed: true, notes: "" }).success).toBe(false);
  });
});
