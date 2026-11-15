import { describe, expect, it } from "vitest";
import { MAX_TOPO_SHIFT_KM, impactToken, kmBetween, topoCentre, topoImpact, type CurrentTopoRow } from "@/lib/integrations/outdoor/topo-impact";

// Fictional boulders at a fictional crag ("here"), and another crag 16 km east ("there").
const HERE: CurrentTopoRow[] = [
  { id: 101, key: "yellow:1", name: "Premier", latitude: 48.7162, longitude: 1.976 },
  { id: 102, key: "yellow:2", name: "Deuxième", latitude: 48.7163, longitude: 1.9762 },
  { id: 103, key: "orange:1", name: "Le Dévers", latitude: 48.7135, longitude: 1.9839 },
  { id: 104, key: "hc:letoit", name: "Le Toit", latitude: 48.717, longitude: 1.9757 },
  { id: 105, key: "white:1", name: "Sans Repère", latitude: null, longitude: null },
];
const THERE = [
  { key: "yellow:1", latitude: 48.7112, longitude: 2.1946 },
  { key: "yellow:2", latitude: 48.7112, longitude: 2.1944 },
  { key: "red:1", latitude: 48.7111, longitude: 2.1938 },
  { key: "hc:lecume", latitude: 48.7112, longitude: 2.1945 },
];

describe("kmBetween", () => {
  it("measures the distance between two crags", () => {
    expect(kmBetween({ latitude: 48.7165, longitude: 1.976 }, { latitude: 48.7111, longitude: 2.1942 })).toBeCloseTo(16.0, 0);
    expect(kmBetween({ latitude: 48.7, longitude: 2 }, { latitude: 48.7, longitude: 2 })).toBe(0);
    // One degree of latitude.
    expect(kmBetween({ latitude: 48, longitude: 2 }, { latitude: 49, longitude: 2 })).toBeCloseTo(111.2, 0);
  });
});

describe("topoCentre", () => {
  it("ignores boulders without a position", () => {
    expect(topoCentre([{ latitude: 48, longitude: 2 }, { latitude: 49, longitude: 3 }, { latitude: null, longitude: null }]))
      .toEqual({ latitude: 48.5, longitude: 2.5 });
    expect(topoCentre([{ latitude: null, longitude: null }])).toBeNull();
    expect(topoCentre([])).toBeNull();
  });
});

describe("topoImpact", () => {
  it("recognises the topo of another crag, whatever keys it shares", () => {
    const impact = topoImpact(HERE, THERE, new Map([[103, 2], [101, 1]]));
    expect(impact.elsewhere).toBe(true);
    expect(impact.shiftKm).toBeGreaterThan(MAX_TOPO_SHIFT_KM);
    // The two yellow keys exist in both topos: they would be overwritten, the three others deleted.
    expect(impact.kept).toBe(2);
    expect(impact.added).toBe(2);
    expect(impact.removed.map((r) => r.name)).toEqual(["Le Dévers", "Le Toit", "Sans Repère"]);
    // Only the links of deleted boulders are lost.
    expect(impact.unlinked).toBe(2);
  });

  it("accepts a newer file of the same crag and says what it removes", () => {
    const next = [
      { key: "yellow:1", latitude: 48.7162, longitude: 1.976 },
      { key: "yellow:2", latitude: 48.7163, longitude: 1.9762 },
      { key: "orange:1", latitude: 48.7135, longitude: 1.9839 },
      { key: "orange:2", latitude: 48.7136, longitude: 1.984 },
    ];
    const impact = topoImpact(HERE, next, new Map([[104, 3]]));
    expect(impact.elsewhere).toBe(false);
    expect(impact.shiftKm).toBeLessThan(1);
    expect(impact).toMatchObject({ current: 5, kept: 3, added: 1, unlinked: 3 });
    expect(impact.removed).toEqual([{ id: 104, name: "Le Toit" }, { id: 105, name: "Sans Repère" }]);
  });

  it("removes nothing when every current boulder is in the import", () => {
    const next = [...HERE.map(({ key, latitude, longitude }) => ({ key, latitude, longitude })), { key: "white:2", latitude: null, longitude: null }];
    expect(topoImpact(HERE, next)).toMatchObject({ kept: 5, added: 1, removed: [], unlinked: 0, shiftKm: 0, elsewhere: false });
  });

  it("has no distance to judge on a first import or without positions", () => {
    expect(topoImpact([], THERE)).toMatchObject({ current: 0, kept: 0, added: 4, removed: [], shiftKm: null, elsewhere: false });
    const unplaced = [{ key: "white:1", latitude: null, longitude: null }];
    expect(topoImpact(HERE, unplaced)).toMatchObject({ kept: 1, shiftKm: null, elsewhere: false });
  });
});

describe("impactToken", () => {
  it("names one exact change", () => {
    const token = impactToken("gym-a", ["yellow:1", "orange:1"], [104, 105]);
    expect(token).toMatch(/^[0-9a-f]{16}$/);
    // Order does not matter; the site, the boulders in and the boulders out do.
    expect(impactToken("gym-a", ["orange:1", "yellow:1"], [105, 104])).toBe(token);
    expect(impactToken("gym-b", ["yellow:1", "orange:1"], [104, 105])).not.toBe(token);
    expect(impactToken("gym-a", ["yellow:1", "orange:2"], [104, 105])).not.toBe(token);
    expect(impactToken("gym-a", ["yellow:1", "orange:1"], [104])).not.toBe(token);
  });
});
