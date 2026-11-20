import "server-only";
import { randomUUID } from "node:crypto";
import type { Viewer } from "@/lib/auth/viewer";
import { FitParseError, MAX_FIT_BYTES, parseFitFile } from "./parse";
import { saveWorkout } from "../store";
import type { NormalizedWorkout } from "../types";

/**
 * Receives one uploaded .fit file (shared by /api/uploads/fit and
 * /api/uploads/fit/import): size and FIT checks, Garmin SDK parsing,
 * de-duplication, and the raw file kept in the climber's private folder.
 */
export type ReceivedFit =
  | { ok: false; status: number; error: "too_large" | "invalid_request" | "not_fit" | "no_activity" | "server_error" }
  | {
      ok: true;
      /** The parsed file, in memory (start position included, never stored). */
      workout: NormalizedWorkout;
      activityId: string;
      duplicate: boolean;
      /** As stored (for a duplicate: the first import's values). */
      activity: { startedAt: string; durationSeconds: number; sessionId: string | null; trainingSessionId: string | null };
    };

export async function receiveFitUpload(viewer: Viewer, request: Request): Promise<ReceivedFit> {
  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_FIT_BYTES + 64 * 1024) return { ok: false, status: 413, error: "too_large" };

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return { ok: false, status: 400, error: "invalid_request" };
  if (file.size === 0 || file.size > MAX_FIT_BYTES) return { ok: false, status: 413, error: "too_large" };
  if (!file.name.toLowerCase().endsWith(".fit")) return { ok: false, status: 415, error: "not_fit" };

  const bytes = new Uint8Array(await file.arrayBuffer());
  const path = `${viewer.userId}/${randomUUID()}.fit`;
  let workout: NormalizedWorkout;
  try {
    workout = parseFitFile(bytes, path);
  } catch (e) {
    const code = e instanceof FitParseError ? e.code : "CORRUPT";
    return { ok: false, status: 422, error: code === "NO_ACTIVITY" ? "no_activity" : "not_fit" };
  }

  const result = await saveWorkout(viewer.supabase, viewer.userId, { ...workout, rawFileReference: null }).catch(() => null);
  if (!result) return { ok: false, status: 500, error: "server_error" };
  if (result.status === "duplicate") {
    const { data: existing } = await viewer.supabase
      .from("wearable_activities")
      .select("started_at, duration_seconds, session_id, training_session_id")
      .eq("id", result.id)
      .maybeSingle();
    if (!existing) return { ok: false, status: 500, error: "server_error" };
    return {
      ok: true, workout, activityId: result.id, duplicate: true,
      activity: {
        startedAt: existing.started_at, durationSeconds: existing.duration_seconds,
        sessionId: existing.session_id, trainingSessionId: existing.training_session_id,
      },
    };
  }

  // Keep the original file (private bucket, climber's folder) and record the reference.
  const { error: upErr } = await viewer.supabase.storage
    .from("wearable-files")
    .upload(path, bytes, { contentType: "application/octet-stream", upsert: false });
  if (!upErr) await viewer.supabase.from("wearable_activities").update({ raw_file_reference: path }).eq("id", result.id);

  return {
    ok: true, workout, activityId: result.id, duplicate: false,
    activity: { startedAt: workout.startedAt.toISOString(), durationSeconds: workout.durationSeconds, sessionId: null, trainingSessionId: null },
  };
}
