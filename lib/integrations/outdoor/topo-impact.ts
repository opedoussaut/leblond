/**
 * What importing a team topo would do to the site's current one, worked out
 * before anything is written: the import replaces the topo, so a file from
 * another place, or an older file, deletes boulders and clears the link of
 * the boulders climbers logged there.
 *
 * Pure functions; the admin form shows the result and asks before removing.
 */

/** Farther than this from the site's current boulders, the file is another place's topo. */
export const MAX_TOPO_SHIFT_KM = 3;

type Positioned = { latitude: number | null; longitude: number | null };

/** The middle of the positioned boulders, or null when none has a position. */
export function topoCentre(rows: readonly Positioned[]): { latitude: number; longitude: number } | null {
  const placed = rows.filter((r): r is { latitude: number; longitude: number } => r.latitude !== null && r.longitude !== null);
  if (placed.length === 0) return null;
  return {
    latitude: placed.reduce((sum, r) => sum + r.latitude, 0) / placed.length,
    longitude: placed.reduce((sum, r) => sum + r.longitude, 0) / placed.length,
  };
}

/** Distance in km, flat-earth around the two points (exact enough between crags; same formula as the database guard). */
export function kmBetween(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const dLat = b.latitude - a.latitude;
  const dLon = Math.cos((((a.latitude + b.latitude) / 2) * Math.PI) / 180) * (b.longitude - a.longitude);
  return 111.195 * Math.sqrt(dLat * dLat + dLon * dLon);
}

export type CurrentTopoRow = Positioned & { id: number; key: string; name: string };

export interface TopoImpact {
  /** Boulders in the site's topo today. */
  current: number;
  kept: number;
  added: number;
  /** Boulders of today's topo that the import deletes. */
  removed: Array<{ id: number; name: string }>;
  /** Climbers' logged boulders that would lose their link to the topo. */
  unlinked: number;
  /** From the middle of today's boulders to the middle of the file's, when both have positions. */
  shiftKm: number | null;
  /** The file describes another place. */
  elsewhere: boolean;
}

/**
 * `next` is the topo to import (keys and positions); `linked` says how many
 * climbers' boulders point at each current boulder (admin_topo_link_counts).
 */
export function topoImpact(
  current: readonly CurrentTopoRow[],
  next: ReadonlyArray<Positioned & { key: string }>,
  linked: ReadonlyMap<number, number> = new Map(),
): TopoImpact {
  const nextKeys = new Set(next.map((p) => p.key));
  const removed = current.filter((row) => !nextKeys.has(row.key));
  const kept = current.length - removed.length;
  const from = topoCentre(current);
  const to = topoCentre(next);
  const shiftKm = from && to ? kmBetween(from, to) : null;
  return {
    current: current.length,
    kept,
    added: next.length - kept,
    removed: removed.map((row) => ({ id: row.id, name: row.name })),
    unlinked: removed.reduce((sum, row) => sum + (linked.get(row.id) ?? 0), 0),
    shiftKm,
    elsewhere: shiftKm !== null && shiftKm > MAX_TOPO_SHIFT_KM,
  };
}

/**
 * Names one exact replacement, so "yes, replace" only ever applies to the
 * change the admin was shown: same site, same boulders in, same boulders out.
 */
export function impactToken(gymId: string, nextKeys: readonly string[], removedIds: readonly number[]): string {
  // FNV-1a, 32 bits, twice with different seeds: not a secret, only a fingerprint of the change.
  const text = [gymId, [...nextKeys].sort().join("\u0001"), [...removedIds].sort((a, b) => a - b).join(",")].join("\u0002");
  const hash = (seed: number) => {
    let h = seed >>> 0;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h.toString(16).padStart(8, "0");
  };
  return hash(2166136261) + hash(84696351);
}
