import { describe, expect, it } from "vitest";
import { computeSnapshot, type ClimbingDataset } from "@/lib/analytics";
import { GRADE_SYSTEMS } from "@/lib/climbing/types";
import { buildCoachContext } from "@/lib/coach/context";
import { gradeSystemKind, isColorSystem, isValidGrade, listGrades, nextGrade } from "@/lib/grading";
import { fontRangeFor } from "@/lib/grading/conversions";
import { gradeLabel, gradeMeaning, gradeSpokenLabel } from "@/lib/grading/labels";
import { isBareLevelSystem } from "@/lib/grading/systems";
import { en } from "@/lib/i18n/en";
import { fr } from "@/lib/i18n/fr";
import { attemptsFor, daysAgo, NOW, problem, session } from "./fixtures";

describe("Climb World levels 1–7", () => {
  it("is its own ordered scale of seven levels", () => {
    expect(GRADE_SYSTEMS).toContain("CLIMB_WORLD_LEVEL");
    expect(listGrades("CLIMB_WORLD_LEVEL").map((g) => g.id)).toEqual(["1", "2", "3", "4", "5", "6", "7"]);
    expect(gradeSystemKind("CLIMB_WORLD_LEVEL")).toBe("NUMERIC");
    expect(isColorSystem("CLIMB_WORLD_LEVEL")).toBe(false);
    expect(isValidGrade("CLIMB_WORLD_LEVEL", "7")).toBe(true);
    expect(isValidGrade("CLIMB_WORLD_LEVEL", "8")).toBe(false);
    expect(isValidGrade("CLIMB_WORLD_LEVEL", "6A")).toBe(false);
    expect(nextGrade("CLIMB_WORLD_LEVEL", "3")).toBe("4");
  });

  it("is shown as a level with the gym's own words, never as Font", () => {
    expect(isBareLevelSystem("CLIMB_WORLD_LEVEL")).toBe(true);
    expect(gradeLabel(fr, "CLIMB_WORLD_LEVEL", "7")).toBe("Niv. 7");
    expect(gradeLabel(en, "CLIMB_WORLD_LEVEL", "7")).toBe("Lvl 7");
    expect(gradeSpokenLabel(fr, "CLIMB_WORLD_LEVEL", "3")).toBe("Niveau 3");
    expect(gradeMeaning(fr, "CLIMB_WORLD_LEVEL", "1")).toBe("débutant");
    expect(gradeMeaning(fr, "CLIMB_WORLD_LEVEL", "5")).toBe("très difficile");
    expect(gradeMeaning(fr, "CLIMB_WORLD_LEVEL", "7")).toBe("élite");
    expect(gradeMeaning(en, "CLIMB_WORLD_LEVEL", "6")).toBe("extreme");
    expect(fontRangeFor("CLIMB_WORLD_LEVEL", "7")).toBeNull();
  });

  it("gives Patrick the scale and the rule never to compare it", () => {
    const p = { ...problem("5", "CLIMB_WORLD_LEVEL"), gymId: "cw" };
    const data: ClimbingDataset = {
      gyms: [{ id: "cw", name: "Climb World", brand: "INDEPENDENT", gradingSystem: "CLIMB_WORLD_LEVEL" }],
      problems: [p],
      attempts: attemptsFor(p, ["TOP"], daysAgo(2), "s1"),
      sessions: [session("s1", daysAgo(2), 90, { gymId: "cw" })],
    };
    const target = { grade: "6", system: "CLIMB_WORLD_LEVEL" as const };
    const ctx = buildCoachContext({
      climber: { name: "Alex", language: "fr", target },
      snapshot30: computeSnapshot(data, target, NOW, 30),
      snapshot90: computeSnapshot(data, target, NOW, 90),
      recentSessions: [],
      activeProjects: [],
      now: NOW,
    });
    const scales = ctx.gradeScales as Record<string, { ordered: string[]; unranked: string[] }>;
    expect(scales.CLIMB_WORLD_LEVEL).toEqual({ ordered: ["1", "2", "3", "4", "5", "6", "7"], unranked: [] });
    expect(ctx.definitions.climbWorldScale).toMatch(/not Font/);
    expect(ctx.definitions).not.toHaveProperty("climbingDistrictScales");
  });
});
