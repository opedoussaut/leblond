/**
 * One-step FIT import: what kind of séance a watch file is (pure, client-safe).
 *
 * 1. The FIT `sport` / `sub_sport` (as decoded by Garmin's SDK: "rockClimbing",
 *    "bouldering", "strengthTraining"…).
 * 2. Otherwise the activity's name (sport profile, sport or workout name, as the
 *    climber or the watch named it), in French or English.
 * 3. Otherwise its duration: a generic activity shorter than a climbing séance
 *    can be is training.
 * 4. Otherwise "unknown": the climber is asked.
 */

export type ClimbDiscipline = "BOULDER" | "ROUTE";
export type ClimbSetting = "INDOOR" | "OUTDOOR";
export type TrainingKind = "STRENGTH" | "HANGBOARD" | "MOBILITY" | "CARDIO" | "OTHER";
/** What decided it, so the séance page can say why. */
export type DetectionSource = "sport" | "name" | "duration";

export type FitDetection =
  | {
      kind: "CLIMB";
      /** Null when the file says "climbing" without telling boulders from routes. */
      discipline: ClimbDiscipline | null;
      setting: ClimbSetting;
      source: DetectionSource;
    }
  | { kind: "TRAINING"; training: TrainingKind; source: DetectionSource }
  | { kind: "UNKNOWN" };

export interface FitHints {
  sport: string | null;
  subSport: string | null;
  name: string | null;
  durationSeconds: number;
  hasGps: boolean;
}

/** A generic activity shorter than this is filed as training: no climbing séance is that short. */
export const SHORT_GENERIC_SECONDS = 15 * 60;

/* ───────────── Reading the stored activity back ───────────── */

/**
 * Hints from a stored activity: `activity_type` is "sport/subSport" as the
 * parser wrote it, `raw_metadata` carries the activity name and GPS flag.
 */
export function hintsFromActivity(activity: {
  activity_type: string;
  duration_seconds: number;
  raw_metadata: unknown;
}): FitHints {
  const [sport, subSport] = activity.activity_type === "unknown" ? [] : activity.activity_type.split("/");
  const meta = (activity.raw_metadata && typeof activity.raw_metadata === "object" ? activity.raw_metadata : {}) as Record<string, unknown>;
  return {
    sport: sport || null,
    subSport: subSport || null,
    name: typeof meta.activityName === "string" && meta.activityName.trim() ? meta.activityName.trim() : null,
    durationSeconds: activity.duration_seconds,
    hasGps: meta.hasGps === true,
  };
}

/* ───────────── Names ───────────── */

/** Lower case, no accents, words separated by single spaces, padded: " bloc a font ". */
export function normaliseName(name: string): string {
  const words = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
  return words ? ` ${words} ` : "";
}

const has = (normalised: string, words: readonly string[]) => words.some((w) => normalised.includes(` ${w} `));

const BOULDER_WORDS = ["bloc", "blocs", "boulder", "boulders", "bouldering", "bouldern", "pan", "moonboard", "kilter", "kilterboard"];
const ROUTE_WORDS = [
  "voie", "voies", "falaise", "corde", "moulinette", "en tete", "lead", "top rope", "toprope",
  "route", "routes", "sport climbing", "grande voie", "grandes voies", "multipitch", "multi pitch", "auto assureur", "autobelay",
];
const CLIMB_WORDS = ["grimpe", "escalade", "climb", "climbing", "varappe", "klettern", "grimper", ...BOULDER_WORDS, ...ROUTE_WORDS];
const OUTDOOR_WORDS = [
  "falaise", "crag", "bleau", "fontainebleau", "dehors", "outdoor", "outdoors", "exterieur", "rocher", "rochers", "site naturel",
  "grande voie", "grandes voies", "multipitch", "multi pitch",
];
const INDOOR_WORDS = ["salle", "gym", "indoor", "interieur", "arkose", "climbing district", "blockout", "resine", "sae", "mur"];

const HANGBOARD_WORDS = [
  "poutre", "hangboard", "fingerboard", "suspension", "suspensions", "max hang", "max hangs", "maxhang", "repeaters",
  "repeater", "tindeq", "doigts", "dead hang", "dead hangs", "campus",
];
const STRENGTH_WORDS = [
  "renfo", "renforcement", "muscu", "musculation", "strength", "gainage", "core", "force", "tractions", "traction",
  "pull up", "pull ups", "pullups", "ppg", "weights", "halteres", "kettlebell", "antagoniste", "antagonistes",
];
const MOBILITY_WORDS = [
  "mobilite", "mobility", "souplesse", "stretching", "etirement", "etirements", "yoga", "pilates", "flexibility",
  "hanches", "hip", "hips", "assouplissement", "assouplissements",
];
const CARDIO_WORDS = [
  "course", "running", "run", "footing", "jogging", "velo", "bike", "cycling", "vtt", "natation", "swim", "swimming",
  "rameur", "rowing", "cardio", "hiit", "marche", "walk", "walking", "rando", "randonnee", "hike", "hiking", "trail",
  "elliptique", "elliptical", "corde a sauter", "skipping",
];

function trainingFromName(n: string): TrainingKind | null {
  if (has(n, HANGBOARD_WORDS)) return "HANGBOARD";
  if (has(n, MOBILITY_WORDS)) return "MOBILITY";
  if (has(n, STRENGTH_WORDS)) return "STRENGTH";
  if (has(n, CARDIO_WORDS)) return "CARDIO";
  return null;
}

function disciplineFromName(n: string): ClimbDiscipline | null {
  const boulder = has(n, BOULDER_WORDS);
  const route = has(n, ROUTE_WORDS);
  return boulder === route ? null : boulder ? "BOULDER" : "ROUTE";
}

function settingFromName(n: string): ClimbSetting | null {
  const outdoor = has(n, OUTDOOR_WORDS);
  const indoor = has(n, INDOOR_WORDS);
  return outdoor === indoor ? null : outdoor ? "OUTDOOR" : "INDOOR";
}

/* ───────────── Sports ───────────── */

const MOBILITY_SUB_SPORTS = new Set(["flexibilityTraining", "yoga", "pilates", "breathing"]);
const CARDIO_SUB_SPORTS = new Set([
  "cardioTraining", "hiit", "amrap", "emom", "tabata", "indoorRowing", "elliptical", "stairClimbing", "indoorCycling",
  "spin", "treadmill", "indoorRunning", "indoorWalking", "indoorSkiing",
]);
const CARDIO_SPORTS = new Set([
  "running", "cycling", "walking", "hiking", "swimming", "rowing", "crossCountrySkiing", "fitnessEquipment", "hiit",
  "floorClimbing", "eBiking", "paddling", "kayaking", "canoeing", "standUpPaddleboarding", "snowshoeing", "inlineSkating",
  "iceSkating", "boxing", "mixedMartialArts", "jumpRope", "dance", "wheelchairPushWalk", "wheelchairPushRun",
]);
const MOBILITY_SPORTS = new Set(["mobility"]);
/** Not a séance a climber logs (or not telling): ask rather than guess. */
const ASK_SPORTS = new Set([
  "generic", "transition", "multisport", "mountaineering", "driving", "flying", "motorcycling", "boating", "videoGaming",
  "fishing", "hunting", "motorSports", "geocaching", "snowmobiling", "jumpmaster", "tactical", "shooting", "all",
]);

function climbFromSport(subSport: string | null, n: string, hasGps: boolean): FitDetection {
  const named = disciplineFromName(n);
  const namedSetting = settingFromName(n);
  if (subSport === "bouldering") {
    return { kind: "CLIMB", discipline: named ?? "BOULDER", setting: namedSetting ?? (hasGps ? "OUTDOOR" : "INDOOR"), source: "sport" };
  }
  if (subSport === "indoorClimbing") {
    // Garmin's and COROS's indoor climbing profiles count rope climbs; a name can still say "bloc".
    return { kind: "CLIMB", discipline: named ?? "ROUTE", setting: "INDOOR", source: "sport" };
  }
  // Plain rock climbing: outdoors when the watch had a position, unless the name says otherwise.
  return { kind: "CLIMB", discipline: named, setting: namedSetting ?? (hasGps ? "OUTDOOR" : "INDOOR"), source: "sport" };
}

/** What kind of séance this watch file is. */
export function detectFitSession(h: FitHints): FitDetection {
  const n = h.name ? normaliseName(h.name) : "";
  const sport = h.sport;
  const sub = h.subSport;

  if (sport === "rockClimbing" || sub === "bouldering" || sub === "indoorClimbing") return climbFromSport(sub, n, h.hasGps);

  if (sport === "training" || sub === "strengthTraining" || (sub && (MOBILITY_SUB_SPORTS.has(sub) || CARDIO_SUB_SPORTS.has(sub)))) {
    const named = trainingFromName(n);
    // The name is more precise than "strength" for a hangboard or mobility séance recorded with the strength profile.
    if (named && named !== "CARDIO") return { kind: "TRAINING", training: named, source: "sport" };
    if (sub === "strengthTraining") return { kind: "TRAINING", training: "STRENGTH", source: "sport" };
    if (sub && MOBILITY_SUB_SPORTS.has(sub)) return { kind: "TRAINING", training: "MOBILITY", source: "sport" };
    if (sub && CARDIO_SUB_SPORTS.has(sub)) return { kind: "TRAINING", training: "CARDIO", source: "sport" };
    // "Training" without a sub-sport: still training, the name may say which.
    if (has(n, CLIMB_WORDS)) return climbFromName(n, h.hasGps);
    return { kind: "TRAINING", training: named ?? "OTHER", source: "sport" };
  }
  if (sport && MOBILITY_SPORTS.has(sport)) return { kind: "TRAINING", training: "MOBILITY", source: "sport" };
  if (sport && CARDIO_SPORTS.has(sport)) return { kind: "TRAINING", training: "CARDIO", source: "sport" };
  if (sport === "meditation") return { kind: "TRAINING", training: "MOBILITY", source: "sport" };
  if (sport && !ASK_SPORTS.has(sport)) return { kind: "TRAINING", training: "OTHER", source: "sport" };

  // Generic, unknown or not-a-séance sport: the name, then the duration.
  if (has(n, CLIMB_WORDS)) return climbFromName(n, h.hasGps);
  const named = trainingFromName(n);
  if (named) return { kind: "TRAINING", training: named, source: "name" };
  if ((sport === null || sport === "generic") && h.durationSeconds > 0 && h.durationSeconds < SHORT_GENERIC_SECONDS) {
    return { kind: "TRAINING", training: "OTHER", source: "duration" };
  }
  return { kind: "UNKNOWN" };
}

function climbFromName(n: string, hasGps: boolean): FitDetection {
  return {
    kind: "CLIMB",
    discipline: disciplineFromName(n),
    setting: settingFromName(n) ?? (hasGps ? "OUTDOOR" : "INDOOR"),
    source: "name",
  };
}

/* ───────────── Filing ───────────── */

/** Training method (lib/training/catalogue.ts) a detected training séance is filed under; null = "Autre". */
export function trainingMethodId(kind: TrainingKind, name: string | null): string | null {
  const n = name ? normaliseName(name) : "";
  switch (kind) {
    case "STRENGTH": return "strength-conditioning";
    // Never the hip programme's own method: a free séance must not count as one of its séances.
    case "MOBILITY": return "mobility";
    case "HANGBOARD": return has(n, ["campus"]) ? "campus" : has(n, ["repeaters", "repeater"]) ? "repeaters" : "max-hangs";
    default: return null;
  }
}

/**
 * Boulders or routes when the file did not say: the discipline of the climber's
 * latest séance in the same setting, then their latest séance at all, then boulders.
 */
export function resolveDiscipline(
  detected: ClimbDiscipline | null,
  setting: ClimbSetting,
  recent: ReadonlyArray<{ discipline: string; outdoor: boolean }>,
): ClimbDiscipline {
  if (detected) return detected;
  const climbing = recent.filter((r): r is { discipline: ClimbDiscipline; outdoor: boolean } =>
    r.discipline === "BOULDER" || r.discipline === "ROUTE");
  return (climbing.find((r) => r.outdoor === (setting === "OUTDOOR")) ?? climbing[0])?.discipline ?? "BOULDER";
}

/* ───────────── Venue ───────────── */

export interface VenueOption {
  id: string;
  latitude: number | null;
  longitude: number | null;
  outdoor: boolean;
  hasBouldering: boolean;
  hasRoutes: boolean;
}

export type VenuePick = { gymId: string; via: "gps" | "recent" | "favourite" };

/** How far from a venue's point the watch may start and still be there. */
export const VENUE_RADIUS_METRES = 2_000;

/** Great-circle distance in metres. */
export function distanceMetres(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(s)));
}

/**
 * Where a detected climbing séance happened: the nearest venue to where the
 * watch started (within VENUE_RADIUS_METRES), else the venue of the climber's
 * latest séance of that discipline (same setting first), else a favourite
 * venue offering it. Null: the climber picks it.
 */
export function pickVenue(input: {
  discipline: ClimbDiscipline;
  setting: ClimbSetting;
  start: { lat: number; lon: number } | null;
  venues: readonly VenueOption[];
  /** Latest first. */
  recentGymIds: readonly { gymId: string; discipline: string }[];
  favouriteIds: readonly string[];
}): VenuePick | null {
  const offers = (v: VenueOption) => (input.discipline === "BOULDER" ? v.hasBouldering : v.hasRoutes);
  const byId = new Map(input.venues.map((v) => [v.id, v]));
  const wantOutdoor = input.setting === "OUTDOOR";

  if (input.start) {
    let best: { id: string; d: number } | null = null;
    for (const v of input.venues) {
      if (v.latitude === null || v.longitude === null || !offers(v)) continue;
      const d = distanceMetres(input.start, { lat: v.latitude, lon: v.longitude });
      if (d <= VENUE_RADIUS_METRES && (!best || d < best.d)) best = { id: v.id, d };
    }
    if (best) return { gymId: best.id, via: "gps" };
  }

  const recent = input.recentGymIds
    .filter((r) => r.discipline === input.discipline)
    .map((r) => byId.get(r.gymId))
    .filter((v): v is VenueOption => !!v && offers(v));
  const fromRecent = recent.find((v) => v.outdoor === wantOutdoor) ?? recent[0];
  if (fromRecent) return { gymId: fromRecent.id, via: "recent" };

  const favourites = input.favouriteIds.map((id) => byId.get(id)).filter((v): v is VenueOption => !!v && offers(v));
  const fromFavourite = favourites.find((v) => v.outdoor === wantOutdoor) ?? favourites[0];
  if (fromFavourite) return { gymId: fromFavourite.id, via: "favourite" };
  return null;
}
