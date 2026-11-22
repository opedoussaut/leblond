import { describe, expect, it } from "vitest";
import { describePlan, isDateOnlyName, planLabel, shortGoal } from "@/lib/training/plan-label";

const fr = { withGoal: "{goal} · {weeks} semaines", plain: "Programme de {weeks} semaines · {n} séances par semaine" };
const sessions = [{}, {}, {}];

describe("plan labels", () => {
  it("recognises the old date-only names", () => {
    expect(isDateOnlyName("Programme du 12 novembre 2026")).toBe(true);
    expect(isDateOnlyName("Programme du 1er décembre 2026")).toBe(true);
    expect(isDateOnlyName("Programme of 12 November 2026")).toBe(true);
    expect(isDateOnlyName("Programme du 12 novembre 2026 - force")).toBe(false);
    expect(isDateOnlyName("Bloc hiver")).toBe(false);
  });

  it("shows a date-only name by its goal and length", () => {
    expect(planLabel({ name: "Programme du 12 novembre 2026", goal: "Passer 7A en bloc", weeks: 12, sessions }, fr)).toBe("Passer 7A en bloc · 12 semaines");
    expect(planLabel({ name: "Programme du 12 novembre 2026", goal: "  ", weeks: 8, sessions }, fr)).toBe("Programme de 8 semaines · 3 séances par semaine");
  });

  it("keeps a name the climber chose", () => {
    expect(planLabel({ name: "Bloc hiver", goal: "Passer 7A", weeks: 12, sessions }, fr)).toBe("Bloc hiver");
  });

  it("cuts a long goal on a word", () => {
    const long = "Améliorer la force des doigts et la mobilité des hanches pour enchaîner des blocs déversants en salle cet hiver";
    const g = shortGoal(long);
    expect(g.length).toBeLessThanOrEqual(70);
    expect(g.endsWith("…")).toBe(true);
    expect(long.startsWith(g.slice(0, -1))).toBe(true);
    expect(describePlan({ goal: long, weeks: 10, sessions }, fr).endsWith("· 10 semaines")).toBe(true);
  });
});
