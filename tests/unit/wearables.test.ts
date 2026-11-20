import { Encoder, Profile, type FileIdMesg, type RecordMesg, type SessionMesg, type SportMesg, type WorkoutMesg } from "@garmin/fitsdk";
import { describe, expect, it } from "vitest";
import {
  computeDedupKey,
  findDuplicate,
  isLikelySameWorkout,
  overlapsSession,
} from "@/lib/integrations/wearables/dedup";
import { FitParseError, parseFitFile } from "@/lib/integrations/wearables/fit/parse";
import { canStartAuthorization, resolveProviderStatus } from "@/lib/integrations/wearables/status";

const START = new Date("2026-09-20T18:00:00Z");

function makeFit(opts: { withSession?: boolean; hr?: number[] } = {}): Uint8Array {
  const enc = new Encoder();
  enc.onMesg(Profile.MesgNum.FILE_ID, {
    type: "activity",
    manufacturer: "development",
    product: 1,
    serialNumber: 123456,
    timeCreated: START,
  } as FileIdMesg);
  const hr = opts.hr ?? [100, 120, 140, 160];
  hr.forEach((bpm, i) => {
    enc.onMesg(Profile.MesgNum.RECORD, { timestamp: new Date(START.getTime() + i * 60_000), heartRate: bpm } as RecordMesg);
  });
  if (opts.withSession !== false) {
    enc.onMesg(Profile.MesgNum.SESSION, {
      timestamp: new Date(START.getTime() + 5400_000),
      startTime: START,
      totalElapsedTime: 5400,
      totalTimerTime: 5300,
      totalCalories: 640,
      avgHeartRate: 123,
      maxHeartRate: 158,
      sport: "rockClimbing",
    } as SessionMesg);
  }
  return enc.close();
}

describe("FIT import", () => {
  it("normalises a FIT activity using only fields present in the file", () => {
    const w = parseFitFile(makeFit(), "user/file.fit");
    expect(w).toMatchObject({
      provider: "FIT_IMPORT",
      externalActivityId: `fit:123456:${START.getTime() / 1000}`,
      startedAt: START,
      durationSeconds: 5400,
      calories: 640,
      avgHeartRate: 123,
      maxHeartRate: 158,
      trainingLoad: null,
      rawFileReference: "user/file.fit",
    });
    expect(w.activityType).toContain("rockClimbing");
    expect(w.heartRateSamples?.length).toBe(4);
  });

  it("derives duration and heart rate from records when no session summary exists", () => {
    const w = parseFitFile(makeFit({ withSession: false, hr: [90, 110, 130] }));
    expect(w.durationSeconds).toBe(120);
    expect(w.avgHeartRate).toBe(110);
    expect(w.maxHeartRate).toBe(130);
    expect(w.calories).toBeNull();
    expect(w.rawMetadata.heartRateFrom).toBe("records");
  });

  it("keeps the activity's names and whether it had GPS, but never the position", () => {
    const enc = new Encoder();
    enc.onMesg(Profile.MesgNum.FILE_ID, { type: "activity", manufacturer: "development", product: 1, serialNumber: 7, timeCreated: START } as FileIdMesg);
    enc.onMesg(Profile.MesgNum.SPORT, { sport: "rockClimbing", subSport: "bouldering", name: "Bloc" } as SportMesg);
    enc.onMesg(Profile.MesgNum.WORKOUT, { sport: "rockClimbing", wktName: "Pyramide 6A" } as WorkoutMesg);
    // Made-up place: semicircles for 48.4° N, 2.6° E.
    const toSemi = (deg: number) => Math.round((deg * 2 ** 31) / 180);
    enc.onMesg(Profile.MesgNum.RECORD, { timestamp: START, heartRate: 100, positionLat: toSemi(48.4), positionLong: toSemi(2.6) } as RecordMesg);
    enc.onMesg(Profile.MesgNum.RECORD, { timestamp: new Date(START.getTime() + 600_000), heartRate: 120 } as RecordMesg);
    const w = parseFitFile(enc.close());
    // No session message: sport and sub-sport come from the sport message.
    expect(w.activityType).toBe("rockClimbing/bouldering");
    expect(w.rawMetadata).toMatchObject({ activityName: "Bloc · Pyramide 6A", hasGps: true });
    expect(w.startPosition?.lat).toBeCloseTo(48.4, 5);
    expect(w.startPosition?.lon).toBeCloseTo(2.6, 5);
    expect(JSON.stringify(w.rawMetadata)).not.toContain("48.4");
  });

  it("reads the sport profile name from the session and reports no GPS when there is none", () => {
    const enc = new Encoder();
    enc.onMesg(Profile.MesgNum.FILE_ID, { type: "activity", manufacturer: "development", product: 1, serialNumber: 8, timeCreated: START } as FileIdMesg);
    enc.onMesg(Profile.MesgNum.RECORD, { timestamp: START, heartRate: 90 } as RecordMesg);
    enc.onMesg(Profile.MesgNum.SESSION, {
      timestamp: new Date(START.getTime() + 1800_000), startTime: START, totalElapsedTime: 1800,
      sport: "training", subSport: "strengthTraining", sportProfileName: "Renfo",
    } as SessionMesg);
    const w = parseFitFile(enc.close());
    expect(w.activityType).toBe("training/strengthTraining");
    expect(w.rawMetadata).toMatchObject({ activityName: "Renfo", hasGps: false });
    expect(w.startPosition).toBeNull();
  });

  it("rejects files that are not FIT", () => {
    expect(() => parseFitFile(new TextEncoder().encode("hello world, not a fit file"))).toThrow(FitParseError);
  });

  it("rejects corrupted FIT files", () => {
    const bytes = makeFit();
    bytes[bytes.length - 1] ^= 0xff; // break CRC
    expect(() => parseFitFile(bytes)).toThrow(FitParseError);
  });
});

describe("wearable activity de-duplication", () => {
  const a = { startedAt: START, durationSeconds: 5400 };

  it("matches the same workout from two providers within tolerance", () => {
    const b = { startedAt: new Date(START.getTime() + 45_000), durationSeconds: 5420 };
    expect(isLikelySameWorkout(a, b)).toBe(true);
    expect(findDuplicate(b, [a])).toBe(a);
  });

  it("does not merge different workouts", () => {
    expect(isLikelySameWorkout(a, { startedAt: new Date(START.getTime() + 10 * 60_000), durationSeconds: 5400 })).toBe(false);
    expect(isLikelySameWorkout(a, { startedAt: START, durationSeconds: 3600 })).toBe(false);
  });

  it("produces a stable key for identical metadata", () => {
    expect(computeDedupKey(a)).toBe(computeDedupKey({ startedAt: new Date(START.getTime() + 20_000), durationSeconds: 5410 }));
    expect(computeDedupKey(a)).not.toBe(computeDedupKey({ startedAt: START, durationSeconds: 3600 }));
  });

  it("suggests the climbing session that overlaps the workout", () => {
    const session = { startedAt: new Date(START.getTime() + 5 * 60_000), endedAt: new Date(START.getTime() + 95 * 60_000) };
    expect(overlapsSession(a, session)).toBe(true);
    expect(overlapsSession(a, { startedAt: new Date(START.getTime() + 6 * 3_600_000), endedAt: null })).toBe(false);
  });
});

describe("provider status — never falsely connected", () => {
  const base = { plannedOnly: false, configured: true, environment: "production" as const, connection: null };

  it("requires approval when credentials are missing, even with a stale connection row", () => {
    expect(resolveProviderStatus({ ...base, configured: false })).toBe("REQUIRES_PROVIDER_APPROVAL");
    expect(resolveProviderStatus({ ...base, configured: false, connection: { status: "CONNECTED" } })).toBe(
      "REQUIRES_PROVIDER_APPROVAL",
    );
  });

  it("is AVAILABLE (not CONNECTED) when configured but never authorised", () => {
    expect(resolveProviderStatus(base)).toBe("AVAILABLE");
    expect(resolveProviderStatus({ ...base, environment: "development" })).toBe("DEVELOPMENT_TESTING");
  });

  it("is CONNECTED only with a stored successful authorisation", () => {
    expect(resolveProviderStatus({ ...base, connection: { status: "CONNECTED" } })).toBe("CONNECTED");
    expect(resolveProviderStatus({ ...base, connection: { status: "ERROR" } })).toBe("ERROR");
    expect(resolveProviderStatus({ ...base, connection: { status: "DISCONNECTED" } })).toBe("DISCONNECTED");
  });

  it("reports planned providers as not yet available", () => {
    expect(resolveProviderStatus({ ...base, plannedOnly: true })).toBe("NOT_YET_AVAILABLE");
  });

  it("only offers authorization when it can actually start", () => {
    expect(canStartAuthorization("AVAILABLE")).toBe(true);
    expect(canStartAuthorization("REQUIRES_PROVIDER_APPROVAL")).toBe(false);
    expect(canStartAuthorization("CONNECTED")).toBe(false);
    expect(canStartAuthorization("NOT_YET_AVAILABLE")).toBe(false);
  });
});
