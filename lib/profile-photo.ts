/**
 * The climber's profile picture: their own photo when they uploaded one,
 * otherwise their progression avatar (White→Black). Shared by the browser
 * (upload) and the server (validation, signed URL).
 *
 * The photo lives in the private "media" bucket under
 * "<userId>/profile/<id>.<ext>": the existing owner-only Storage policies
 * (first folder = auth.uid()) cover it, so nothing about storage security
 * changes. `profiles.avatar_url` stores that path, never a public URL.
 */

/** Folder under the climber's own prefix. */
export const PROFILE_PHOTO_FOLDER = "profile";
/** The rival's photo, when the climber gives it one (`alter_ego_pacts.photo_path`). */
export const RIVAL_PHOTO_FOLDER = "rival";
/** The single-picture folders: same size, types and checks. */
export type PhotoFolder = typeof PROFILE_PHOTO_FOLDER | typeof RIVAL_PHOTO_FOLDER;
/** The browser crops and resizes to a square this many pixels wide. */
export const PROFILE_PHOTO_SIZE = 512;
/** What the server accepts once resized (a 512 px photo is ~50–150 KB). */
export const PROFILE_PHOTO_MAX_BYTES = 2 * 1024 * 1024;
/** Before resizing: the same limit as any other photo upload. */
export const PROFILE_PHOTO_SOURCE_MAX_BYTES = 15 * 1024 * 1024;
export const PROFILE_PHOTO_TYPES = ["image/webp", "image/jpeg", "image/png"] as const;
export type ProfilePhotoType = (typeof PROFILE_PHOTO_TYPES)[number];

const EXTENSIONS: Record<ProfilePhotoType, string> = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

export function isProfilePhotoType(mime: string): mime is ProfilePhotoType {
  return (PROFILE_PHOTO_TYPES as readonly string[]).includes(mime);
}

export function photoObjectPath(userId: string, folder: PhotoFolder, id: string, mime: ProfilePhotoType): string {
  return `${userId}/${folder}/${id}.${EXTENSIONS[mime]}`;
}

export function profilePhotoPath(userId: string, id: string, mime: ProfilePhotoType): string {
  return photoObjectPath(userId, PROFILE_PHOTO_FOLDER, id, mime);
}

const FILE_NAME = /^[0-9a-f-]{36}\.(webp|jpg|png)$/;

/**
 * True only for "<userId>/<folder>/<uuid>.<webp|jpg|png>". Anything else in
 * `avatar_url` or `photo_path` (an old value, a hand-edited row, another
 * user's folder) is ignored and the drawn picture is shown instead.
 */
export function isOwnPhotoPath(userId: string, folder: PhotoFolder, path: string | null | undefined): path is string {
  if (!path || !userId) return false;
  const parts = path.split("/");
  return parts.length === 3 && parts[0] === userId && parts[1] === folder && FILE_NAME.test(parts[2]!);
}

export function isOwnProfilePhotoPath(userId: string, path: string | null | undefined): path is string {
  return isOwnPhotoPath(userId, PROFILE_PHOTO_FOLDER, path);
}

/** The picture to show: the uploaded photo if there is one, else the avatar. */
export type PictureSource = { kind: "photo"; src: string } | { kind: "avatar"; level: number };

export function pictureSource(photoUrl: string | null | undefined, level: number): PictureSource {
  return photoUrl ? { kind: "photo", src: photoUrl } : { kind: "avatar", level };
}

/** Centre square crop of a w×h image (the largest square that fits). */
export function squareCrop(width: number, height: number): { sx: number; sy: number; side: number } {
  const side = Math.min(width, height);
  return { sx: Math.round((width - side) / 2), sy: Math.round((height - side) / 2), side };
}
