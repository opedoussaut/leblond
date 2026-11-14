import { describe, expect, it } from "vitest";
import { gradePyramid, mainSystem, weeklyHardest } from "@/lib/analytics/charts";
import type { AttemptFact, ProblemFact } from "@/lib/analytics/types";

const problem = (id: string, grade: string, system: ProblemFact["nativeGradeSystem"] = "FONT"): ProblemFact =>
  ({ id, gymId: "g", nativeGrade: grade, nativeGradeSystem: system, wallAngle: "VERTICAL", tags: [] } as unknown as ProblemFact);
let n = 0;
const attempt = (problemId: string, result: AttemptFact["result"], at: string): AttemptFact =>
  ({ id: String(++n), problemId, sessionId: "s", result, attemptNumber: 1, createdAt: new Date(at) });

const now = new Date("2026-11-14T12:00:00Z");
const problems = [problem("a", "5b"), problem("b", "6A"), problem("c", "5c"), problem("d", "6B"), problem("x", "BLUE", "ARKOSE_COLOR")];
const attempts = [
  attempt("a", "FLASH", "2026-11-03T18:00:00Z"),
  attempt("c", "ATTEMPT", "2026-11-04T18:00:00Z"),
  attempt("c", "TOP", "2026-11-11T18:00:00Z"),
  attempt("b", "TOP", "2026-11-12T18:00:00Z"),
  attempt("d", "ATTEMPT", "2026-11-12T18:30:00Z"),
  attempt("x", "TOP", "2026-11-12T19:00:00Z"),
];

describe("progress diagrams", () => {
  it("keeps the hardest send of each week, in the week of the first send, on the chosen system only", () => {
    expect(weeklyHardest(problems, attempts, "FONT", now, 90)).toEqual([
      { weekStart: "2026-11-02", grade: "5b", score: expect.any(Number), sends: 1 },
      { weekStart: "2026-11-09", grade: "6A", score: expect.any(Number), sends: 2 },
    ]);
  });

  it("leaves out sends before the period", () => {
    expect(weeklyHardest(problems, attempts, "FONT", now, 7).map((p) => p.weekStart)).toEqual(["2026-11-09"]);
  });

  it("builds the pyramid hardest first: sent, flashed and still tried", () => {
    expect(gradePyramid(problems, attempts, "FONT", now, 90).map((r) => [r.grade, r.sent, r.flashed, r.tried])).toEqual([
      ["6B", 0, 0, 1], ["6A", 1, 0, 0], ["5c", 1, 0, 0], ["5b", 1, 1, 0],
    ]);
  });

  it("picks the system most problems were tried on", () => {
    expect(mainSystem(problems, attempts, ["FONT", "ARKOSE_COLOR"])).toBe("FONT");
    expect(mainSystem(problems, [], ["FONT"])).toBeNull();
  });
});
