import { deflateRawSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { KmzError, kmlText } from "@/lib/integrations/outdoor/kmz";
import { buildTeamTopo, folderColor, myMapsGrade, parseKml, splitNameAndGrade } from "@/lib/integrations/outdoor/mymaps";

// Synthetic map, shaped like a Google My Maps export (made-up boulders).
const pin = (name: string, description: string, lon = 2.0, lat = 48.7) =>
  `<Placemark><name>${name}</name><description>${description}</description><styleUrl>#icon-1</styleUrl>` +
  `<Point><coordinates>\n            ${lon},${lat},0\n          </coordinates></Point></Placemark>`;

const KML = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document>
  <name>Topo Test</name>
  <description><![CDATA[Circuits du secteur<br>positions approximatives]]></description>
  <Style id="icon-1"><IconStyle><scale>1</scale></IconStyle></Style>
  <Folder><name>Hors circuit et blocs principaux</name>
    ${pin("La Grotte 7a", "", 2.01, 48.71)}
    ${pin("O3b: La Variante 5", "")}
    ${pin("Le Secteur Nord", "<![CDATA[une liste<br>de blocs]]>")}
    ${pin("Trav&apos; du fond 6C", "")}
  </Folder>
  <Folder><name>Orange</name>
    ${pin("Premier pas 3-", "O1")}
    ${pin("Dalle ronde 3", "O2 et aussi O2b")}
    ${pin("Le Dièdre 4+", "O3:")}
    ${pin("Doublon 4", "O3")}
  </Folder>
  <Folder><name>rouge</name>
    ${pin("Le Toit 5+", "R1", 2.02, 48.69)}
    ${pin("6a+", "R2")}
  </Folder>
  <Folder><name>Autres</name>
    ${pin("Parking", "")}
    ${pin("Sans position 4", "")}
  </Folder>
</Document></kml>`.replace(pin("Sans position 4", ""), "<Placemark><name>Sans position 4</name></Placemark>");

/** A one-entry zip, as My Maps writes a .kmz (deflated doc.kml). */
function kmz(text: string, name = "doc.kml", method: 0 | 8 = 8): Uint8Array {
  const raw = Buffer.from(text, "utf8");
  const data = method === 8 ? deflateRawSync(raw) : raw;
  const fileName = Buffer.from(name, "utf8");
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(method, 8);
  local.writeUInt32LE(data.length, 18);
  local.writeUInt32LE(raw.length, 22);
  local.writeUInt16LE(fileName.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  central.writeUInt16LE(20, 6);
  central.writeUInt16LE(method, 10);
  central.writeUInt32LE(data.length, 20);
  central.writeUInt32LE(raw.length, 24);
  central.writeUInt16LE(fileName.length, 28);
  central.writeUInt32LE(0, 42);
  const cdOffset = local.length + fileName.length + data.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(1, 8);
  end.writeUInt16LE(1, 10);
  end.writeUInt32LE(central.length + fileName.length, 12);
  end.writeUInt32LE(cdOffset, 16);
  return new Uint8Array(Buffer.concat([local, fileName, data, central, fileName, end]));
}

describe("myMapsGrade", () => {
  it("reads letterless grades with the app's lowest-letter convention", () => {
    expect(myMapsGrade("3-")).toBe("3a");
    expect(myMapsGrade("4")).toBe("4a");
    expect(myMapsGrade("4+")).toBe("4c");
    expect(myMapsGrade("1")).toBe("1a");
  });
  it("keeps lettered grades, lower-case below 6 and upper-case from 6A", () => {
    expect(myMapsGrade("4c")).toBe("4c");
    expect(myMapsGrade("6a")).toBe("6A");
    expect(myMapsGrade("6a+")).toBe("6A+");
    expect(myMapsGrade("6C")).toBe("6C");
    expect(myMapsGrade("7c+")).toBe("7C+");
  });
  it("refuses what is not a Font grade rather than guessing", () => {
    expect(myMapsGrade("6")).toBeNull();
    expect(myMapsGrade("7+")).toBeNull();
    expect(myMapsGrade("4c+")).toBeNull();
    expect(myMapsGrade("9C")).toBeNull();
    expect(myMapsGrade("Corde")).toBeNull();
  });
});

describe("splitNameAndGrade", () => {
  it("takes the grade from the end of the name", () => {
    expect(splitNameAndGrade("Les 17 Tournants 7a")).toEqual({ name: "Les 17 Tournants", grade: "7A" });
    expect(splitNameAndGrade("Chamonix - Zermatt a/r 6C")).toEqual({ name: "Chamonix - Zermatt a/r", grade: "6C" });
    expect(splitNameAndGrade("Secteur 12b")).toEqual({ name: "Secteur 12b", grade: null });
    expect(splitNameAndGrade("O29t")).toEqual({ name: "O29t", grade: null });
  });
});

describe("folderColor", () => {
  it("maps French and English layer names, never off-circuit layers", () => {
    expect(folderColor("Orange")).toBe("orange");
    expect(folderColor("rouge")).toBe("red");
    expect(folderColor("Circuit Jaune")).toBe("yellow");
    expect(folderColor("Bleu ciel")).toBe("skyblue");
    expect(folderColor("Bleu")).toBe("blue");
    expect(folderColor("Hors circuit (anciennement rouge)")).toBeNull();
    expect(folderColor("Autres")).toBeNull();
    expect(folderColor(null)).toBeNull();
  });
});

describe("parseKml", () => {
  const doc = parseKml(KML);
  it("reads the map name, layers, names, descriptions and positions", () => {
    expect(doc.name).toBe("Topo Test");
    expect(doc.networkLinkOnly).toBe(false);
    expect(doc.placemarks).toHaveLength(12);
    expect(doc.placemarks[0]).toEqual({
      folder: "Hors circuit et blocs principaux", name: "La Grotte 7a", description: "", latitude: 48.71, longitude: 2.01,
    });
    expect(doc.placemarks[2].description).toBe("une liste\nde blocs");
    expect(doc.placemarks[3].name).toBe("Trav' du fond 6C");
    expect(doc.placemarks[11].latitude).toBeNaN();
  });
  it("recognises the export that only links to the online map", () => {
    const linkOnly = parseKml(
      `<kml><Document><name>Topo</name><NetworkLink><name>Topo</name><Link><href>https://example.test/kml</href></Link></NetworkLink></Document></kml>`,
    );
    expect(linkOnly).toEqual({ name: "Topo", placemarks: [], networkLinkOnly: true });
  });
});

describe("buildTeamTopo", () => {
  const topo = buildTeamTopo(parseKml(KML));
  const byKey = new Map(topo.problems.map((p) => [p.key, p]));

  it("numbers circuit boulders from the code in their description", () => {
    expect(byKey.get("orange:1")).toMatchObject({ name: "Premier pas", grade: "3a", circuit_color: "orange", circuit_number: "1" });
    expect(byKey.get("orange:2")).toMatchObject({ name: "Dalle ronde", grade: "3a", circuit_number: "2" });
    expect(byKey.get("orange:3")).toMatchObject({ name: "Le Dièdre", grade: "4c", name_searchable: "lediedre" });
    expect(byKey.get("red:1")).toMatchObject({ name: "Le Toit", grade: "5c", latitude: 48.69, longitude: 2.02 });
  });

  it("names a pin that only carries a grade after its circuit code", () => {
    expect(byKey.get("red:2")).toMatchObject({ name: "R2", grade: "6A+", circuit_color: "red", circuit_number: "2" });
  });

  it("puts a coded variant from an off-circuit layer on its circuit", () => {
    expect(byKey.get("orange:3b")).toMatchObject({ name: "La Variante", grade: "5a", circuit_color: "orange", circuit_number: "3b" });
  });

  it("keeps off-circuit boulders without a colour", () => {
    expect(byKey.get("hc:lagrotte")).toMatchObject({ name: "La Grotte", grade: "7A", circuit_color: null, circuit_number: null });
    expect(byKey.get("hc:travdufond")).toMatchObject({ name: "Trav' du fond", grade: "6C" });
  });

  it("reports what it skipped and why", () => {
    expect(topo.skipped).toEqual([
      { name: "Le Secteur Nord", folder: "Hors circuit et blocs principaux", reason: "noGrade" },
      { name: "Doublon 4", folder: "Orange", reason: "duplicate" },
      { name: "Parking", folder: "Autres", reason: "noGrade" },
      { name: "Sans position 4", folder: "Autres", reason: "noPosition" },
    ]);
    expect(topo.problems).toHaveLength(8);
  });

  it("makes one circuit per colour with its median grade", () => {
    expect(topo.circuits).toEqual([
      { color: "orange", average_grade: "3a" },
      { color: "red", average_grade: "5c" },
    ]);
  });
});

describe("kmlText", () => {
  it("reads doc.kml from a .kmz, deflated or stored", () => {
    expect(kmlText(kmz(KML))).toBe(KML);
    expect(kmlText(kmz(KML, "doc.kml", 0))).toBe(KML);
    expect(kmlText(kmz(KML, "Topo.KML"))).toBe(KML);
  });
  it("accepts a plain .kml", () => {
    expect(kmlText(new TextEncoder().encode(KML))).toBe(KML);
  });
  it("refuses other files", () => {
    expect(() => kmlText(new TextEncoder().encode("hello"))).toThrow(KmzError);
    expect(() => kmlText(kmz("<kml/>", "images/icon.png"))).toThrow(/notKml/);
    expect(() => kmlText(kmz(KML).slice(0, 60))).toThrow(KmzError);
  });
  it("caps the inflated size", () => {
    const huge = `<kml>${" ".repeat(6 * 1024 * 1024)}</kml>`;
    expect(() => kmlText(kmz(huge))).toThrow(/tooLarge/);
  });
});
