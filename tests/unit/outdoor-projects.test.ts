import { describe, expect, it } from "vitest";
import {
  createOutdoorBoulderProjectSchema, fontSpelling, orNull, outdoorSiteSchema, projectPlace,
} from "@/lib/climbing/outdoor-projects";
import { createRouteProjectSchema, updateRouteProjectSchema } from "@/lib/climbing/routes";
import { boulderGrade } from "@/lib/grading/display";
import { outdoorProjectsDictionary } from "@/lib/i18n/outdoor-projects";

const GYM = "11111111-1111-4111-8111-111111111111";

describe("outdoor site input", () => {
  it("accepts an existing site or a new one", () => {
    expect(outdoorSiteSchema.safeParse({ gymId: GYM }).success).toBe(true);
    const fresh = outdoorSiteSchema.parse({ newSite: { name: "  Les Rochers  " } });
    expect(fresh).toEqual({ newSite: { name: "Les Rochers", city: "", sourceUrl: "" } });
  });
  it("refuses a too-short name, a non-https link, or both shapes at once", () => {
    expect(outdoorSiteSchema.safeParse({ newSite: { name: "X" } }).success).toBe(false);
    expect(outdoorSiteSchema.safeParse({ newSite: { name: "Crag", sourceUrl: "http://example.test" } }).success).toBe(false);
    expect(outdoorSiteSchema.safeParse({ gymId: GYM, newSite: { name: "Crag" } }).success).toBe(false);
  });
});

describe("outdoor boulder project", () => {
  const base = { site: { gymId: GYM }, name: "Le Toit", grade: "7A" };
  it("keeps the native Font grade as entered, in the scale's spelling, shown in capitals", () => {
    const v = createOutdoorBoulderProjectSchema.parse(base);
    expect(v.grade).toBe("7A");
    expect(createOutdoorBoulderProjectSchema.parse({ ...base, grade: "6b+" }).grade).toBe("6B+");
    const low = createOutdoorBoulderProjectSchema.parse({ ...base, grade: "4C" }).grade;
    expect(low).toBe("4c");
    expect(boulderGrade(low)).toBe("4C");
    expect(fontSpelling("zz")).toBe("zz");
  });
  it("refuses a route grade or an unknown grade (never converted)", () => {
    expect(createOutdoorBoulderProjectSchema.safeParse({ ...base, grade: "9z" }).success).toBe(false);
    expect(createOutdoorBoulderProjectSchema.safeParse({ ...base, grade: "V5" }).success).toBe(false);
  });
  it("defaults every detail and accepts all of them", () => {
    const v = createOutdoorBoulderProjectSchema.parse(base);
    expect(v).toMatchObject({ outdoorProblemId: null, sector: "", wallAngle: "UNKNOWN", beta: "", topoRef: "", topoUrl: "", notes: "" });
    const full = createOutdoorBoulderProjectSchema.parse({
      ...base, sector: "Secteur Est", wallAngle: "ROOF", beta: "Talon", topoRef: "Topo 2021, p. 34, n° 12",
      topoUrl: "https://example.test/topo", notes: "Printemps",
    });
    expect(full.wallAngle).toBe("ROOF");
    expect(full.topoUrl).toBe("https://example.test/topo");
  });
  it("needs a name unless picked from the topo", () => {
    expect(createOutdoorBoulderProjectSchema.safeParse({ ...base, name: "  " }).success).toBe(false);
    expect(createOutdoorBoulderProjectSchema.safeParse({ ...base, name: "", outdoorProblemId: 42 }).success).toBe(true);
  });
  it("refuses a non-https topo link", () => {
    expect(createOutdoorBoulderProjectSchema.safeParse({ ...base, topoUrl: "javascript:alert(1)" }).success).toBe(false);
  });
});

describe("route project indoors or outdoors", () => {
  const base = { routeName: "La Fissure", grade: "6b+", goalStyle: "LEAD", notes: "" };
  it("takes a gym, or an outdoor site — exactly one", () => {
    expect(createRouteProjectSchema.safeParse({ ...base, gymId: GYM }).success).toBe(true);
    expect(createRouteProjectSchema.safeParse({ ...base, site: { newSite: { name: "Saffres" } } }).success).toBe(true);
    expect(createRouteProjectSchema.safeParse(base).success).toBe(false);
    expect(createRouteProjectSchema.safeParse({ ...base, gymId: GYM, site: { gymId: GYM } }).success).toBe(false);
  });
  it("keeps French grades lowercase and refuses Font grades", () => {
    expect(createRouteProjectSchema.parse({ ...base, gymId: GYM, grade: "6B+" }).grade).toBe("6b+");
    expect(createRouteProjectSchema.safeParse({ ...base, gymId: GYM, grade: "8C+" }).data?.grade).toBe("8c+");
    expect(createRouteProjectSchema.safeParse({ ...base, gymId: GYM, grade: "V5" }).success).toBe(false);
  });
  it("carries the outdoor details", () => {
    const v = createRouteProjectSchema.parse({
      ...base, site: { gymId: GYM }, sector: "Dalles", wallAngle: "SLAB", beta: "Repos au 3e", topoRef: "p. 12", topoUrl: "https://example.test",
    });
    expect(v).toMatchObject({ sector: "Dalles", wallAngle: "SLAB", topoRef: "p. 12" });
  });
  it("updates name and details, each optional", () => {
    const id = GYM;
    expect(updateRouteProjectSchema.safeParse({ id, grade: "7a", goalStyle: "LEAD", status: "ACTIVE", notes: "" }).success).toBe(true);
    const v = updateRouteProjectSchema.parse({ id, routeName: "Nouveau nom", grade: "7a", goalStyle: "LEAD", status: "ACTIVE", notes: "",
      sector: "Est", wallAngle: "OVERHANG", beta: "", topoRef: "", topoUrl: "" });
    expect(v.routeName).toBe("Nouveau nom");
    expect(updateRouteProjectSchema.safeParse({ id, routeName: "", grade: "7a", goalStyle: "LEAD", status: "ACTIVE", notes: "" }).success).toBe(false);
  });
});

describe("helpers", () => {
  it("writes where a project is", () => {
    expect(projectPlace("Saffres", "Dalles")).toBe("Saffres · Dalles");
    expect(projectPlace("Saffres", "  ")).toBe("Saffres");
    expect(projectPlace(null, null)).toBe("");
  });
  it("stores empty strings as no value", () => {
    expect(orNull("  ")).toBeNull();
    expect(orNull(" a ")).toBe("a");
    expect(orNull(undefined)).toBeNull();
  });
  it("has French and English texts for every key and error", () => {
    const fr = outdoorProjectsDictionary("fr");
    const en = outdoorProjectsDictionary("en");
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    expect(Object.keys(en.errors).sort()).toEqual(Object.keys(fr.errors).sort());
    expect(fr.outdoor).toBe("En extérieur");
  });
});
