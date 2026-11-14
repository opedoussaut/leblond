"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { MEDIA_BUCKET } from "@/lib/media";
import { PROFILE_PHOTO_FOLDER, PROFILE_PHOTO_MAX_BYTES, isOwnProfilePhotoPath, isProfilePhotoType } from "@/lib/profile-photo";
import type { ActionResult } from "@/lib/validation/common";

const setSchema = z.object({ storagePath: z.string().max(200) });

/**
 * Makes an object the browser has just uploaded to "<me>/profile/" the
 * profile photo. Checks the path is the viewer's own, the object exists with
 * an image type and a small size, then deletes the previous photo.
 */
export async function setProfilePhoto(input: z.input<typeof setSchema>): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = setSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const path = parsed.data.storagePath;
  if (!isOwnProfilePhotoPath(viewer.userId, path)) return { ok: false, error: "forbidden" };

  const storage = viewer.supabase.storage.from(MEDIA_BUCKET);
  const file = path.split("/")[2]!;
  const { data: listed } = await storage.list(`${viewer.userId}/${PROFILE_PHOTO_FOLDER}`, { search: file });
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

  const previous = viewer.profile.avatar_url;
  const { error } = await viewer.supabase.from("profiles").update({ avatar_url: path }).eq("id", viewer.userId);
  if (error) {
    await storage.remove([path]);
    return { ok: false, error: "unknownError" };
  }
  if (previous !== path && isOwnProfilePhotoPath(viewer.userId, previous)) await storage.remove([previous]);
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Removes the uploaded photo: the progression avatar is shown again. */
export async function removeProfilePhoto(): Promise<ActionResult> {
  const viewer = await requireViewer();
  const previous = viewer.profile.avatar_url;
  const { error } = await viewer.supabase.from("profiles").update({ avatar_url: null }).eq("id", viewer.userId);
  if (error) return { ok: false, error: "unknownError" };
  if (isOwnProfilePhotoPath(viewer.userId, previous)) await viewer.supabase.storage.from(MEDIA_BUCKET).remove([previous]);
  revalidatePath("/", "layout");
  return { ok: true };
}
