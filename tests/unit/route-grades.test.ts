import { describe, expect, it } from "vitest";
import { FRENCH_ROUTE_GRADES, isFrenchRouteGrade } from "@/lib/grading/route-grades";
import { isValidGrade } from "@/lib/grading";

describe("independent French route grading", () => {
  it("accepts real sport-climbing grade labels without assuming Font equivalents", () => {
    expect(FRENCH_ROUTE_GRADES).toContain("6a+");
    expect(FRENCH_ROUTE_GRADES).toContain("7b");
    expect(isFrenchRouteGrade("6b+")).toBe(true);
    expect(isFrenchRouteGrade("9c")).toBe(true);
    expect(isFrenchRouteGrade("6B+")).toBe(false); // Font-style uppercase is not a route grade.
    expect(isFrenchRouteGrade("7d")).toBe(false);
    expect(isValidGrade("FONT", "6B+")).toBe(true); // Boulder scale is still separate.
  });
});
