import { describe, expect, it } from "vitest";
import type { FitHints } from "@/lib/integrations/wearables/fit/classify";
import {
  activityNameOf,
  choiceFor,
  choiceFromDetection,
  importedWhat,
  pickVenueHref,
  readFitImportResponse,
  readImportedAs,
} from "@/lib/integrations/wearables/fit/import-flow";
import { fitImportDictionary } from "@/lib/i18n/fit-import";

const ACTIVITY = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const hints = (h: Partial<FitHints>): FitHints => ({ sport: null, subSport: null, name: null, durationSeconds: 3600, hasGps: false, ...h });

describe("readFitImportResponse", () => {
  it("reads a filed séance and an existing one", () => {
    expect(readFitImportResponse(true, { status: "created", activityId: ACTIVITY, href: `/session/${SESSION}` }))
      .toEqual({ kind: "created", activityId: ACTIVITY, href: `/session/${SESSION}` });
    expect(readFitImportResponse(true, { status: "existing", activityId: ACTIVITY, href: `/train/sessions/${SESSION}` }))
      .toEqual({ kind: "existing", activityId: ACTIVITY, href: `/train/sessions/${SESSION}` });
    expect(readFitImportResponse(true, { status: "needs_venue", activityId: ACTIVITY, href: pickVenueHref(ACTIVITY) }))
      .toEqual({ kind: "needs_venue", activityId: ACTIVITY, href: `/session/new?where=past&fit=${ACTIVITY}` });
  });

  it("reads a question with the activity's timing", () => {
    expect(readFitImportResponse(true, {
      status: "ask", activityId: ACTIVITY, activity: { startedAt: "2026-11-14T16:00:00Z", durationSeconds: 3600 },
    })).toEqual({ kind: "ask", activityId: ACTIVITY, startedAt: "2026-11-14T16:00:00Z", durationSeconds: 3600 });
  });

  it("never follows a link outside the app's séance pages", () => {
    expect(readFitImportResponse(true, { status: "created", activityId: ACTIVITY, href: "https://example.com/x" }))
      .toEqual({ kind: "error", code: "unknown" });
    expect(readFitImportResponse(true, { status: "created", activityId: ACTIVITY, href: "//evil.test/session/1" }))
      .toEqual({ kind: "error", code: "unknown" });
    expect(readFitImportResponse(true, { status: "created", activityId: ACTIVITY, href: "/settings" }))
      .toEqual({ kind: "error", code: "unknown" });
  });

  it("maps errors", () => {
    expect(readFitImportResponse(false, { error: "future" })).toEqual({ kind: "error", code: "future" });
    expect(readFitImportResponse(false, { error: "not_fit" })).toEqual({ kind: "error", code: "not_fit" });
    expect(readFitImportResponse(false, { error: "server_error" })).toEqual({ kind: "error", code: "unknown" });
    expect(readFitImportResponse(true, { status: "ask", activityId: ACTIVITY })).toEqual({ kind: "error", code: "unknown" });
    expect(readFitImportResponse(true, null)).toEqual({ kind: "error", code: "unknown" });
  });
});

describe("choices", () => {
  it("turns a detection into what to file", () => {
    expect(choiceFromDetection({ kind: "CLIMB", discipline: null, setting: "OUTDOOR", source: "sport" }))
      .toEqual({ kind: "CLIMB", discipline: null, setting: "OUTDOOR" });
    expect(choiceFromDetection({ kind: "TRAINING", training: "CARDIO", source: "name" })).toEqual({ kind: "TRAINING", training: "CARDIO" });
  });

  it("completes the climber's pick from the file", () => {
    // Boulders outdoors when the watch had GPS and the file did not say.
    expect(choiceFor(hints({ hasGps: true }), "BOULDER")).toEqual({ kind: "CLIMB", discipline: "BOULDER", setting: "OUTDOOR" });
    // Indoor per the file's sport, whatever the GPS.
    expect(choiceFor(hints({ sport: "rockClimbing", subSport: "indoorClimbing", hasGps: true }), "BOULDER"))
      .toEqual({ kind: "CLIMB", discipline: "BOULDER", setting: "INDOOR" });
    expect(choiceFor(hints({ sport: "training", subSport: "yoga" }), "TRAINING")).toEqual({ kind: "TRAINING", training: "MOBILITY" });
    // Climbing per the watch, training per the climber: the name can still say which training.
    expect(choiceFor(hints({ sport: "rockClimbing", name: "Poutre" }), "TRAINING")).toEqual({ kind: "TRAINING", training: "HANGBOARD" });
    expect(choiceFor(hints({ sport: "rockClimbing", subSport: "bouldering" }), "TRAINING")).toEqual({ kind: "TRAINING", training: "OTHER" });
  });
});

describe("imported-as marker", () => {
  it("names what was filed", () => {
    expect(importedWhat({ kind: "CLIMB", discipline: "ROUTE", setting: "OUTDOOR" })).toBe("ROUTE_OUTDOOR");
    expect(importedWhat({ kind: "TRAINING", training: "STRENGTH" })).toBe("STRENGTH");
  });

  it("reads it back, and ignores anything malformed", () => {
    expect(readImportedAs({ source: "fit-file", importedAs: { what: "BOULDER_INDOOR", by: "sport", via: "recent" } }))
      .toEqual({ what: "BOULDER_INDOOR", by: "sport", via: "recent" });
    expect(readImportedAs({ importedAs: { what: "MOBILITY", by: "climber" } })).toEqual({ what: "MOBILITY", by: "climber", via: null });
    expect(readImportedAs({ importedAs: { what: "SKYDIVING", by: "sport" } })).toBeNull();
    expect(readImportedAs({ importedAs: "yes" })).toBeNull();
    expect(readImportedAs({ source: "fit-file" })).toBeNull();
    expect(readImportedAs(null)).toBeNull();
  });

  it("has a label for everything it can say, in both languages", () => {
    for (const locale of ["fr", "en"] as const) {
      const d = fitImportDictionary(locale);
      for (const what of ["BOULDER_INDOOR", "BOULDER_OUTDOOR", "ROUTE_INDOOR", "ROUTE_OUTDOOR", "STRENGTH", "HANGBOARD", "MOBILITY", "CARDIO", "OTHER"] as const) {
        expect(d.what[what]).toBeTruthy();
      }
      for (const kind of ["STRENGTH", "HANGBOARD", "MOBILITY", "CARDIO", "OTHER"] as const) expect(d.defaultTitle[kind]).toBeTruthy();
    }
  });

  it("shows an activity name only when it has words", () => {
    expect(activityNameOf({ activityName: " Poutre " })).toBe("Poutre");
    expect(activityNameOf({ activityName: " — " })).toBeNull();
    expect(activityNameOf({})).toBeNull();
    expect(activityNameOf(null)).toBeNull();
  });
});
