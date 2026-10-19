import { describe, expect, it } from "vitest";
import { TRAINING_CATALOGUE, TRAINING_AXES, compareTrainingEntries } from "@/lib/training/catalogue";
import { DEFAULT_PLAN, trainingPlanSchema } from "@/lib/training/plans";

describe("training atlas", () => {
  it("has unique IDs, checked score ranges, and legitimate source URLs", () => {
    expect(new Set(TRAINING_CATALOGUE.map((entry) => entry.id)).size).toBe(TRAINING_CATALOGUE.length);
    expect(TRAINING_AXES).toHaveLength(6);
    for (const entry of TRAINING_CATALOGUE) {
      expect(entry.scores).toHaveLength(TRAINING_AXES.length);
      expect(entry.scores.every((score) => Number.isInteger(score) && score >= 1 && score <= 5)).toBe(true);
      expect(new URL(entry.source.url).protocol).toBe("https:");
      expect(entry.description.en.trim().length).toBeGreaterThan(0);
      expect(entry.description.fr.trim().length).toBeGreaterThan(0);
      if (entry.category === "programs") expect(entry.evidence).toBe("provider");
    }
  });

  it("compares known methods in requested order without synthetic results", () => {
    expect(compareTrainingEntries(["max-hangs", "technique"]).map((entry) => entry.id)).toEqual(["max-hangs", "technique"]);
    expect(compareTrainingEntries(["nonexistent"])).toEqual([]);
  });
});

describe("private training plan payload validation", () => {
  it("accepts a moderate default plan", () => {
    expect(trainingPlanSchema.safeParse(DEFAULT_PLAN).success).toBe(true);
  });
  it("rejects unknown methods, overlong durations and invalid IDs", () => {
    expect(trainingPlanSchema.safeParse({
      ...DEFAULT_PLAN,
      sessions: [{ day: 0, methodId: "unsafe-injected-method", minutes: 45, notes: "" }],
    }).success).toBe(false);
    expect(trainingPlanSchema.safeParse({
      ...DEFAULT_PLAN,
      sessions: [{ day: 0, methodId: "technique", minutes: 600, notes: "" }],
    }).success).toBe(false);
    expect(trainingPlanSchema.safeParse({ ...DEFAULT_PLAN, id: "../other-user" }).success).toBe(false);
  });
  it("limits stored plan size to 14 sessions", () => {
    expect(trainingPlanSchema.safeParse({
      ...DEFAULT_PLAN, sessions: Array.from({ length: 15 }, () => DEFAULT_PLAN.sessions[0]),
    }).success).toBe(false);
  });
});
