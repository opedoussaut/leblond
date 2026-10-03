import { createHash } from "node:crypto";
import { Decoder, Stream } from "@garmin/fitsdk";
import type { HeartRateSample, NormalizedWorkout } from "../types";

/**
 * Universal FIT import (brief §20). Uses Garmin's official FIT JavaScript SDK
 * to decode activity files exported by COROS, Suunto, Garmin and most other
 * sport watches. Only fields actually present in the file are kept.
 */

export const MAX_FIT_BYTES = 4 * 1024 * 1024;

export class FitParseError extends Error {
  constructor(readonly code: "NOT_FIT" | "CORRUPT" | "NO_ACTIVITY" | "TOO_LARGE") {
    super(code);
  }
}

type Msg = Record<string, unknown>;

const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const str = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const date = (v: unknown): Date | null => (v instanceof Date && !Number.isNaN(v.getTime()) ? v : null);

/** Keep at most one heart-rate point every `stepSeconds`. */
export function downsampleHeartRate(samples: HeartRateSample[], stepSeconds = 5): HeartRateSample[] {
  const out: HeartRateSample[] = [];
  let next = 0;
  for (const s of samples) {
    if (s.t >= next) {
      out.push(s);
      next = s.t + stepSeconds;
    }
  }
  return out;
}

export function parseFitFile(bytes: Uint8Array, rawFileReference: string | null = null): NormalizedWorkout {
  if (bytes.byteLength > MAX_FIT_BYTES) throw new FitParseError("TOO_LARGE");
  const stream = Stream.fromByteArray(Array.from(bytes));
  if (!Decoder.isFIT(stream)) throw new FitParseError("NOT_FIT");
  const decoder = new Decoder(stream);
  if (!decoder.checkIntegrity()) throw new FitParseError("CORRUPT");
  const { messages, errors } = decoder.read({
    applyScaleAndOffset: true,
    expandSubFields: true,
    expandComponents: true,
    convertTypesToStrings: true,
    convertDateTimesToDates: true,
    includeUnknownData: false,
    mergeHeartRates: true,
  });
  if (errors.length) throw new FitParseError("CORRUPT");

  const m = messages as Record<string, Msg[] | undefined>;
  const session = m.sessionMesgs?.[0];
  const fileId = m.fileIdMesgs?.[0];
  const records = m.recordMesgs ?? [];

  const firstRecordTime = date(records[0]?.timestamp);
  const lastRecordTime = date(records.at(-1)?.timestamp);
  const startedAt = date(session?.startTime) ?? firstRecordTime ?? date(fileId?.timeCreated);
  const durationSeconds =
    num(session?.totalElapsedTime) ??
    num(session?.totalTimerTime) ??
    (firstRecordTime && lastRecordTime ? (lastRecordTime.getTime() - firstRecordTime.getTime()) / 1000 : null);
  if (!startedAt || durationSeconds === null || durationSeconds <= 0) throw new FitParseError("NO_ACTIVITY");

  const hr: HeartRateSample[] = [];
  for (const r of records) {
    const t = date(r.timestamp);
    const bpm = num(r.heartRate);
    if (t && bpm && bpm > 0) hr.push({ t: Math.round((t.getTime() - startedAt.getTime()) / 1000), bpm });
  }
  const avgFromRecords = hr.length ? Math.round(hr.reduce((s, x) => s + x.bpm, 0) / hr.length) : null;
  const maxFromRecords = hr.length ? Math.max(...hr.map((x) => x.bpm)) : null;

  const manufacturer = str(fileId?.manufacturer);
  const product = str(fileId?.garminProduct) ?? str(fileId?.productName) ?? (num(fileId?.product) !== null ? String(fileId?.product) : null);
  const serial = num(fileId?.serialNumber);
  const created = date(fileId?.timeCreated);
  const externalActivityId =
    serial !== null && created
      ? `fit:${serial}:${Math.floor(created.getTime() / 1000)}`
      : `fit:sha256:${createHash("sha256").update(bytes).digest("hex").slice(0, 40)}`;

  const recovery: Record<string, number> = {};
  const te = num(session?.totalTrainingEffect);
  if (te !== null) recovery.aerobicTrainingEffect = te;
  const ate = num(session?.totalAnaerobicTrainingEffect);
  if (ate !== null) recovery.anaerobicTrainingEffect = ate;

  return {
    provider: "FIT_IMPORT",
    externalActivityId,
    activityType: [str(session?.sport), str(session?.subSport)].filter(Boolean).join("/") || "unknown",
    startedAt,
    durationSeconds: Math.round(durationSeconds),
    calories: num(session?.totalCalories),
    avgHeartRate: num(session?.avgHeartRate) ?? avgFromRecords,
    maxHeartRate: num(session?.maxHeartRate) ?? maxFromRecords,
    heartRateSamples: hr.length ? downsampleHeartRate(hr) : null,
    trainingLoad: num(session?.trainingLoadPeak),
    recoveryMetrics: Object.keys(recovery).length ? recovery : null,
    deviceName: [manufacturer, product].filter(Boolean).join(" ") || null,
    deviceManufacturer: manufacturer,
    rawFileReference,
    rawMetadata: {
      source: "fit-file",
      hasSessionMessage: Boolean(session),
      records: records.length,
      heartRateFrom: num(session?.avgHeartRate) !== null ? "session" : hr.length ? "records" : "none",
    },
  };
}
