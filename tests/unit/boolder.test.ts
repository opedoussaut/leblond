import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  bleauInfoUrl,
  boolderProblemUrl,
  buildCatalogue,
  filterProblems,
  mapBoolderGrade,
  mapSteepness,
  searchable,
  type BoolderDataset,
} from "@/lib/integrations/outdoor/boolder";
import { FONT_SCALE } from "@/lib/grading";

// Real Boolder rows (© Boolder, CC BY 4.0) — see the fixture's _attribution.
const sample = JSON.parse(readFileSync("tests/fixtures/boolder-sample.json", "utf8")) as BoolderDataset;

describe("Boolder grade mapping", () => {
  it("keeps letters below 6A and upper-cases from 6A", () => {
    expect(mapBoolderGrade("1a")).toBe("1a");
    expect(mapBoolderGrade("4b")).toBe("4b");
    expect(mapBoolderGrade("5c")).toBe("5c");
    expect(mapBoolderGrade("6a")).toBe("6A");
    expect(mapBoolderGrade("6a+")).toBe("6A+");
    expect(mapBoolderGrade("7c+")).toBe("7C+");
    expect(mapBoolderGrade("9a")).toBe("9A");
  });

  it("maps every grade Boolder uses onto the scale", () => {
    const boolderGrades = ["1a", "1b", "1c", "2a", "2b", "2c", "3a", "3b", "3c", "4a", "4b", "4c", "5a", "5b", "5c",
      "6a", "6a+", "6b", "6b+", "6c", "6c+", "7a", "7a+", "7b", "7b+", "7c", "7c+", "8a", "8a+", "8b", "8b+", "8c", "8c+", "9a"];
    expect(boolderGrades.map(mapBoolderGrade)).toEqual([...FONT_SCALE]);
  });

  it("rejects empty or off-scale grades instead of guessing", () => {
    for (const g of ["", "  ", null, undefined, "4+", "5c+", "6d", "9b", "10a", "6A++", "4"]) expect(mapBoolderGrade(g)).toBeNull();
  });
});

describe("Boolder steepness mapping", () => {
  it("maps wall shapes and leaves direction/unspecified as UNKNOWN", () => {
    expect(mapSteepness("slab")).toBe("SLAB");
    expect(mapSteepness("wall")).toBe("VERTICAL");
    expect(mapSteepness("overhang")).toBe("OVERHANG");
    expect(mapSteepness("roof")).toBe("ROOF");
    expect(mapSteepness("traverse")).toBe("UNKNOWN");
    expect(mapSteepness("other")).toBe("UNKNOWN");
    expect(mapSteepness(null)).toBe("UNKNOWN");
  });
});

describe("buildCatalogue on real Boolder rows", () => {
  const c = buildCatalogue(sample);

  it("imports the sample areas with cluster names and tags", () => {
    expect(c.areas.map((a) => a.name)).toEqual(["Rocher Canon", "Cul de Chien"]);
    expect(c.areas[0].cluster_name).toBeTruthy();
    expect(c.areas[0].tags).toContain("popular");
    expect(c.areas[1].warning_en).toMatch(/closed/i);
  });

  it("skips the empty-grade problem and reports why", () => {
    expect(c.problems).toHaveLength(sample.problems.length - 1);
    expect(c.skipped).toEqual([{ kind: "problem", id: 28932, reason: "unknownArea" }]);
  });

  it("stores only valid lettered Font grades", () => {
    for (const p of c.problems) expect(FONT_SCALE as readonly string[]).toContain(p.grade);
    expect(c.problems.some((p) => /^[1-5][abc]$/.test(p.grade))).toBe(true);
    expect(c.problems.some((p) => /^[6-9][ABC]\+?$/.test(p.grade))).toBe(true);
  });

  it("recomputes area counts from what was imported", () => {
    const counts = new Map<number, number>();
    for (const p of c.problems) counts.set(p.area_id, (counts.get(p.area_id) ?? 0) + 1);
    for (const a of c.areas) expect(a.problems_count).toBe(counts.get(a.id) ?? 0);
  });

  it("drops links to circuits that are not in the dataset", () => {
    const circuitIds = new Set(c.circuits.map((x) => x.id));
    for (const p of c.problems) {
      if (p.circuit_id != null) expect(circuitIds.has(p.circuit_id)).toBe(true);
      else expect(p.circuit_number).toBeNull();
    }
  });

  it("keeps the problem identity, position and variant link", () => {
    const raw = sample.problems.find((p) => p.parent_id != null);
    if (raw) expect(c.problems.find((p) => p.id === raw.id)?.parent_id).toBe(raw.parent_id);
    const p = c.problems[0];
    const r = sample.problems.find((x) => x.id === p.id)!;
    expect([p.latitude, p.longitude, p.sit_start]).toEqual([r.latitude, r.longitude, r.sit_start === 1]);
  });

  it("skips invalid rows without throwing", () => {
    const broken = buildCatalogue({
      areas: [{ ...sample.areas[0], id: 999, name: " " }],
      clusters: [],
      circuits: [],
      problems: [{ ...sample.problems[0], id: 1, area_id: sample.areas[0].id, latitude: Number.NaN }],
    });
    expect(broken.areas).toHaveLength(0);
    expect(broken.skipped.map((s) => s.reason).sort()).toEqual(["missingName", "unknownArea"]);
  });
});

describe("picker search", () => {
  const list = buildCatalogue(sample).problems;

  it("normalises like Boolder's name_searchable", () => {
    expect(searchable("L'Arête de Gauche")).toBe("laretedegauche");
  });

  it("finds a circuit number exactly", () => {
    const yellow7 = filterProblems(list, { query: "7", circuitColor: "yellow" });
    expect(yellow7[0].circuit_number).toBe("7");
    expect(yellow7[0].circuit_color).toBe("yellow");
  });

  it("filters by grade and orders circuits by number", () => {
    const red = filterProblems(list, { circuitColor: "red" });
    const numbers = red.map((p) => Number(p.circuit_number));
    expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
    const g = red[0].grade;
    expect(filterProblems(list, { grade: g }).every((p) => p.grade === g)).toBe(true);
  });

  it("matches names regardless of accents and case", () => {
    const named = list.find((p) => p.circuit_id == null)!;
    expect(filterProblems(list, { query: named.name.toUpperCase() }).map((p) => p.id)).toContain(named.id);
  });
});

describe("links", () => {
  it("builds Boolder and bleau.info links, refusing malformed ids", () => {
    expect(boolderProblemUrl(241, "en")).toBe("https://www.boolder.com/en/p/241");
    expect(bleauInfoUrl("819")).toBe("https://bleau.info/c/819.html");
    expect(bleauInfoUrl("")).toBeNull();
    expect(bleauInfoUrl("../x")).toBeNull();
  });
});
