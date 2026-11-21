import { PROFILE_PHOTO_SIZE, squareCrop, type ProfilePhotoType } from "@/lib/profile-photo";

/**
 * Browser only: crops a photo to a centred square and resizes it to 512 px
 * (WebP, else JPEG). Used for the profile photo and the rival's photo.
 */
export async function resizeSquarePhoto(file: File): Promise<{ blob: Blob; type: ProfilePhotoType }> {
  const bitmap = await createImageBitmap(file);
  const { sx, sy, side } = squareCrop(bitmap.width, bitmap.height);
  const out = Math.min(PROFILE_PHOTO_SIZE, side);
  const canvas = document.createElement("canvas");
  canvas.width = out;
  canvas.height = out;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, out, out);
  bitmap.close();
  const encode = (type: string, quality: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, quality));
  // Safari may not encode WebP: it then returns a PNG, so fall back to JPEG.
  const webp = await encode("image/webp", 0.86);
  if (webp?.type === "image/webp") return { blob: webp, type: "image/webp" };
  const jpeg = await encode("image/jpeg", 0.88);
  if (!jpeg) throw new Error("encode");
  return { blob: jpeg, type: "image/jpeg" };
}
