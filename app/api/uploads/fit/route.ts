import { randomUUID } from "node:crypto";
import { getViewer } from "@/lib/auth/viewer";
import { overlapsSession } from "@/lib/integrations/wearables/dedup";
import { FitParseError, MAX_FIT_BYTES, parseFitFile } from "@/lib/integrations/wearables/fit/parse";
import { saveWorkout } from "@/lib/integrations/wearables/store";

export const runtime = "nodejs";

/**
 * FIT import (provider-neutral fallback). Validates size and FIT integrity,
 * keeps the raw file in the user's private folder for provenance, normalises
 * it, de-duplicates, and suggests the climbing session it overlaps.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return Response.json({ error: "unauthenticated" }, { status: 401 });
  if (!viewer.active) return Response.json({ error: "forbidden" }, { status: 403 });

  const length = Number(request.headers.get("content-length") ?? 0);
  if (length > MAX_FIT_BYTES + 64 * 1024) return Response.json({ error: "too_large" }, { status: 413 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return Response.json({ error: "invalid_request" }, { status: 400 });
  if (file.size === 0 || file.size > MAX_FIT_BYTES) return Response.json({ error: "too_large" }, { status: 413 });
  if (!file.name.toLowerCase().endsWith(".fit")) return Response.json({ error: "not_fit" }, { status: 415 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const path = `${viewer.userId}/${randomUUID()}.fit`;
  let workout;
  try {
    workout = parseFitFile(bytes, path);
  } catch (e) {
    const code = e instanceof FitParseError ? e.code : "CORRUPT";
    return Response.json({ error: code === "NO_ACTIVITY" ? "no_activity" : "not_fit" }, { status: 422 });
  }

  const result = await saveWorkout(viewer.supabase, viewer.userId, { ...workout, rawFileReference: null }).catch(() => null);
  if (!result) return Response.json({ error: "server_error" }, { status: 500 });
  if (result.status === "duplicate") return Response.json({ status: "duplicate", activityId: result.id });

  // Keep the original file (private bucket, user's folder) and record the reference.
  const { error: upErr } = await viewer.supabase.storage
    .from("wearable-files")
    .upload(path, bytes, { contentType: "application/octet-stream", upsert: false });
  if (!upErr) await viewer.supabase.from("wearable_activities").update({ raw_file_reference: path }).eq("id", result.id);

  const { data: sessions } = await viewer.supabase
    .from("sessions")
    .select("id, started_at, ended_at")
    .gte("started_at", new Date(workout.startedAt.getTime() - 12 * 3_600_000).toISOString())
    .lte("started_at", new Date(workout.startedAt.getTime() + 12 * 3_600_000).toISOString());
  const match = (sessions ?? []).find((s) =>
    overlapsSession(workout, { startedAt: new Date(s.started_at), endedAt: s.ended_at ? new Date(s.ended_at) : null }),
  );
  return Response.json({ status: "inserted", activityId: result.id, suggestedSessionId: match?.id ?? null });
}
