import "server-only";
import { cache } from "react";
import { getViewer } from "@/lib/auth/viewer";
import { loadAvatar } from "@/lib/data/avatar";
import { MEDIA_BUCKET } from "@/lib/media";
import { isOwnProfilePhotoPath } from "@/lib/profile-photo";

/** Signed URLs for the profile photo last this long (the bucket is private). */
const SIGNED_URL_SECONDS = 3600;

/**
 * A short-lived signed URL for the viewer's uploaded photo, or null when they
 * have none (then the avatar is shown). Signed with the viewer's own session,
 * so the owner-only Storage policy still decides. Once per request.
 */
export const viewerPhotoUrl = cache(async (): Promise<string | null> => {
  const viewer = await getViewer();
  if (!viewer || !isOwnProfilePhotoPath(viewer.userId, viewer.profile.avatar_url)) return null;
  const { data } = await viewer.supabase.storage.from(MEDIA_BUCKET).createSignedUrl(viewer.profile.avatar_url, SIGNED_URL_SECONDS);
  return data?.signedUrl ?? null;
});

/** The viewer's avatar level (0 = White … 6 = Black), once per request. */
export const viewerAvatarLevel = cache(async (): Promise<number> => {
  const viewer = await getViewer();
  if (!viewer) return 0;
  return (await loadAvatar(viewer.supabase)).level;
});

/** What every "you" picture needs: the photo if any, and the avatar level for the ring or the fallback. */
export interface ClimberPicture { photoUrl: string | null; level: number }

export async function viewerPicture(level?: number): Promise<ClimberPicture> {
  const [photoUrl, lvl] = await Promise.all([viewerPhotoUrl(), level ?? viewerAvatarLevel()]);
  return { photoUrl, level: lvl };
}
