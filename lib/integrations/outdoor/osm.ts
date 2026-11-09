/**
 * OpenStreetMap: tile URL for the boulder map and links to openstreetmap.org.
 * Usage policy: https://operations.osmfoundation.org/policies/tiles/ (see docs/integrations.md).
 */

export const OSM_TILES = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
/** Highest zoom the standard tiles are served at. */
export const OSM_MAX_ZOOM = 19;

/** openstreetmap.org centred on a point, with a marker. */
export function osmUrl(latitude: number, longitude: number): string {
  const lat = latitude.toFixed(6);
  const lon = longitude.toFixed(6);
  return `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=${OSM_MAX_ZOOM}/${lat}/${lon}`;
}
