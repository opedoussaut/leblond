/**
 * Canonical climbing domain vocabulary. These string unions mirror the
 * Postgres enums in supabase/migrations — keep both in sync.
 */

export const GRADE_SYSTEMS = [
  "ARKOSE_COLOR",
  "CLIMBING_DISTRICT_COLOR",
  "FONT",
  "CUSTOM_COLOR",
  "UNKNOWN",
] as const;
export type GradeSystem = (typeof GRADE_SYSTEMS)[number];

export const GYM_BRANDS = [
  "ARKOSE",
  "CLIMBING_DISTRICT",
  "BLOCKOUT",
  "INDEPENDENT",
  "OUTDOOR",
  "OTHER",
] as const;
export type GymBrand = (typeof GYM_BRANDS)[number];

/** Brands whose grading system is fixed by the network. */
export const BRAND_NATIVE_SYSTEM: Partial<Record<GymBrand, GradeSystem>> = {
  ARKOSE: "ARKOSE_COLOR",
  CLIMBING_DISTRICT: "CLIMBING_DISTRICT_COLOR",
};

/** Systems a user may pick for a gym of the given brand. */
export function allowedSystemsForBrand(brand: GymBrand): GradeSystem[] {
  const fixed = BRAND_NATIVE_SYSTEM[brand];
  if (fixed) return [fixed];
  return ["FONT", "CUSTOM_COLOR"];
}

export const WALL_ANGLES = [
  "SLAB",
  "VERTICAL",
  "SLIGHT_OVERHANG",
  "OVERHANG",
  "STEEP",
  "ROOF",
  "UNKNOWN",
] as const;
export type WallAngle = (typeof WALL_ANGLES)[number];

export const ATTEMPT_RESULTS = ["ATTEMPT", "TOP", "FLASH"] as const;
export type AttemptResult = (typeof ATTEMPT_RESULTS)[number];

export const SESSION_SOURCES = [
  "MANUAL",
  "ARKOSE",
  "CLIMBING_DISTRICT",
  "COROS",
  "SUUNTO",
  "GARMIN",
  "STRAVA",
  "IMPORT",
] as const;
export type SessionSource = (typeof SESSION_SOURCES)[number];

export const SESSION_TYPES = ["BOULDERING", "TRAINING", "PROJECTING", "TECHNIQUE", "OTHER"] as const;
export type SessionType = (typeof SESSION_TYPES)[number];

export const PROJECT_STATUSES = ["ACTIVE", "SENT", "ABANDONED", "RETIRED"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const MEDIA_TYPES = ["PROBLEM_PHOTO", "ATTEMPT_VIDEO", "SEND_VIDEO"] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

export const STYLE_TAGS = [
  "slab",
  "balance",
  "technical",
  "coordination",
  "dynamic",
  "dyno",
  "compression",
  "power",
  "power_endurance",
  "crimps",
  "slopers",
  "pinches",
  "pockets",
  "heel_hook",
  "toe_hook",
  "mantle",
  "lock_off",
  "undercling",
  "gaston",
  "high_step",
  "flexibility",
  "route_reading",
  "footwork",
  "body_positioning",
] as const;
export type StyleTag = (typeof STYLE_TAGS)[number];

/** A result counts as a send (TOP or FLASH). Flash is also a send. */
export function isSend(result: AttemptResult): boolean {
  return result === "TOP" || result === "FLASH";
}
