import { describe, expect, it } from "vitest";
import { OSM_TILES, osmUrl } from "@/lib/integrations/outdoor/osm";

describe("osmUrl", () => {
  it("centres openstreetmap.org on the boulder with a marker, 6 decimals", () => {
    expect(osmUrl(48.70531234, 1.98265)).toBe(
      "https://www.openstreetmap.org/?mlat=48.705312&mlon=1.982650#map=19/48.705312/1.982650",
    );
  });

  it("uses the standard OSM tile server over https", () => {
    expect(OSM_TILES).toBe("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
  });
});
