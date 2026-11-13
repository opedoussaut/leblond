import { describe, expect, it } from "vitest";
import { boardCoachSummary, boardPyramids, climbHistory, repeatIds, summarizeBoardSession, type BoardAscentFact } from "@/lib/analytics/boards";
import { importBatches, parseBoardLibCsv, parseCsv } from "@/lib/climbing/boardlib-csv";
import {
  boardAngles, clampAngle, climbKey, logBoardAscentSchema, normaliseBoardGrade, startBoardSessionSchema,
} from "@/lib/climbing/boards";

const fact = (over: Partial<BoardAscentFact>): BoardAscentFact => ({
  id: Math.random().toString(36).slice(2), sessionId: "s1", board: "KILTER", climbKey: "arete", climbName: "Arête", angle: 40,
  grade: "6B+", gradeScale: "FONT", tries: 1, result: "SENT", isBenchmark: false, climbedAt: new Date("2026-11-10T18:00:00Z"), ...over,
});

describe("boards", () => {
  it("offers 5° steps from 0° to 70° on Kilter and Tension, 25° or 40° on a MoonBoard", () => {
    expect(boardAngles("KILTER")).toHaveLength(15);
    expect(boardAngles("KILTER").every((a) => a % 5 === 0)).toBe(true);
    expect(boardAngles("TENSION").at(-1)).toBe(70);
    expect(boardAngles("MOON")).toEqual([25, 40]);
    expect(clampAngle("MOON", 45)).toBe(40);
  });

  it("keeps a grade as written in its own scale and never converts it", () => {
    expect(normaliseBoardGrade("FONT", "6b+")).toBe("6B+");
    expect(normaliseBoardGrade("V", "v4")).toBe("V4");
    expect(normaliseBoardGrade("FONT", "V4")).toBeNull();
  });

  it("treats accents, case and spaces as the same climb", () => {
    expect(climbKey("  Arête   du Lundi ")).toBe(climbKey("arete du lundi"));
  });

  it("refuses an angle the board does not offer and a flash after several tries", () => {
    expect(startBoardSessionSchema.safeParse({ board: "KILTER", layout: "Original", angle: 42, gymId: null }).success).toBe(false);
    expect(startBoardSessionSchema.safeParse({ board: "KILTER", layout: "Original", angle: 40, gymId: null }).success).toBe(true);
    const climb = { sessionId: crypto.randomUUID(), clientId: crypto.randomUUID(), climbName: "X", grade: "6A", gradeScale: "FONT",
      angle: 40, tries: 2, result: "FLASH", isBenchmark: false, isMirror: false };
    expect(logBoardAscentSchema.safeParse(climb).success).toBe(false);
    expect(logBoardAscentSchema.safeParse({ ...climb, tries: 1 }).success).toBe(true);
    expect(logBoardAscentSchema.safeParse({ ...climb, tries: 1, grade: "V3" }).success).toBe(false);
  });
});

describe("board analytics", () => {
  it("summarises a séance with the hardest send in each scale, never mixed", () => {
    const s = summarizeBoardSession([
      fact({ grade: "6B+", result: "FLASH" }), fact({ climbKey: "b", grade: "6C", result: "ATTEMPT", tries: 4 }),
      fact({ climbKey: "c", grade: "V5", gradeScale: "V", result: "SENT", tries: 3 }),
    ]);
    expect(s).toMatchObject({ climbs: 3, sends: 2, flashes: 1, tries: 8 });
    expect(s.top).toEqual([{ grade: "6B+", scale: "FONT" }, { grade: "V5", scale: "V" }]);
  });

  it("recognises repeats and the history of a climb, per board and angle", () => {
    const first = fact({ id: "a", climbedAt: new Date("2026-11-01T18:00:00Z") });
    const again = fact({ id: "b", sessionId: "s2", climbedAt: new Date("2026-11-08T18:00:00Z") });
    const steeper = fact({ id: "c", angle: 45, sessionId: "s2" });
    expect([...repeatIds([again, first, steeper])]).toEqual(["b"]);
    expect(climbHistory([first, again, steeper], first)).toMatchObject({ sessions: 2, sent: true, tries: 2 });
  });

  it("builds one pyramid per board, angle and scale, counting a flash only on the first go", () => {
    const pyramids = boardPyramids([
      fact({ id: "1", climbKey: "a", grade: "6B", result: "ATTEMPT", tries: 3, climbedAt: new Date("2026-11-01T18:00:00Z") }),
      fact({ id: "2", climbKey: "a", grade: "6B", result: "FLASH", climbedAt: new Date("2026-11-02T18:00:00Z") }),
      fact({ id: "3", climbKey: "b", grade: "6C", result: "FLASH" }),
      fact({ id: "4", climbKey: "c", grade: "6C", result: "SENT", angle: 30 }),
    ]);
    expect(pyramids.map((p) => p.angle)).toEqual([30, 40]);
    const at40 = pyramids.find((p) => p.angle === 40)!;
    expect(at40.top).toBe("6C");
    expect(at40.rows).toEqual([{ grade: "6C", sends: 1, flashes: 1 }, { grade: "6B", sends: 1, flashes: 0 }]);
  });

  it("gives Patrick bounded facts only", () => {
    const summary = boardCoachSummary([fact({})], new Date("2026-11-13T12:00:00Z"));
    expect(summary).toMatchObject({ windowDays: 60, sessions: 1, climbsSent: 1 });
  });
});

describe("BoardLib import", () => {
  const csv = [
    "board,angle,climb_name,date,logged_grade,displayed_grade,is_benchmark,tries,is_mirror,is_ascent,comment",
    "kilter,40,\"Arête, du lundi\",2026-04-02 18:42:11,6b+/V4,6b+/V4,True,3,False,True,",
    "kilter,40,Réglette 40,2026-04-02 19:01:00,,6c/V5,False,5,False,False,\"tough \"\"crimp\"\"\"",
    "kilter,95,Too steep,2026-04-02 19:05:00,6a/V3,6a/V3,False,1,False,True,",
    "woody,40,Unknown,2026-04-02 19:06:00,6a/V3,6a/V3,False,1,False,True,",
    "tension,30,Mirror me,2026-04-03,V3,V3,False,1,True,True,",
  ].join("\n");

  it("reads quoted CSV fields", () => {
    expect(parseCsv('a,"b, c","d ""e"""\n')).toEqual([["a", "b, c", 'd "e"']]);
  });

  it("reads climbs, keeps the Font side, and rejects lines it cannot trust", () => {
    const r = parseBoardLibCsv(csv);
    expect(r.missingColumns).toEqual([]);
    expect(r.rows.map((x) => [x.name, x.grade, x.gradeScale, x.result])).toEqual([
      ["Arête, du lundi", "6B+", "FONT", "SENT"],
      ["Réglette 40", "6C", "FONT", "ATTEMPT"],
      ["Mirror me", "V3", "V", "FLASH"],
    ]);
    expect(r.rows[1].notes).toBe('tough "crimp"');
    expect(r.rows[2].isMirror).toBe(true);
    expect(r.rejected.map((x) => x.reason)).toEqual(["angle", "board"]);
  });

  it("gives every line a stable reference, so a second import adds nothing", () => {
    expect(parseBoardLibCsv(csv).rows.map((r) => r.ref)).toEqual(parseBoardLibCsv(csv).rows.map((r) => r.ref));
  });

  it("says which columns are missing instead of guessing", () => {
    expect(parseBoardLibCsv("name,grade\nA,6A").missingColumns).toEqual(expect.arrayContaining(["date", "angle", "board"]));
  });

  it("never splits a day between two requests when it fits", () => {
    const rows = parseBoardLibCsv(csv).rows;
    const batches = importBatches(rows, 2);
    for (const b of batches) expect(b.length).toBeLessThanOrEqual(2);
    expect(batches.flat()).toHaveLength(rows.length);
    expect(batches[0].every((r) => r.date === "2026-04-02")).toBe(true);
  });
});
