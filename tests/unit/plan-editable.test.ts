import { describe, expect, it } from "vitest";
import { editablePlan, trainingPlanSchema, type SavedTrainingPlan } from "@/lib/training/plans";

describe("editablePlan", () => {
  it("drops row metadata so a saved plan (e.g. created by the full assessment) can be saved again", () => {
    const saved: SavedTrainingPlan = {
      id: "6f1c1d1e-1a2b-4c3d-8e9f-0a1b2c3d4e5f", name: "Programme", goal: "7A", weeks: 6,
      updatedAt: "2026-11-09T10:00:00Z",
      sessions: [{ day: 1, methodId: null, minutes: 30, notes: "", place: "HOME", title: "Mobilité" }],
    };
    expect(trainingPlanSchema.safeParse(saved).success).toBe(false);
    const draft = editablePlan(saved);
    expect(trainingPlanSchema.safeParse(draft).success).toBe(true);
    draft.sessions[0].minutes = 40;
    expect(saved.sessions[0].minutes).toBe(30);
  });
});
