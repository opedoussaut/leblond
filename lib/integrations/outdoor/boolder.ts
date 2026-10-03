/**
 * Boolder open data → LEBLOND outdoor catalogue.
 *
 * Boolder (https://www.boolder.com) publishes its Fontainebleau topo as open
 * data under CC BY 4.0: https://github.com/boolder-org/boolder-data
 * (SQLite `boolder.db`). LEBLOND imports it as a read-only reference catalogue
 * and must credit Boolder wherever that data is shown (BOOLDER_ATTRIBUTION).
 *
 * Everything here is pure (no I/O) so the mapping can be unit-tested; the
 * SQLite reading and database writes live in scripts/import-boolder.ts.
 */
import type { WallAngle } from "@/lib/climbing/types";
import { FONT_SCALE, type FontGrade } from "@/lib/grading/systems";

export const BOOLDER_PROVIDER = "BOOLDER" as const;

export const BOOLDER_ATTRIBUTION = {
  name: "Boolder",
  url: "https://www.boolder.com",
  dataUrl: "https://github.com/boolder-org/boolder-data",
  license: "CC BY 4.0",
  licenseUrl: "https://creativecommons.org/licenses/by/4.0/",
} as const;

/** Public page of a problem on Boolder (used for "see on Boolder" links). */
export function boolderProblemUrl(id: number, lang: "fr" | "en" = "fr"): string {
  return `https://www.boolder.com/${lang}/p/${id}`;
}

/** bleau.info is linked to (same link format as boolder.com), never scraped or imported: no licence to reuse it. */
export function bleauInfoUrl(bleauInfoId: string | null): string | null {
  return bleauInfoId && /^[0-9]{1,10}$/.test(bleauInfoId) ? `https://bleau.info/c/${bleauInfoId}.html` : null;
}

/* ───────────── Raw rows (as in boolder.db) ───────────── */

export interface BoolderAreaRow {
  id: number;
  name: string;
  name_searchable: string;
  priority: number;
  description_fr: string | null;
  description_en: string | null;
  warning_fr: string | null;
  warning_en: string | null;
  tags: string | null;
  south_west_lat: number;
  south_west_lon: number;
  north_east_lat: number;
  north_east_lon: number;
  problems_count: number;
  cluster_id: number | null;
}

export interface BoolderClusterRow {
  id: number;
  name: string;
}

export interface BoolderCircuitRow {
  id: number;
  color: string;
  average_grade: string;
  beginner_friendly: number;
  dangerous: number;
}

export interface BoolderProblemRow {
  id: number;
  name: string | null;
  name_en: string | null;
  name_searchable: string | null;
  grade: string | null;
  latitude: number;
  longitude: number;
  circuit_id: number | null;
  circuit_number: string | null;
  circuit_color: string | null;
  steepness: string;
  sit_start: number;
  area_id: number;
  bleau_info_id: string | null;
  featured: number;
  popularity: number | null;
  parent_id: number | null;
}

export interface BoolderDataset {
  areas: BoolderAreaRow[];
  clusters: BoolderClusterRow[];
  circuits: BoolderCircuitRow[];
  problems: BoolderProblemRow[];
}

/* ───────────── Mapping rules ───────────── */

/**
 * Boolder writes every Font grade in lower case ("4b", "6a+"). LEBLOND keeps
 * the lettered spelling below 6A and the conventional upper case from 6A
 * ("6A+"). Anything not on the scale (including an empty grade) → null.
 */
export function mapBoolderGrade(raw: string | null | undefined): FontGrade | null {
  const g = raw?.trim();
  if (!g) return null;
  const m = /^([1-9])([abc])(\+?)$/i.exec(g);
  if (!m) return null;
  const level = Number(m[1]);
  const letter = m[2].toLowerCase();
  const plus = m[3];
  const id = level >= 6 ? `${level}${letter.toUpperCase()}${plus}` : plus ? null : `${level}${letter}`;
  return id && (FONT_SCALE as readonly string[]).includes(id) ? (id as FontGrade) : null;
}

/**
 * Boolder steepness → LEBLOND wall angle. "traverse" describes the line's
 * direction, not the wall, and "other" is unspecified: both stay UNKNOWN
 * rather than being guessed.
 */
export function mapSteepness(steepness: string | null | undefined): WallAngle {
  switch (steepness) {
    case "slab":
      return "SLAB";
    case "wall":
      return "VERTICAL";
    case "overhang":
      return "OVERHANG";
    case "roof":
      return "ROOF";
    default:
      return "UNKNOWN";
  }
}

export const CIRCUIT_COLORS = ["white", "yellow", "orange", "blue", "skyblue", "red", "black", "green", "purple", "salmon"] as const;
export type CircuitColor = (typeof CIRCUIT_COLORS)[number];

/** Generic swatches (not Boolder brand assets). The colour name is always shown too. */
export const CIRCUIT_SWATCHES: Record<CircuitColor, { bg: string; fg: string }> = {
  white: { bg: "#F4F4F4", fg: "#111111" },
  yellow: { bg: "#F2C318", fg: "#1a1400" },
  orange: { bg: "#EE7D1C", fg: "#1a0d00" },
  blue: { bg: "#1F63C6", fg: "#ffffff" },
  skyblue: { bg: "#62B6E8", fg: "#06202f" },
  red: { bg: "#C8282B", fg: "#ffffff" },
  black: { bg: "#151515", fg: "#ffffff" },
  green: { bg: "#2E9E4F", fg: "#ffffff" },
  purple: { bg: "#6B2FA3", fg: "#ffffff" },
  salmon: { bg: "#F08C7A", fg: "#2a0d07" },
};

export function isCircuitColor(c: string | null | undefined): c is CircuitColor {
  return !!c && (CIRCUIT_COLORS as readonly string[]).includes(c);
}

const AREA_TAGS = ["popular", "beginner_friendly", "family_friendly", "dry_fast"] as const;
export type AreaTag = (typeof AREA_TAGS)[number];

function parseTags(tags: string | null): AreaTag[] {
  if (!tags) return [];
  const known = new Set<string>(AREA_TAGS);
  return [...new Set(tags.split(",").map((s) => s.trim()))].filter((s): s is AreaTag => known.has(s));
}

const text = (v: string | null | undefined, max: number) => {
  const s = v?.trim();
  return s ? s.slice(0, max) : null;
};
const finite = (v: number | null | undefined) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/* ───────────── Catalogue rows (match supabase/migrations/…_fontainebleau_boolder.sql) ───────────── */

export interface CatalogueArea {
  id: number;
  name: string;
  name_searchable: string;
  cluster_name: string | null;
  priority: number;
  tags: AreaTag[];
  description_fr: string | null;
  description_en: string | null;
  warning_fr: string | null;
  warning_en: string | null;
  south_west_lat: number | null;
  south_west_lon: number | null;
  north_east_lat: number | null;
  north_east_lon: number | null;
  problems_count: number;
}

export interface CatalogueCircuit {
  id: number;
  color: string;
  average_grade: FontGrade | null;
  beginner_friendly: boolean;
  dangerous: boolean;
}

export interface CatalogueProblem {
  id: number;
  area_id: number;
  name: string;
  name_en: string | null;
  name_searchable: string;
  grade: FontGrade;
  circuit_id: number | null;
  circuit_number: string | null;
  circuit_color: string | null;
  steepness: string;
  wall_angle: WallAngle;
  sit_start: boolean;
  latitude: number;
  longitude: number;
  popularity: number | null;
  featured: boolean;
  parent_id: number | null;
  bleau_info_id: string | null;
}

export type SkipReason = "invalidGrade" | "unknownArea" | "invalidCoordinates" | "missingName";

export interface CatalogueImport {
  areas: CatalogueArea[];
  circuits: CatalogueCircuit[];
  problems: CatalogueProblem[];
  skipped: Array<{ kind: "area" | "problem"; id: number; reason: SkipReason }>;
}

/**
 * Maps a whole Boolder dataset. Problems that cannot be stored faithfully are
 * skipped and reported (never "fixed" by guessing a grade). Area problem counts
 * are recomputed from the problems actually imported.
 */
export function buildCatalogue(data: BoolderDataset): CatalogueImport {
  const skipped: CatalogueImport["skipped"] = [];
  const clusters = new Map(data.clusters.map((c) => [c.id, c.name]));

  const areaIds = new Set<number>();
  const areasDraft: CatalogueArea[] = [];
  for (const a of data.areas) {
    const name = text(a.name, 120);
    if (!name) {
      skipped.push({ kind: "area", id: a.id, reason: "missingName" });
      continue;
    }
    areaIds.add(a.id);
    areasDraft.push({
      id: a.id,
      name,
      name_searchable: text(a.name_searchable, 200) ?? "",
      cluster_name: a.cluster_id != null ? text(clusters.get(a.cluster_id), 120) : null,
      priority: Number.isFinite(a.priority) ? a.priority : 0,
      tags: parseTags(a.tags),
      description_fr: text(a.description_fr, 4000),
      description_en: text(a.description_en, 4000),
      warning_fr: text(a.warning_fr, 1000),
      warning_en: text(a.warning_en, 1000),
      south_west_lat: finite(a.south_west_lat),
      south_west_lon: finite(a.south_west_lon),
      north_east_lat: finite(a.north_east_lat),
      north_east_lon: finite(a.north_east_lon),
      problems_count: 0,
    });
  }

  const circuits: CatalogueCircuit[] = data.circuits.map((c) => ({
    id: c.id,
    color: c.color.trim().toLowerCase().slice(0, 20),
    average_grade: mapBoolderGrade(c.average_grade),
    beginner_friendly: c.beginner_friendly === 1,
    dangerous: c.dangerous === 1,
  }));
  const circuitIds = new Set(circuits.map((c) => c.id));

  const problems: CatalogueProblem[] = [];
  for (const p of data.problems) {
    const grade = mapBoolderGrade(p.grade);
    const name = text(p.name, 160);
    if (!areaIds.has(p.area_id)) skipped.push({ kind: "problem", id: p.id, reason: "unknownArea" });
    else if (!grade) skipped.push({ kind: "problem", id: p.id, reason: "invalidGrade" });
    else if (!name) skipped.push({ kind: "problem", id: p.id, reason: "missingName" });
    else if (
      finite(p.latitude) == null ||
      finite(p.longitude) == null ||
      Math.abs(p.latitude) > 90 ||
      Math.abs(p.longitude) > 180
    )
      skipped.push({ kind: "problem", id: p.id, reason: "invalidCoordinates" });
    else {
      const circuitId = p.circuit_id != null && circuitIds.has(p.circuit_id) ? p.circuit_id : null;
      const bleau = text(p.bleau_info_id, 10);
      problems.push({
        id: p.id,
        area_id: p.area_id,
        name,
        name_en: text(p.name_en, 160),
        name_searchable: text(p.name_searchable, 200) ?? "",
        grade,
        circuit_id: circuitId,
        circuit_number: circuitId != null ? text(p.circuit_number, 10) : null,
        circuit_color: circuitId != null ? text(p.circuit_color, 20) : null,
        steepness: text(p.steepness, 20) ?? "other",
        wall_angle: mapSteepness(p.steepness),
        sit_start: p.sit_start === 1,
        latitude: p.latitude,
        longitude: p.longitude,
        popularity: finite(p.popularity),
        featured: p.featured === 1,
        parent_id: p.parent_id ?? null,
        bleau_info_id: bleau && /^[0-9]{1,10}$/.test(bleau) ? bleau : null,
      });
    }
  }

  const counts = new Map<number, number>();
  for (const p of problems) counts.set(p.area_id, (counts.get(p.area_id) ?? 0) + 1);
  const areas = areasDraft.map((a) => ({ ...a, problems_count: counts.get(a.id) ?? 0 }));

  return { areas, circuits, problems, skipped };
}

/* ───────────── Search (used by the live-session picker) ───────────── */

/** Same normalisation as Boolder's `name_searchable`: lower case, no accents, letters and digits only. */
export function searchable(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

export interface PickerProblem {
  id: number;
  name: string;
  name_searchable: string;
  grade: string;
  circuit_color: string | null;
  circuit_number: string | null;
  popularity: number | null;
}

/**
 * Filters catalogue problems for the picker. A query that is only digits also
 * matches the circuit number exactly ("12" → problem n°12 of each circuit).
 * Order: circuit problems by colour then number, then the rest by popularity.
 */
export function filterProblems<T extends PickerProblem>(
  list: T[],
  opts: { query?: string; circuitColor?: string | null; grade?: string | null },
): T[] {
  const q = searchable(opts.query ?? "");
  const digits = /^[0-9]+$/.test((opts.query ?? "").trim()) ? (opts.query ?? "").trim() : null;
  const out = list.filter((p) => {
    if (opts.circuitColor && p.circuit_color !== opts.circuitColor) return false;
    if (opts.grade && p.grade !== opts.grade) return false;
    if (!q) return true;
    if (digits && p.circuit_number === digits) return true;
    return (p.name_searchable || searchable(p.name)).includes(q);
  });
  const num = (s: string | null) => {
    const n = Number.parseInt(s ?? "", 10);
    return Number.isFinite(n) ? n : Number.MAX_SAFE_INTEGER;
  };
  return out.sort((a, b) => {
    if (digits) {
      const ea = Number(a.circuit_number === digits);
      const eb = Number(b.circuit_number === digits);
      if (ea !== eb) return eb - ea;
    }
    if (opts.circuitColor || (a.circuit_color && b.circuit_color)) {
      const c = (a.circuit_color ?? "").localeCompare(b.circuit_color ?? "");
      if (c !== 0) return c;
      const n = num(a.circuit_number) - num(b.circuit_number);
      if (n !== 0) return n;
    } else if (a.circuit_color || b.circuit_color) {
      return a.circuit_color ? -1 : 1;
    }
    return (b.popularity ?? 0) - (a.popularity ?? 0) || a.name.localeCompare(b.name);
  });
}
