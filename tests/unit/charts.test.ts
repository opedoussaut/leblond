import { describe, expect, it } from "vitest";
import { gradePyramid, isMobilityWork, mainSystem, topLevelRates, weeklyHardest, weeklyTotals } from "@/lib/analytics/charts";
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

  it("follows the send rate at the two hardest grades sent, week by week, scale by scale", () => {
    const series = topLevelRates(problems, attempts, ["FONT", "ARKOSE_COLOR"], now, 12);
    const font = series.find((s) => s.system === "FONT")!;
    // 6B was tried but never sent: the two grades are 6A (hardest sent) and 5c (next one tried).
    expect(font.grades.map((g) => g.grade)).toEqual(["6A", "5c"]);
    expect(font.weeks).toHaveLength(12);
    expect(font.weeks.slice(-2)).toEqual([
      { weekStart: "2026-11-02", tried: 1, sent: 0 },
      { weekStart: "2026-11-09", tried: 2, sent: 2 },
    ]);
    const [a6, c5] = font.grades;
    expect(a6.recent).toEqual({ tried: 1, sent: 1, rate: 1 });
    // c was tried on 4 Nov and sent on 11 Nov: one problem over the two weeks, sent.
    expect(c5.rolling.slice(-3)).toEqual([null, 0, 1]);
    expect(a6.rolling.slice(-2)).toEqual([null, 1]);
    expect(font.direction).toBe("insufficient");
    expect(series.find((s) => s.system === "ARKOSE_COLOR")!.grades.map((g) => g.grade)).toEqual(["BLUE"]);
    expect(topLevelRates(problems, [attempt("d", "ATTEMPT", "2026-11-12T18:00:00Z")], ["FONT"], now, 12)).toEqual([]);
  });

  it("judges each grade on its own: a move at the hard grade is not hidden by the easier one", () => {
    // 6A+: 2/6 then 5/6. 6A: 5/6 both times.
    const hard = Array.from({ length: 12 }, (_, i) => problem(`h${i}`, "6A+"));
    const easy = Array.from({ length: 12 }, (_, i) => problem(`e${i}`, "6A"));
    const at = (list: ProblemFact[], sent: number, when: string) => list.map((p, i) => attempt(p.id, i < sent ? "TOP" : "ATTEMPT", when));
    const log = [
      ...at(hard.slice(0, 6), 2, "2026-10-07T18:00:00Z"), ...at(hard.slice(6), 5, "2026-11-10T18:00:00Z"),
      ...at(easy.slice(0, 6), 5, "2026-10-07T18:00:00Z"), ...at(easy.slice(6), 5, "2026-11-10T18:00:00Z"),
    ];
    const [s] = topLevelRates([...hard, ...easy], log, ["FONT"], now, 12);
    const [h, e] = s.grades;
    expect([h.grade, e.grade]).toEqual(["6A+", "6A"]);
    expect(h.previous).toEqual({ tried: 6, sent: 2, rate: 2 / 6 });
    expect(h.recent.rate).toBeCloseTo(5 / 6);
    expect(h.direction).toBe("up");
    expect(e.direction).toBe("flat");
    expect(s.direction).toBe("up");
    // One grade up and one down: no single direction.
    const mixed = [...log.filter((x) => !x.problemId.startsWith("e")),
      ...at(easy.slice(0, 6), 5, "2026-10-07T18:00:00Z"), ...at(easy.slice(6), 1, "2026-11-10T18:00:00Z")];
    expect(topLevelRates([...hard, ...easy], mixed, ["FONT"], now, 12)[0].direction).toBe("flat");
    // Too short a period to hold both windows: no direction.
    expect(topLevelRates([...hard, ...easy], log, ["FONT"], now, 4)[0].direction).toBe("insufficient");
  });

  it("picks the system most problems were tried on", () => {
    expect(mainSystem(problems, attempts, ["FONT", "ARKOSE_COLOR"])).toBe("FONT");
    expect(mainSystem(problems, [], ["FONT"])).toBeNull();
  });
});

describe("weekly totals", () => {
  it("counts sessions and minutes per week, empty weeks kept, nothing after today", () => {
    const weeks = weeklyTotals([
      { date: "2026-11-03", minutes: 45 }, { date: "2026-11-05", minutes: null },
      { date: "2026-11-12", minutes: 60 }, { date: "2026-11-15", minutes: 30 }, { date: "2026-09-01", minutes: 90 },
    ], "2026-11-14", 3);
    expect(weeks).toEqual([
      { weekStart: "2026-10-26", sessions: 0, minutes: 0 },
      { weekStart: "2026-11-02", sessions: 2, minutes: 45 },
      { weekStart: "2026-11-09", sessions: 1, minutes: 60 },
    ]);
  });
});

describe("isMobilityWork", () => {
  it("follows the session's own method when it has one", () => {
    expect(isMobilityWork("hip-mobility", [])).toBe(true);
    expect(isMobilityWork("mobility", [])).toBe(true);
    expect(isMobilityWork("max-hangs", ["mobility", "mobility"])).toBe(false);
  });
  it("classifies a coach session by its exercises", () => {
    expect(isMobilityWork(null, ["mobility", "mobility", null])).toBe(true);
    expect(isMobilityWork(null, ["mobility", null, null])).toBe(false);
    expect(isMobilityWork(null, [])).toBe(false);
  });
});
