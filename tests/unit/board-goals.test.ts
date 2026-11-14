import { describe, expect, it } from "vitest";
import { boardGoalProgress, type BoardAscentFact } from "@/lib/analytics/boards";
import { boardGoalSchema, boardProjectSchema, updateBoardGoalSchema } from "@/lib/climbing/boards";
import { boardsDictionary } from "@/lib/i18n/boards";

let n = 0;
const f = (over: Partial<BoardAscentFact>): BoardAscentFact => ({
  id: String(++n), sessionId: "s", board: "KILTER", climbKey: "c" + n, climbName: "C" + n, angle: 40,
  grade: "6C", gradeScale: "FONT", tries: 2, result: "SENT", isBenchmark: false, climbedAt: new Date(2026, 10, n), ...over,
});

describe("board level goal progress", () => {
  const goal = { board: "KILTER" as const, angle: 40, grade: "7A", gradeScale: "FONT" as const };

  it("tracks the hardest send and when the goal was reached", () => {
    const facts = [
      f({ grade: "6C+" }),
      f({ grade: "7A", climbKey: "a" }),
      f({ grade: "7A+", climbKey: "b" }),
      f({ grade: "7A", climbKey: "a" }), // a repeat of the same climb
    ];
    const p = boardGoalProgress(facts, goal);
    expect(p.best).toBe("7A+");
    expect(p.reached).toBe(true);
    expect(p.reachedAt).toEqual(facts[1].climbedAt);
    expect(p.climbsAtGoal).toBe(2);
  });

  it("ignores attempts, other boards, other angles and the other scale (never converted)", () => {
    const facts = [
      f({ grade: "7B", result: "ATTEMPT" }),
      f({ grade: "7B", board: "TENSION" }),
      f({ grade: "7B", angle: 45 }),
      f({ grade: "V8", gradeScale: "V" }),
      f({ grade: "6B" }),
    ];
    const p = boardGoalProgress(facts, goal);
    expect(p).toMatchObject({ best: "6B", reached: false, reachedAt: null, climbsAtGoal: 0 });
  });

  it("counts every angle when the goal has none", () => {
    const p = boardGoalProgress([f({ grade: "7A", angle: 25 }), f({ grade: "6A", angle: 50 })], { ...goal, angle: null });
    expect(p.reached).toBe(true);
    expect(p.best).toBe("7A");
  });

  it("works in V too, and with no climbs", () => {
    expect(boardGoalProgress([f({ grade: "V6", gradeScale: "V" })], { ...goal, grade: "V5", gradeScale: "V" }).reached).toBe(true);
    expect(boardGoalProgress([], goal)).toEqual({ best: null, reached: false, reachedAt: null, climbsAtGoal: 0 });
  });
});

describe("board goal and project input", () => {
  it("accepts a goal at an angle the board offers, or any angle", () => {
    expect(boardGoalSchema.safeParse({ board: "KILTER", angle: 40, grade: "7A", gradeScale: "FONT" }).success).toBe(true);
    expect(boardGoalSchema.safeParse({ board: "MOON", angle: null, grade: "V7", gradeScale: "V" }).success).toBe(true);
    expect(boardGoalSchema.safeParse({ board: "MOON", angle: 30, grade: "7A", gradeScale: "FONT" }).success).toBe(false);
  });
  it("refuses a grade outside the chosen scale", () => {
    expect(boardGoalSchema.safeParse({ board: "KILTER", angle: 40, grade: "V5", gradeScale: "FONT" }).success).toBe(false);
    expect(updateBoardGoalSchema.safeParse({ id: "11111111-1111-4111-8111-111111111111", grade: "7A", gradeScale: "V", status: "ACTIVE", notes: "" }).success).toBe(false);
    expect(updateBoardGoalSchema.safeParse({ id: "11111111-1111-4111-8111-111111111111", grade: "7A", gradeScale: "FONT", status: "SENT", notes: "" }).success).toBe(false);
  });
  it("lets a precise climb project carry a note", () => {
    const v = boardProjectSchema.parse({ board: "TENSION", climbName: "Test", angle: 40, grade: "7A", gradeScale: "FONT", notes: " pied haut " });
    expect(v.notes).toBe("pied haut");
    expect(boardProjectSchema.parse({ board: "TENSION", climbName: "Test", angle: 40, grade: "7A", gradeScale: "FONT" }).notes).toBe("");
  });
  it("has the goal texts in French and English", () => {
    const fr = boardsDictionary("fr");
    const en = boardsDictionary("en");
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    expect(fr.goalsTitle).toBe("Objectifs de niveau sur board");
    expect(Object.keys(en.goalStatus)).toEqual(["ACTIVE", "ABANDONED"]);
  });
});
