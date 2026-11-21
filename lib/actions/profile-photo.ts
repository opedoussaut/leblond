"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { MEDIA_BUCKET } from "@/lib/media";
import { checkUploadedPhoto } from "@/lib/data/uploaded-photo";
import { PROFILE_PHOTO_FOLDER, isOwnProfilePhotoPath } from "@/lib/profile-photo";
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
  const check = await checkUploadedPhoto(viewer.supabase, viewer.userId, PROFILE_PHOTO_FOLDER, path);
  if (!check.ok) return check;
  const storage = viewer.supabase.storage.from(MEDIA_BUCKET);

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
