/** Shared upload constraints (also enforced by the private Storage bucket). */
export const MEDIA_BUCKET = "media";
export const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"] as const;

export function mediaKind(mime: string): "image" | "video" | null {
  if ((IMAGE_TYPES as readonly string[]).includes(mime)) return "image";
  if ((VIDEO_TYPES as readonly string[]).includes(mime)) return "video";
  return null;
}

export function extensionFor(mime: string): string {
  return (
    {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/heic": "heic",
      "image/heif": "heif",
      "video/mp4": "mp4",
      "video/quicktime": "mov",
      "video/webm": "webm",
    } as Record<string, string>
  )[mime] ?? "bin";
}

/** Objects are always stored under "<userId>/…" — the RLS policy relies on it. */
export function mediaPath(userId: string, problemId: string, id: string, mime: string): string {
  return `${userId}/${problemId}/${id}.${extensionFor(mime)}`;
}
