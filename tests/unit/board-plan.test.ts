import { describe, expect, it } from "vitest";
import type { BoardAscentFact } from "@/lib/analytics/boards";
import {
  buildBoardPlan, decodePlan, encodePlan, filledSlots, formatForMethod, gradeStep, type PlanInput,
} from "@/lib/analytics/board-plan";
import { boulderGrade } from "@/lib/grading/display";

const fact = (over: Partial<BoardAscentFact>): BoardAscentFact => ({
  id: Math.random().toString(36).slice(2), sessionId: "s1", board: "KILTER", climbKey: "a", climbName: "A", angle: 40,
  grade: "5a", gradeScale: "FONT", tries: 1, result: "SENT", isBenchmark: false, climbedAt: new Date("2026-11-10T18:00:00Z"), ...over,
});
const base: PlanInput = { board: "KILTER", angle: 40, minutes: 90, format: "progress", target: "5b", history: [], projects: [] };

describe("board plan", () => {
  it("writes boulder grades in capitals and leaves route grades alone", () => {
    expect(boulderGrade("5b")).toBe("5B");
    expect(boulderGrade("6a+")).toBe("6A+");
    expect(boulderGrade("6B+")).toBe("6B+");
    expect(boulderGrade("V4")).toBe("V4");
    expect(boulderGrade("Rouge")).toBe("Rouge");
  });

  it("steps along the board's Font scale without leaving it", () => {
    expect(gradeStep("5b", 1)).toBe("5c");
    expect(gradeStep("5c", 1)).toBe("6A");
    expect(gradeStep("4a", -3)).toBe("4a");
  });

  it("fits a 90 min progress séance: warm-up below, the target grade first, a little above, then volume", () => {
    const plan = buildBoardPlan(base);
    expect(plan.planned).toBeLessThanOrEqual(90);
    expect(plan.planned).toBeGreaterThanOrEqual(80);
    const grades = (block: string) => plan.slots.filter((s) => s.block === block).map((s) => s.grade);
    expect(grades("warmup")).toEqual(["4a", "4b", "4c", "5a"]);
    expect(grades("main").length).toBeGreaterThanOrEqual(3);
    expect(new Set(grades("main"))).toEqual(new Set(["5b"]));
    expect(new Set(grades("reach"))).toEqual(new Set(["5c"]));
    expect(new Set(grades("volume"))).toEqual(new Set(["5a"]));
  });

  it("never plans more than the time given, short or long", () => {
    for (const minutes of [30, 45, 60, 120, 180]) {
      for (const format of ["progress", "limit", "fourByFour", "volume"] as const) {
        const plan = buildBoardPlan({ ...base, minutes, format });
        expect(plan.planned).toBeLessThanOrEqual(minutes);
        expect(plan.slots.length).toBeGreaterThan(0);
      }
    }
  });

  it("follows the programme's method: limit goes above the target, 4×4 runs rounds of four below it", () => {
    expect(formatForMethod("limit-bouldering")).toBe("limit");
    expect(formatForMethod("four-by-four")).toBe("fourByFour");
    expect(formatForMethod("easy-volume")).toBe("volume");
    expect(formatForMethod(null)).toBe("progress");
    const limit = buildBoardPlan({ ...base, format: "limit" });
    expect(limit.slots.some((s) => s.block === "reach" && s.grade === "5c")).toBe(true);
    const rounds = buildBoardPlan({ ...base, format: "fourByFour" }).slots.filter((s) => s.block === "round");
    expect(rounds.length % 4).toBe(0);
    expect(new Set(rounds.map((s) => s.grade))).toEqual(new Set(["4c"]));
  });

  it("names climbs from the climber's own log: projects and unsent climbs at the target, sent climbs for the warm-up", () => {
    const history = [
      fact({ climbKey: "dalle", climbName: "Dalle", grade: "4b" }),
      fact({ climbKey: "dalle", climbName: "Dalle", grade: "4b" }),
      fact({ climbKey: "toit", climbName: "Toit", grade: "5b", result: "ATTEMPT", tries: 3 }),
      fact({ climbKey: "deja", climbName: "Déjà fait", grade: "5b" }),
      fact({ climbKey: "autre", climbName: "Autre angle", grade: "5b", angle: 30, result: "ATTEMPT" }),
    ];
    const projects = [{ board: "KILTER", angle: 40, climbName: "Projet", climbKey: "projet", grade: "5b", gradeScale: "FONT" }];
    const plan = buildBoardPlan({ ...base, history, projects });
    const named = plan.slots.filter((s) => s.suggestion).map((s) => [s.block, s.grade, s.suggestion!.name, s.suggestion!.why]);
    expect(named).toContainEqual(["warmup", "4b", "Dalle", "sent"]);
    expect(named).toContainEqual(["main", "5b", "Projet", "project"]);
    expect(named).toContainEqual(["main", "5b", "Toit", "tried"]);
    // A climb already sent at the target does not count again for the next colour; another angle is another climb.
    expect(named.map((n) => n[2])).not.toContain("Déjà fait");
    expect(named.map((n) => n[2])).not.toContain("Autre angle");
  });

  it("ticks one open slot per logged climb of the same grade", () => {
    const slots = [{ grade: "5a" }, { grade: "5b" }, { grade: "5b" }];
    expect([...filledSlots(slots, [{ grade: "5b", gradeScale: "FONT" }, { grade: "5b", gradeScale: "FONT" }, { grade: "V2", gradeScale: "V" }])]).toEqual([1, 2]);
  });

  it("round-trips a plan through the URL and refuses anything else", () => {
    const plan = buildBoardPlan({ ...base, projects: [{ board: "KILTER", angle: 40, climbName: "Arête é", climbKey: "arete e", grade: "5b", gradeScale: "FONT" }] });
    const back = decodePlan(encodePlan(plan))!;
    expect(back.format).toBe("progress");
    expect(back.slots.map((s) => [s.block, s.grade, s.suggestion?.name])).toEqual(plan.slots.map((s) => [s.block, s.grade, s.suggestion?.name]));
    expect(decodePlan("nope")).toBeNull();
    expect(decodePlan(btoa(JSON.stringify({ f: "progress", t: "5b", s: [["main", "9Z", "", "", 0]] })))).toBeNull();
  });
});
