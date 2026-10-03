import { describe, expect, it } from "vitest";
import {
  ARKOSE_GRADES,
  CLIMBING_DISTRICT_GRADES,
  compareGrades,
  FONT_SCALE,
  gradeToScore,
  isMysteryGrade,
  isReliable,
  isValidGrade,
  maxGrade,
  nextGrade,
  previousGrade,
  resolveNormalized,
  scoreToGrade,
} from "@/lib/grading";
import { allowedSystemsForBrand } from "@/lib/climbing/types";

describe("Font scale ordering", () => {
  it("contains the full required scale in order", () => {
    expect(FONT_SCALE[0]).toBe("1a");
    expect(FONT_SCALE.at(-1)).toBe("9A");
    // 1a…5c (15 lettered grades) + 6A…8C+ (18) + 9A
    expect(FONT_SCALE).toHaveLength(34);
    expect(FONT_SCALE.indexOf("6A")).toBe(FONT_SCALE.indexOf("5c") + 1);
  });

  it("orders grades with + correctly", () => {
    expect(compareGrades("FONT", "6C", "6C+")).toBeLessThan(0);
    expect(compareGrades("FONT", "6C+", "7A")).toBeLessThan(0);
    expect(compareGrades("FONT", "7A", "6C+")).toBeGreaterThan(0);
    expect(compareGrades("FONT", "4c", "5a")).toBeLessThan(0);
    expect(compareGrades("FONT", "5c", "6A")).toBeLessThan(0);
    expect(compareGrades("FONT", "7A", "7A")).toBe(0);
  });

  it("round-trips score ↔ grade", () => {
    for (const g of FONT_SCALE) expect(scoreToGrade("FONT", gradeToScore("FONT", g)!)).toBe(g);
  });

  it("walks next/previous and stops at the ends", () => {
    expect(nextGrade("FONT", "6C+")).toBe("7A");
    expect(previousGrade("FONT", "7A")).toBe("6C+");
    expect(nextGrade("FONT", "9A")).toBeNull();
    expect(previousGrade("FONT", "1a")).toBeNull();
    expect(nextGrade("FONT", "5c")).toBe("6A");
  });

  it("rejects unknown values", () => {
    expect(gradeToScore("FONT", "6D")).toBeNull();
    expect(isValidGrade("FONT", "6d")).toBe(false);
    // Case matters: lower-case letters below 6A, upper-case from 6A.
    expect(isValidGrade("FONT", "6a")).toBe(false);
    expect(isValidGrade("FONT", "5C")).toBe(false);
    // The old indoor-style notation is no longer on the scale.
    expect(isValidGrade("FONT", "4+")).toBe(false);
  });
});

describe("Arkose colour ordering", () => {
  it("follows Yellow → Green → Blue → Red → Black → Purple", () => {
    expect(ARKOSE_GRADES.map((g) => g.id)).toEqual(["YELLOW", "GREEN", "BLUE", "RED", "BLACK", "PURPLE"]);
    expect(compareGrades("ARKOSE_COLOR", "RED", "BLACK")).toBeLessThan(0);
    expect(nextGrade("ARKOSE_COLOR", "BLACK")).toBe("PURPLE");
    expect(nextGrade("ARKOSE_COLOR", "PURPLE")).toBeNull();
  });

  it("does not contain Climbing District-only colours", () => {
    expect(isValidGrade("ARKOSE_COLOR", "PINK")).toBe(false);
    expect(isValidGrade("ARKOSE_COLOR", "WHITE")).toBe(false);
  });

  it("is never comparable with another system's grade of the same name", () => {
    // compareGrades only works within one system; RED exists in both but scores differ.
    expect(gradeToScore("ARKOSE_COLOR", "RED")).not.toBe(gradeToScore("CLIMBING_DISTRICT_COLOR", "RED"));
  });
});

describe("Climbing District colour ordering", () => {
  it("follows White → … → Purple, then Pink as mystery", () => {
    expect(CLIMBING_DISTRICT_GRADES.map((g) => g.id)).toEqual([
      "WHITE",
      "YELLOW",
      "ORANGE",
      "GREEN",
      "BLUE",
      "RED",
      "BLACK",
      "PURPLE",
      "PINK",
    ]);
    expect(compareGrades("CLIMBING_DISTRICT_COLOR", "GREEN", "BLUE")).toBeLessThan(0);
    expect(nextGrade("CLIMBING_DISTRICT_COLOR", "BLACK")).toBe("PURPLE");
  });
});

describe("Pink mystery handling", () => {
  it("is a valid Climbing District grade", () => {
    expect(isValidGrade("CLIMBING_DISTRICT_COLOR", "PINK")).toBe(true);
    expect(isMysteryGrade("CLIMBING_DISTRICT_COLOR", "PINK")).toBe(true);
  });

  it("has no ordinal and is never compared, stepped or maxed", () => {
    expect(gradeToScore("CLIMBING_DISTRICT_COLOR", "PINK")).toBeNull();
    expect(compareGrades("CLIMBING_DISTRICT_COLOR", "PINK", "BLUE")).toBeNull();
    expect(nextGrade("CLIMBING_DISTRICT_COLOR", "PINK")).toBeNull();
    expect(maxGrade("CLIMBING_DISTRICT_COLOR", ["BLUE", "PINK", "GREEN"])).toBe("BLUE");
    expect(maxGrade("CLIMBING_DISTRICT_COLOR", ["PINK"])).toBeNull();
  });

  it("can carry a user-revealed Font estimate without changing the native grade", () => {
    const est = resolveNormalized({
      nativeGrade: "PINK",
      nativeGradeSystem: "CLIMBING_DISTRICT_COLOR",
      normalizedGrade: "6C",
      normalizedGradeSystem: "FONT",
      normalizationConfidence: 0.6,
      normalizationSource: "USER_ESTIMATE",
    });
    expect(est).toEqual({ grade: "6C", system: "FONT", confidence: 0.6, source: "USER_ESTIMATE" });
  });
});

describe("Normalisation", () => {
  it("never derives a Font grade from a colour by itself", () => {
    expect(resolveNormalized({ nativeGrade: "RED", nativeGradeSystem: "ARKOSE_COLOR" })).toBeNull();
  });

  it("treats native Font grades as certain", () => {
    expect(resolveNormalized({ nativeGrade: "6B+", nativeGradeSystem: "FONT" })).toMatchObject({
      grade: "6B+",
      confidence: 1,
      source: "FONT_NATIVE",
    });
  });

  it("flags low-confidence estimates as unreliable", () => {
    const rough = resolveNormalized({
      nativeGrade: "RED",
      nativeGradeSystem: "ARKOSE_COLOR",
      normalizedGrade: "6C",
      normalizedGradeSystem: "FONT",
      normalizationConfidence: 0.3,
    });
    expect(rough).not.toBeNull();
    expect(isReliable(rough)).toBe(false);
  });

  it("ignores invalid estimates", () => {
    expect(
      resolveNormalized({
        nativeGrade: "RED",
        nativeGradeSystem: "ARKOSE_COLOR",
        normalizedGrade: "6D",
        normalizedGradeSystem: "FONT",
        normalizationConfidence: 0.9,
      }),
    ).toBeNull();
  });
});

describe("Gym brand grading", () => {
  it("locks Arkose and Climbing District to their native systems", () => {
    expect(allowedSystemsForBrand("ARKOSE")).toEqual(["ARKOSE_COLOR"]);
    expect(allowedSystemsForBrand("CLIMBING_DISTRICT")).toEqual(["CLIMBING_DISTRICT_COLOR"]);
    expect(allowedSystemsForBrand("INDEPENDENT")).toEqual(["FONT", "CUSTOM_COLOR"]);
  });
});
