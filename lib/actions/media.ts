"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { MEDIA_TYPES } from "@/lib/climbing/types";
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, MEDIA_BUCKET, mediaKind } from "@/lib/media";
import type { ActionResult } from "@/lib/validation/common";

const registerSchema = z.object({
  storagePath: z.string().max(300),
  problemId: z.uuid(),
  sessionId: z.uuid().nullable(),
  attemptId: z.uuid().nullable(),
  mediaType: z.enum(MEDIA_TYPES),
  mimeType: z.string().max(60),
  sizeBytes: z.number().int().positive(),
  durationSeconds: z.number().positive().max(3600).nullable(),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
});

/**
 * Records an object the browser has just uploaded to the private bucket.
 * Validates ownership (path prefix), type/size, and that the object exists.
 */
export async function registerMedia(input: z.input<typeof registerSchema>): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = registerSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const kind = mediaKind(v.mimeType);
  if (!kind) return { ok: false, error: "badType" };
  if (v.sizeBytes > (kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES)) return { ok: false, error: "tooLarge" };
  if (kind === "image" ? v.mediaType !== "PROBLEM_PHOTO" : v.mediaType === "PROBLEM_PHOTO") {
    return { ok: false, error: "badType" };
  }
  const [owner, folder, file] = v.storagePath.split("/");
  if (owner !== viewer.userId || folder !== v.problemId || !file || v.storagePath.split("/").length !== 3) {
    return { ok: false, error: "forbidden" };
  }
  const { data: listed } = await viewer.supabase.storage.from(MEDIA_BUCKET).list(`${owner}/${folder}`, { search: file });
  if (!listed?.some((o) => o.name === file)) return { ok: false, error: "notFound" };

  const { error } = await viewer.supabase.from("media").insert({
    user_id: viewer.userId,
    problem_id: v.problemId,
    session_id: v.sessionId,
    attempt_id: v.attemptId,
    media_type: v.mediaType,
    storage_path: v.storagePath,
    mime_type: v.mimeType,
    size_bytes: v.sizeBytes,
    duration_seconds: v.durationSeconds,
    width: v.width,
    height: v.height,
  });
  if (error) {
    await viewer.supabase.storage.from(MEDIA_BUCKET).remove([v.storagePath]);
    return { ok: false, error: "unknownError" };
  }
  if (v.mediaType === "PROBLEM_PHOTO") {
    await viewer.supabase.from("problems").update({ photo_url: v.storagePath }).eq("id", v.problemId).is("photo_url", null);
  }
  revalidatePath(`/problem/${v.problemId}`);
  return { ok: true };
}

export async function deleteMedia(mediaId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!z.uuid().safeParse(mediaId).success) return { ok: false, error: "invalid" };
  const { data: m } = await viewer.supabase.from("media").select("storage_path, problem_id").eq("id", mediaId).single();
  if (!m) return { ok: false, error: "notFound" };
  await viewer.supabase.storage.from(MEDIA_BUCKET).remove([m.storage_path]);
  const { error } = await viewer.supabase.from("media").delete().eq("id", mediaId);
  if (error) return { ok: false, error: "unknownError" };
  if (m.problem_id) {
    await viewer.supabase.from("problems").update({ photo_url: null }).eq("id", m.problem_id).eq("photo_url", m.storage_path);
    revalidatePath(`/problem/${m.problem_id}`);
  }
  return { ok: true };
}
