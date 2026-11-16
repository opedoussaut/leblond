import { describe, expect, it } from "vitest";
import { coachSlugOf, withCurrentPictures } from "@/lib/training/coach-sessions";

const current = [{ slug: "mobilite-60", exercises: [
  { name: "Mollets sur une marche", illustration: "calf-raise-step" },
  { name: "Squat cheval", illustration: "horse-stance-squat" },
  { name: "Respiration" },
] }] as unknown as Parameters<typeof withCurrentPictures>[1];

const ex = (name: string, instructions: Record<string, unknown>) => ({ name, instructions });

describe("coach pictures on older séances", () => {
  it("reads the slug from the snapshot key", () => {
    expect(coachSlugOf("coach:mobilite-60:3")).toBe("mobilite-60");
    expect(coachSlugOf("max-hangs:0")).toBeNull();
    expect(coachSlugOf(undefined)).toBeNull();
  });

  it("adds the current picture by session and name, without touching the rest", () => {
    const [calf, squat, breath, other] = withCurrentPictures([
      ex("Mollets sur une marche", { key: "coach:mobilite-60:5", demo: { label: "Caliverse", url: "u" } }),
      ex("Squat cheval", { key: "coach:mobilite-60:9", illustration: "cossack-squat" }),
      ex("Respiration", { key: "coach:mobilite-60:20" }),
      ex("Mollets sur une marche", { key: "coach:autre:1" }),
    ], current);
    expect(calf.instructions).toEqual({ key: "coach:mobilite-60:5", demo: { label: "Caliverse", url: "u" }, illustration: "calf-raise-step" });
    expect(squat.instructions.illustration).toBe("cossack-squat");
    expect(breath.instructions.illustration).toBeUndefined();
    expect(other.instructions.illustration).toBeUndefined();
  });
});
