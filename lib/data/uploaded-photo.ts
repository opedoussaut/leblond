import "server-only";
import { MEDIA_BUCKET } from "@/lib/media";
import { PROFILE_PHOTO_MAX_BYTES, isOwnPhotoPath, isProfilePhotoType, type PhotoFolder } from "@/lib/profile-photo";
import type { ServerSupabase } from "@/lib/supabase/server";

/** Signed URLs for a private photo last this long. */
export const PHOTO_URL_SECONDS = 3600;

export type PhotoCheck = { ok: true } | { ok: false; error: "forbidden" | "notFound" | "tooLarge" | "badType" };

/**
 * Checks an object the browser has just uploaded to "<me>/<folder>/" before it
 * becomes a picture: the path is the viewer's own, the object exists, it is
 * small and an image. A file that fails the size or type check is removed.
 */
export async function checkUploadedPhoto(supabase: ServerSupabase, userId: string, folder: PhotoFolder, path: string): Promise<PhotoCheck> {
  if (!isOwnPhotoPath(userId, folder, path)) return { ok: false, error: "forbidden" };
  const storage = supabase.storage.from(MEDIA_BUCKET);
  const file = path.split("/")[2]!;
  const { data: listed } = await storage.list(`${userId}/${folder}`, { search: file });
  const object = listed?.find((o) => o.name === file);
  if (!object) return { ok: false, error: "notFound" };
  const meta = (object.metadata ?? {}) as { size?: number; mimetype?: string };
  if (typeof meta.size === "number" && meta.size > PROFILE_PHOTO_MAX_BYTES) {
    await storage.remove([path]);
    return { ok: false, error: "tooLarge" };
  }
  if (typeof meta.mimetype === "string" && !isProfilePhotoType(meta.mimetype)) {
    await storage.remove([path]);
    return { ok: false, error: "badType" };
  }
  return { ok: true };
}

/** A short-lived signed URL for one of the viewer's own photos (the owner-only Storage policy still decides). */
export async function signedPhotoUrl(supabase: ServerSupabase, path: string): Promise<string | null> {
  const { data } = await supabase.storage.from(MEDIA_BUCKET).createSignedUrl(path, PHOTO_URL_SECONDS);
  return data?.signedUrl ?? null;
}
