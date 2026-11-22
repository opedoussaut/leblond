import { describe, expect, it } from "vitest";
import { areasDictionary } from "@/lib/i18n/areas";
import { planRow, trainingPlanSchema, phaseAt, phasesOf } from "@/lib/training/plans";
import {
  PROGRAMME_CATALOGUE, catalogueChoices, catalogueDaysPerWeek, catalogueFacts, cataloguePlan, catalogueProgramme, catalogueWeeks,
} from "@/lib/training/programme-catalogue";

describe("programme catalogue", () => {
  it("offers several programmes with unique ids, at different lengths and weekly loads", () => {
    expect(PROGRAMME_CATALOGUE.length).toBeGreaterThanOrEqual(4);
    expect(new Set(PROGRAMME_CATALOGUE.map((p) => p.id)).size).toBe(PROGRAMME_CATALOGUE.length);
    expect(new Set(PROGRAMME_CATALOGUE.map(catalogueWeeks)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(PROGRAMME_CATALOGUE.map(catalogueDaysPerWeek))).toEqual(new Set([2, 3, 4]));
  });

  it("builds plans that pass the save schema in both languages", () => {
    for (const p of PROGRAMME_CATALOGUE) {
      for (const locale of ["fr", "en"] as const) {
        const plan = cataloguePlan(p, locale);
        const parsed = trainingPlanSchema.safeParse(plan);
        expect(parsed.success, `${p.id} (${locale}): ${parsed.error?.message}`).toBe(true);
        expect(planRow(plan).weeks).toBe(catalogueWeeks(p));
      }
    }
  });

  it("every programme ends with a lighter week and has a source", () => {
    for (const p of PROGRAMME_CATALOGUE) {
      expect(p.phases.at(-1)?.kind, p.id).toBe("DELOAD");
      expect(p.source.url, p.id).toMatch(/^https:\/\//);
      expect(p.summary.fr.length, p.id).toBeLessThanOrEqual(160);
    }
  });

  it("follows the phases week by week", () => {
    const p = catalogueProgramme("horst-321-6w-3d")!;
    const plan = cataloguePlan(p, "fr");
    const phases = phasesOf(plan);
    expect(phaseAt(phases, 1).phase.name).toBe("Force et puissance");
    expect(phaseAt(phases, 4).phase.name).toBe("Résistance");
    expect(phaseAt(phases, 6).phase.kind).toBe("DELOAD");
    // Sessions come sorted by day.
    expect(plan.sessions.map((s) => s.day)).toEqual([...plan.sessions.map((s) => s.day)].sort((a, b) => a - b));
  });

  it("describes each programme in one line of facts", () => {
    const fr = areasDictionary("fr").programmes;
    const en = areasDictionary("en").programmes;
    expect(catalogueFacts(catalogueProgramme("horst-321-6w-3d")!, fr)).toBe("6 semaines · 3 jours par semaine · intermédiaire à confirmé · bloc");
    expect(catalogueFacts(catalogueProgramme("foundations-4w-2d")!, en)).toBe("4 weeks · 2 days a week · beginner to intermediate · bouldering and routes");
    expect(catalogueChoices("en", en).find((c) => c.id === "fingers-lopez-8w-4d")?.facts).toContain("8 weeks · 4 days a week");
    expect(catalogueProgramme("nope")).toBeUndefined();
  });
});

describe("template profile (programme followed without an assessment)", () => {
  it("counts home sessions off the wall, leaves optional ones out, and reads the discipline from the gyms", async () => {
    const { templateProfile } = await import("@/lib/training/programme");
    const fingers = cataloguePlan(catalogueProgramme("fingers-lopez-8w-4d")!, "fr");
    expect(templateProfile(fingers.sessions)).toMatchObject({ availability: { climbingPerWeek: 2, offWallPerWeek: 2 }, discipline: "BOULDER" });
    const route = cataloguePlan(catalogueProgramme("horst-4321-10w-3d")!, "fr");
    expect(templateProfile(route.sessions)).toMatchObject({ availability: { climbingPerWeek: 3, offWallPerWeek: 0 }, discipline: "ROUTE" });
    const both = cataloguePlan(catalogueProgramme("foundations-4w-2d")!, "fr");
    expect(templateProfile(both.sessions).discipline).toBe("BOULDER");
  });
});
