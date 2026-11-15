import { utcToZoned, DEFAULT_TZ } from "@/lib/time";
import { overlapsSession } from "../overlap";

/**
 * Pure helpers (client-safe) for attaching a FIT file to a climbing séance:
 * reading the upload endpoint's answer, deciding what to do with the activity,
 * and pre-filling a past séance's date / time / duration from it.
 */

export type FitUploadErrorCode = "not_fit" | "no_activity" | "too_large" | "unknown";

export type FitUpload =
  | {
      kind: "ok";
      activityId: string;
      /** The activity existed already (same file imported before). */
      duplicate: boolean;
      startedAt: string;
      durationSeconds: number;
      /** Séance the activity is already linked to, if any. */
      linkedSessionId: string | null;
    }
  | { kind: "error"; code: FitUploadErrorCode };

const ERROR_CODES: readonly FitUploadErrorCode[] = ["not_fit", "no_activity", "too_large"];

/** Reads the JSON answer of POST /api/uploads/fit. Anything unexpected is an "unknown" error. */
export function readFitUploadResponse(httpOk: boolean, body: unknown): FitUpload {
  const b = (body && typeof body === "object" ? body : {}) as Record<string, unknown>;
  if (!httpOk) {
    const code = ERROR_CODES.find((c) => c === b.error);
    return { kind: "error", code: code ?? "unknown" };
  }
  const a = (b.activity && typeof b.activity === "object" ? b.activity : {}) as Record<string, unknown>;
  const status = b.status;
  if ((status !== "inserted" && status !== "duplicate") || typeof b.activityId !== "string") return { kind: "error", code: "unknown" };
  if (typeof a.startedAt !== "string" || typeof a.durationSeconds !== "number" || Number.isNaN(Date.parse(a.startedAt))) {
    return { kind: "error", code: "unknown" };
  }
  return {
    kind: "ok",
    activityId: b.activityId,
    duplicate: status === "duplicate",
    startedAt: a.startedAt,
    durationSeconds: a.durationSeconds,
    linkedSessionId: typeof a.sessionId === "string" ? a.sessionId : null,
  };
}

export type FitAttachPlan =
  /** Already linked to this séance: nothing to do. */
  | "already"
  /** Linked to another séance: never moved silently. */
  | "elsewhere"
  /** Overlaps the séance: link straight away (the watch's times win, and the change is shown). */
  | "link"
  /** Does not overlap: ask before the séance moves to the file's times. */
  | "confirm";

export function planFitAttach(
  upload: { activityId: string; startedAt: string; durationSeconds: number; linkedSessionId: string | null },
  session: { id: string; startedAt: string; endedAt: string | null },
): FitAttachPlan {
  if (upload.linkedSessionId === session.id) return "already";
  if (upload.linkedSessionId) return "elsewhere";
  const overlaps = overlapsSession(
    { startedAt: new Date(upload.startedAt), durationSeconds: upload.durationSeconds },
    { startedAt: new Date(session.startedAt), endedAt: session.endedAt ? new Date(session.endedAt) : null },
  );
  return overlaps ? "link" : "confirm";
}

/** Bounds of the past-séance form's duration field (createPastSession accepts 10–720 min). */
export const PAST_MIN_MINUTES = 10;
export const PAST_MAX_MINUTES = 720;

/**
 * Date, start time (climber's time zone) and duration for the past-séance form.
 * The duration is clamped to what the form accepts; once linked, the séance
 * takes the watch's exact times anyway.
 */
export function prefillFromActivity(
  activity: { startedAt: string; durationSeconds: number },
  timeZone = DEFAULT_TZ,
): { date: string; time: string; minutes: number } {
  const { date, time } = utcToZoned(activity.startedAt, timeZone);
  const raw = Math.round(activity.durationSeconds / 60);
  return { date, time, minutes: Math.min(PAST_MAX_MINUTES, Math.max(PAST_MIN_MINUTES, raw)) };
}
