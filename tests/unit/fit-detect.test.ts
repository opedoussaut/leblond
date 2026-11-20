import { describe, expect, it } from "vitest";
import {
  detectFitSession,
  distanceMetres,
  hintsFromActivity,
  normaliseName,
  pickVenue,
  resolveDiscipline,
  trainingMethodId,
  type FitHints,
  type VenueOption,
} from "@/lib/integrations/wearables/fit/classify";

// Made-up activities only: no real file or climbing history.
const hints = (h: Partial<FitHints>): FitHints => ({
  sport: null, subSport: null, name: null, durationSeconds: 90 * 60, hasGps: false, ...h,
});

describe("detectFitSession — from the FIT sport", () => {
  it("files a bouldering activity as an indoor boulder séance", () => {
    expect(detectFitSession(hints({ sport: "rockClimbing", subSport: "bouldering" })))
      .toEqual({ kind: "CLIMB", discipline: "BOULDER", setting: "INDOOR", source: "sport" });
  });

  it("puts bouldering with a GPS position outdoors", () => {
    expect(detectFitSession(hints({ sport: "rockClimbing", subSport: "bouldering", hasGps: true })))
      .toMatchObject({ kind: "CLIMB", discipline: "BOULDER", setting: "OUTDOOR" });
  });

  it("files indoor climbing as routes in a gym, unless the name says boulders", () => {
    expect(detectFitSession(hints({ sport: "rockClimbing", subSport: "indoorClimbing" })))
      .toMatchObject({ kind: "CLIMB", discipline: "ROUTE", setting: "INDOOR" });
    expect(detectFitSession(hints({ sport: "rockClimbing", subSport: "indoorClimbing", name: "Bloc à Arkose" })))
      .toMatchObject({ kind: "CLIMB", discipline: "BOULDER", setting: "INDOOR" });
  });

  it("leaves the discipline open for plain rock climbing, outdoors with GPS", () => {
    expect(detectFitSession(hints({ sport: "rockClimbing", hasGps: true })))
      .toEqual({ kind: "CLIMB", discipline: null, setting: "OUTDOOR", source: "sport" });
    expect(detectFitSession(hints({ sport: "rockClimbing", subSport: "generic" })))
      .toMatchObject({ kind: "CLIMB", discipline: null, setting: "INDOOR" });
  });

  it("reads boulders/routes and indoor/outdoor from the name of a plain climbing activity", () => {
    expect(detectFitSession(hints({ sport: "rockClimbing", name: "Falaise du Saussois" })))
      .toMatchObject({ kind: "CLIMB", discipline: "ROUTE", setting: "OUTDOOR" });
    expect(detectFitSession(hints({ sport: "rockClimbing", name: "Blocs à Bleau", hasGps: false })))
      .toMatchObject({ kind: "CLIMB", discipline: "BOULDER", setting: "OUTDOOR" });
    expect(detectFitSession(hints({ sport: "rockClimbing", name: "Escalade en salle", hasGps: true })))
      .toMatchObject({ kind: "CLIMB", discipline: null, setting: "INDOOR" });
  });

  it("recognises a climbing sub-sport even when the sport is missing", () => {
    expect(detectFitSession(hints({ subSport: "bouldering" }))).toMatchObject({ kind: "CLIMB", discipline: "BOULDER" });
  });

  it("files strength, mobility and cardio training", () => {
    expect(detectFitSession(hints({ sport: "training", subSport: "strengthTraining" })))
      .toEqual({ kind: "TRAINING", training: "STRENGTH", source: "sport" });
    for (const sub of ["yoga", "pilates", "flexibilityTraining", "breathing"]) {
      expect(detectFitSession(hints({ sport: "training", subSport: sub }))).toMatchObject({ kind: "TRAINING", training: "MOBILITY" });
    }
    for (const sub of ["cardioTraining", "hiit", "tabata"]) {
      expect(detectFitSession(hints({ sport: "training", subSport: sub }))).toMatchObject({ kind: "TRAINING", training: "CARDIO" });
    }
    expect(detectFitSession(hints({ sport: "mobility" }))).toMatchObject({ kind: "TRAINING", training: "MOBILITY" });
  });

  it("lets the name refine the strength profile into hangboard or mobility work", () => {
    expect(detectFitSession(hints({ sport: "training", subSport: "strengthTraining", name: "Poutre — suspensions" })))
      .toEqual({ kind: "TRAINING", training: "HANGBOARD", source: "sport" });
    expect(detectFitSession(hints({ sport: "training", subSport: "strengthTraining", name: "Mobilité hanches" })))
      .toMatchObject({ kind: "TRAINING", training: "MOBILITY" });
    // A cardio-sounding name does not turn strength into cardio.
    expect(detectFitSession(hints({ sport: "training", subSport: "strengthTraining", name: "Run & lift" })))
      .toMatchObject({ kind: "TRAINING", training: "STRENGTH" });
  });

  it("keeps plain 'training' as training, typed by its name when it can", () => {
    expect(detectFitSession(hints({ sport: "training" }))).toEqual({ kind: "TRAINING", training: "OTHER", source: "sport" });
    expect(detectFitSession(hints({ sport: "training", name: "Hangboard repeaters" })))
      .toMatchObject({ kind: "TRAINING", training: "HANGBOARD" });
    expect(detectFitSession(hints({ sport: "training", name: "Session bloc" })))
      .toMatchObject({ kind: "CLIMB", discipline: "BOULDER", source: "name" });
  });

  it("files endurance sports as cardio and other sports as other training", () => {
    for (const sport of ["running", "cycling", "swimming", "hiking", "fitnessEquipment", "jumpRope"]) {
      expect(detectFitSession(hints({ sport }))).toMatchObject({ kind: "TRAINING", training: "CARDIO", source: "sport" });
    }
    expect(detectFitSession(hints({ sport: "tennis" }))).toEqual({ kind: "TRAINING", training: "OTHER", source: "sport" });
  });
});

describe("detectFitSession — fallbacks", () => {
  it("uses the name when the sport is generic", () => {
    expect(detectFitSession(hints({ sport: "generic", name: "Grimpe à Climbing District" })))
      .toEqual({ kind: "CLIMB", discipline: null, setting: "INDOOR", source: "name" });
    expect(detectFitSession(hints({ name: "Voies en tête" })))
      .toMatchObject({ kind: "CLIMB", discipline: "ROUTE", source: "name" });
    expect(detectFitSession(hints({ sport: "generic", name: "Renfo antagonistes" })))
      .toEqual({ kind: "TRAINING", training: "STRENGTH", source: "name" });
    expect(detectFitSession(hints({ name: "Étirements du soir" })))
      .toMatchObject({ kind: "TRAINING", training: "MOBILITY", source: "name" });
  });

  it("uses the duration when the name says nothing: a short generic activity is training", () => {
    expect(detectFitSession(hints({ sport: "generic", durationSeconds: 8 * 60 })))
      .toEqual({ kind: "TRAINING", training: "OTHER", source: "duration" });
    expect(detectFitSession(hints({ durationSeconds: 14 * 60, name: "Activité" })))
      .toMatchObject({ kind: "TRAINING", source: "duration" });
  });

  it("asks when it really cannot tell", () => {
    expect(detectFitSession(hints({ sport: "generic", durationSeconds: 2 * 3600 }))).toEqual({ kind: "UNKNOWN" });
    expect(detectFitSession(hints({ durationSeconds: 3600, name: "Samedi" }))).toEqual({ kind: "UNKNOWN" });
    // Mountaineering may be a climb or a walk; driving is not a séance.
    expect(detectFitSession(hints({ sport: "mountaineering" }))).toEqual({ kind: "UNKNOWN" });
    expect(detectFitSession(hints({ sport: "driving", durationSeconds: 5 * 60 }))).toEqual({ kind: "UNKNOWN" });
  });

  it("still files a named mountaineering day", () => {
    expect(detectFitSession(hints({ sport: "mountaineering", name: "Grande voie aux Calanques" })))
      .toMatchObject({ kind: "CLIMB", discipline: "ROUTE", setting: "OUTDOOR", source: "name" });
  });

  it("matches whole words only, without accents or case", () => {
    expect(normaliseName("  Blocs à FONTAINEBLEAU! ")).toBe(" blocs a fontainebleau ");
    expect(normaliseName("")).toBe("");
    // "pantalon" is not "pan", "course" is not "cours".
    expect(detectFitSession(hints({ name: "Pantalon neuf", durationSeconds: 3600 }))).toEqual({ kind: "UNKNOWN" });
  });
});

describe("hintsFromActivity", () => {
  it("reads the stored sport, name and GPS flag back", () => {
    expect(hintsFromActivity({
      activity_type: "rockClimbing/bouldering",
      duration_seconds: 5400,
      raw_metadata: { source: "fit-file", activityName: " Bloc ", hasGps: true },
    })).toEqual({ sport: "rockClimbing", subSport: "bouldering", name: "Bloc", durationSeconds: 5400, hasGps: true });
  });

  it("copes with unknown types and missing metadata", () => {
    expect(hintsFromActivity({ activity_type: "unknown", duration_seconds: 600, raw_metadata: null }))
      .toEqual({ sport: null, subSport: null, name: null, durationSeconds: 600, hasGps: false });
    expect(hintsFromActivity({ activity_type: "training", duration_seconds: 600, raw_metadata: { activityName: 3 } }))
      .toMatchObject({ sport: "training", subSport: null, name: null });
  });
});

describe("filing helpers", () => {
  it("maps training kinds to catalogue methods", () => {
    expect(trainingMethodId("STRENGTH", null)).toBe("strength-conditioning");
    expect(trainingMethodId("MOBILITY", "Yoga hanches")).toBe("mobility");
    expect(trainingMethodId("HANGBOARD", "Poutre")).toBe("max-hangs");
    expect(trainingMethodId("HANGBOARD", "Repeaters 7/3")).toBe("repeaters");
    expect(trainingMethodId("HANGBOARD", "Campus")).toBe("campus");
    expect(trainingMethodId("CARDIO", "Footing")).toBeNull();
    expect(trainingMethodId("OTHER", null)).toBeNull();
  });

  it("resolves an open discipline from the climber's latest séances", () => {
    expect(resolveDiscipline("ROUTE", "INDOOR", [{ discipline: "BOULDER", outdoor: false }])).toBe("ROUTE");
    const recent = [
      { discipline: "BOARD", outdoor: false },
      { discipline: "ROUTE", outdoor: false },
      { discipline: "BOULDER", outdoor: true },
    ];
    expect(resolveDiscipline(null, "OUTDOOR", recent)).toBe("BOULDER");
    expect(resolveDiscipline(null, "INDOOR", recent)).toBe("ROUTE");
    expect(resolveDiscipline(null, "INDOOR", [{ discipline: "BOULDER", outdoor: true }])).toBe("BOULDER");
    expect(resolveDiscipline(null, "INDOOR", [])).toBe("BOULDER");
  });
});

describe("pickVenue", () => {
  // Made-up venues and coordinates.
  const gymA: VenueOption = { id: "gym-a", latitude: 48.85, longitude: 2.35, outdoor: false, hasBouldering: true, hasRoutes: false };
  const gymB: VenueOption = { id: "gym-b", latitude: null, longitude: null, outdoor: false, hasBouldering: true, hasRoutes: true };
  const crag: VenueOption = { id: "crag", latitude: 48.40, longitude: 2.60, outdoor: true, hasBouldering: true, hasRoutes: false };
  const cliff: VenueOption = { id: "cliff", latitude: 47.50, longitude: 3.70, outdoor: true, hasBouldering: false, hasRoutes: true };
  const venues = [gymA, gymB, crag, cliff];
  const base = { venues, recentGymIds: [], favouriteIds: [] } as const;

  it("measures distances", () => {
    expect(distanceMetres({ lat: 48.4, lon: 2.6 }, { lat: 48.4, lon: 2.6 })).toBe(0);
    const oneKm = distanceMetres({ lat: 48.4, lon: 2.6 }, { lat: 48.409, lon: 2.6 });
    expect(oneKm).toBeGreaterThan(990);
    expect(oneKm).toBeLessThan(1010);
  });

  it("picks the nearest venue offering the discipline where the watch started", () => {
    expect(pickVenue({ ...base, discipline: "BOULDER", setting: "OUTDOOR", start: { lat: 48.405, lon: 2.601 } }))
      .toEqual({ gymId: "crag", via: "gps" });
    // Too far from anything: falls back (here to nothing).
    expect(pickVenue({ ...base, discipline: "BOULDER", setting: "OUTDOOR", start: { lat: 45, lon: 5 } })).toBeNull();
    // Near the crag, but it has no routes.
    expect(pickVenue({ ...base, discipline: "ROUTE", setting: "OUTDOOR", start: { lat: 48.401, lon: 2.6 } })).toBeNull();
  });

  it("falls back to the latest séance of that discipline, same setting first", () => {
    const recentGymIds = [
      { gymId: "gym-b", discipline: "BOULDER" },
      { gymId: "crag", discipline: "BOULDER" },
      { gymId: "cliff", discipline: "ROUTE" },
    ];
    expect(pickVenue({ ...base, recentGymIds, discipline: "BOULDER", setting: "OUTDOOR", start: null }))
      .toEqual({ gymId: "crag", via: "recent" });
    expect(pickVenue({ ...base, recentGymIds, discipline: "BOULDER", setting: "INDOOR", start: null }))
      .toEqual({ gymId: "gym-b", via: "recent" });
    expect(pickVenue({ ...base, recentGymIds, discipline: "ROUTE", setting: "INDOOR", start: null }))
      .toEqual({ gymId: "cliff", via: "recent" });
  });

  it("then to a favourite venue offering the discipline", () => {
    expect(pickVenue({ ...base, favouriteIds: ["gym-a", "gym-b"], discipline: "ROUTE", setting: "INDOOR", start: null }))
      .toEqual({ gymId: "gym-b", via: "favourite" });
    expect(pickVenue({ ...base, favouriteIds: ["unknown", "gym-a"], discipline: "BOULDER", setting: "OUTDOOR", start: null }))
      .toEqual({ gymId: "gym-a", via: "favourite" });
  });

  it("returns null when the climber has to pick", () => {
    expect(pickVenue({ ...base, discipline: "BOULDER", setting: "INDOOR", start: null })).toBeNull();
  });
});
