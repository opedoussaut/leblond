import { describe, expect, it } from "vitest";
import { circuitsOf, mergeTopoList, parseTopoList, type ListedProblem } from "@/lib/integrations/outdoor/topo-list";

// Fictional names, in the layout of a guide page copy.
const LIST = `Bleu TD- Site Test
4+
5-
Ce circuit, tracé à l'origine en 5 couleurs, comporte des traversées.

1La Première 4+  Jean Test traversée d-g
2Le Deuxième 5 5-  Jean Test départ assis
2 bisLa Variante 6a  Jean Test surplomb
3Le GR 11 4+  Jean Test mur
3 ter51 en Essonne 3 traversée g-d
Rouge TD+ Site Test
Grimpeur : Alain Test
1L'Acrobate Test 6a  Eric Test traversée d-g
2L'Orange ta Fierté 5+ 6a mur
7c+
Le Grand Toit 7c+  surplomb, départ assis
La Première 4+  Jean Test traversée d-g
Les 17 Virages 7a  traversée d-g
L'Orange ta Fierté 5+ 6a mur
L'Élite 1
`;

describe("parseTopoList", () => {
  const list = parseTopoList(LIST);
  it("reads circuits, numbers with bis/ter, names holding numbers, and the first grade", () => {
    expect(list.circuits).toEqual(["blue", "red"]);
    const blue = list.entries.filter((e) => e.color === "blue");
    expect(blue.map((e) => [e.number, e.name, e.grade])).toEqual([
      ["1", "La Première", "4c"],
      ["2", "Le Deuxième", "5a"],
      ["2b", "La Variante", "6A"],
      ["3", "Le GR 11", "4c"],
      ["3c", "51 en Essonne", "3a"],
    ]);
    expect(list.entries.find((e) => e.name === "L'Orange ta Fierté")).toMatchObject({ color: "red", number: "2", grade: "5c" });
  });
  it("keeps only true off-circuit boulders from the full list", () => {
    expect(list.entries.filter((e) => !e.color).map((e) => [e.name, e.grade])).toEqual([
      ["Le Grand Toit", "7C+"],
      ["Les 17 Virages", "7A"],
      ["L'Élite", "1a"],
    ]);
    expect(list.unreadable).toEqual([]);
  });
});

describe("mergeTopoList", () => {
  const pin = (p: Partial<ListedProblem> & { key: string; name: string }): ListedProblem => ({
    name_searchable: p.name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]/g, ""),
    grade: "4a", circuit_color: null, circuit_number: null, latitude: 48.7, longitude: 2.0, ...p,
  });
  const list = parseTopoList(LIST);
  const pins = [
    pin({ key: "hc:lapremiere", name: "La Première" }), // on the map, but in the wrong layer
    pin({ key: "blue:2", name: "B2", circuit_color: "blue", circuit_number: "2" }), // no name, right number
    pin({ key: "blue:9", name: "Ancien Bloc", circuit_color: "blue", circuit_number: "9" }), // not on the list
    pin({ key: "hc:autre", name: "Hors Liste" }), // off-circuit, not on the list
  ];
  const { problems, report } = mergeTopoList(pins, list);
  it("takes circuits, numbers and grades from the list, positions and keys from the pins", () => {
    expect(problems.find((p) => p.name === "La Première")).toMatchObject({ key: "hc:lapremiere", circuit_color: "blue", circuit_number: "1", grade: "4c", latitude: 48.7 });
    expect(problems.find((p) => p.name === "Le Deuxième")).toMatchObject({ key: "blue:2", latitude: 48.7 });
  });
  it("keeps listed boulders without a pin, unpositioned, and pins the list does not know", () => {
    expect(problems.find((p) => p.name === "La Variante")).toMatchObject({ key: "blue:2b", latitude: null, longitude: null });
    expect(report.withoutPosition).toContain("blue 2b · La Variante");
    expect(problems.find((p) => p.name === "Ancien Bloc")).toMatchObject({ key: "blue:9", circuit_color: null });
    expect(report.unmatchedPins).toEqual(["blue 9 · Ancien Bloc"]);
    expect(problems.find((p) => p.name === "Hors Liste")).toMatchObject({ key: "hc:autre" });
    expect(new Set(problems.map((p) => p.key)).size).toBe(problems.length);
    expect(report.placed).toBe(2);
  });
  it("recomputes each circuit's median grade", () => {
    expect(circuitsOf(problems).find((c) => c.color === "blue")?.average_grade).toBe("4c");
  });
});
