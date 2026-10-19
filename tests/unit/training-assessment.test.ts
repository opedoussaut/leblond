import { describe, expect, it } from "vitest";
import { DEFAULT_SKILLS, assessmentInputSchema, checkinInputSchema, elapsedWeeks, expectedRatingsAtWeek, methodMatches, skillRatingsSchema } from "@/lib/training/assessment";
import { METHODS_FOR_PLANS, TRAINING_AXES } from "@/lib/training/catalogue";

describe("climbing self-assessment and illustrative method scenario", () => {
  const technique = METHODS_FOR_PLANS.find(m => m.id === "technique")!;

  it("returns baseline at week 0, never extrapolates beyond horizon and clamps scores", () => {
    const atStart = expectedRatingsAtWeek(DEFAULT_SKILLS, technique, 0, 12, 2);
    expect(atStart).toEqual(DEFAULT_SKILLS);
    const after = expectedRatingsAtWeek(DEFAULT_SKILLS, technique, 12, 12, 2);
    expect(after.technique).toBeGreaterThan(after.fingers);
    expect(expectedRatingsAtWeek(DEFAULT_SKILLS, technique, 20, 12, 2)).toEqual(after);
    for (const score of Object.values(expectedRatingsAtWeek({
      technique: 5, fingers: 5, power: 5, endurance: 5, mental: 5, structure: 5,
    }, technique, 24, 24, 5))) expect(score).toBe(5);
  });

  it("produces explicit method fit based on weaker self-reported axes", () => {
    const weakTechnique = { ...DEFAULT_SKILLS, technique: 1, fingers: 5 };
    const recommendations = methodMatches(weakTechnique);
    expect(recommendations).toHaveLength(3);
    expect(recommendations[0].fit).toBeGreaterThanOrEqual(recommendations[1].fit);
    expect(recommendations.every(m => METHODS_FOR_PLANS.includes(m.method))).toBe(true);
  });

  it("requires the same complete six-axis scale for every follow-up", () => {
    expect(Object.keys(DEFAULT_SKILLS)).toHaveLength(TRAINING_AXES.length);
    expect(skillRatingsSchema.safeParse({ ...DEFAULT_SKILLS, technique: 0 }).success).toBe(false);
    expect(skillRatingsSchema.safeParse({ ...DEFAULT_SKILLS, fingers: 5.2 }).success).toBe(false);
    expect(skillRatingsSchema.safeParse({ ...DEFAULT_SKILLS, strength: 4 }).success).toBe(false);
    expect(assessmentInputSchema.safeParse({
      methodId: "max-hangs", ratings: DEFAULT_SKILLS, horizonWeeks: 12, sessionsPerWeek: 2, goal: "",
    }).success).toBe(true);
    expect(assessmentInputSchema.safeParse({
      methodId: "unverified-advertiser", ratings: DEFAULT_SKILLS, horizonWeeks: 12, sessionsPerWeek: 2, goal: "",
    }).success).toBe(false);
    expect(checkinInputSchema.safeParse({
      assessmentId: "00000000-0000-4000-8000-000000000001", week: 2, ratings: DEFAULT_SKILLS, notes: "Climbed once",
    }).success).toBe(true);
    expect(checkinInputSchema.safeParse({
      assessmentId: "00000000-0000-4000-8000-000000000001", week: 25, ratings: DEFAULT_SKILLS, notes: "",
    }).success).toBe(false);
  });

  it("cannot mark a future week as elapsed", () => {
    expect(elapsedWeeks("2026-10-19T10:00:00Z", new Date("2026-10-25T10:00:00Z"))).toBe(0);
    expect(elapsedWeeks("2026-10-19T10:00:00Z", new Date("2026-11-02T10:00:00Z"))).toBe(2);
    expect(elapsedWeeks("2026-10-19T10:00:00Z", new Date("2026-10-18T10:00:00Z"))).toBe(0);
  });
});
