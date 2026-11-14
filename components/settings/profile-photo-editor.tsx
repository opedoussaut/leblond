"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { buttonClass, Button } from "@/components/ui/button";
import { ProfilePicture } from "@/components/training/profile-picture";
import { removeProfilePhoto, setProfilePhoto } from "@/lib/actions/profile-photo";
import type { Locale } from "@/lib/i18n";
import { profilePhotoDictionary } from "@/lib/i18n/profile-photo";
import { MEDIA_BUCKET } from "@/lib/media";
import { PROFILE_PHOTO_SIZE, PROFILE_PHOTO_SOURCE_MAX_BYTES, profilePhotoPath, squareCrop, type ProfilePhotoType } from "@/lib/profile-photo";
import { getBrowserClient } from "@/lib/supabase/client";

/** Crops the photo to a centred square and resizes it to 512 px (WebP, else JPEG). */
async function resize(file: File): Promise<{ blob: Blob; type: ProfilePhotoType }> {
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

/**
 * Settings: the profile picture. Without an upload the progression avatar is
 * the picture; a photo replaces it everywhere, and removing it brings the
 * avatar back. The photo goes straight from the device to the private bucket
 * (the climber's own folder), then the server checks and records it.
 */
export function ProfilePhotoEditor({ locale, userId, photoUrl, level }: {
  locale: Locale; userId: string; photoUrl: string | null; level: number;
}) {
  const t = profilePhotoDictionary(locale);
  const router = useRouter();
  const inputId = useId();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<"upload" | "remove" | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const hasPhoto = !!photoUrl;

  async function upload(file: File) {
    setMessage(null);
    if (!file.type.startsWith("image/")) return setMessage({ kind: "error", text: t.badType });
    if (file.size > PROFILE_PHOTO_SOURCE_MAX_BYTES) return setMessage({ kind: "error", text: t.tooLarge });
    setBusy("upload");
    try {
      let resized: Awaited<ReturnType<typeof resize>>;
      try {
        resized = await resize(file);
      } catch {
        return setMessage({ kind: "error", text: t.badType });
      }
      const path = profilePhotoPath(userId, crypto.randomUUID(), resized.type);
      const { error } = await getBrowserClient().storage.from(MEDIA_BUCKET)
        .upload(path, resized.blob, { contentType: resized.type, upsert: false });
      if (error) throw error;
      const res = await setProfilePhoto({ storagePath: path });
      if (!res.ok) throw new Error(res.error);
      setMessage({ kind: "ok", text: t.saved });
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: t.error });
    } finally {
      setBusy(null);
      if (input.current) input.current.value = "";
    }
  }

  async function remove() {
    setMessage(null);
    setBusy("remove");
    try {
      const res = await removeProfilePhoto();
      if (!res.ok) throw new Error(res.error);
      setMessage({ kind: "ok", text: t.removed });
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: t.error });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="profile-photo-heading" className="leblond-premium-surface mb-6 p-5">
      <h2 id="profile-photo-heading" className="text-base font-bold">{t.title}</h2>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="shrink-0 self-center p-1 sm:self-auto">
          <ProfilePicture photoUrl={photoUrl} level={level} size={88} label={hasPhoto ? t.yourPhoto : t.yourAvatar} />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-sm text-ink-2">{hasPhoto ? t.usingPhoto : t.usingAvatar}</p>
          <div className="flex flex-wrap gap-2">
            <label htmlFor={inputId} aria-disabled={busy !== null || undefined}
              className={buttonClass("secondary", "md", busy ? "pointer-events-none cursor-default opacity-60" : "cursor-pointer")}>
              {busy === "upload" ? t.uploading : hasPhoto ? t.change : t.choose}
            </label>
            <input ref={input} id={inputId} type="file" accept="image/*" className="sr-only" disabled={busy !== null}
              onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
            {hasPhoto ? <Button type="button" variant="ghost" disabled={busy !== null} onClick={remove}>
              {busy === "remove" ? t.removing : t.remove}
            </Button> : null}
          </div>
          {hasPhoto ? <p className="text-xs text-ink-3">{t.removeHint}</p> : null}
          <p className="text-xs text-ink-3">{t.private}</p>
          {message ? <p role={message.kind === "error" ? "alert" : "status"}
            className={message.kind === "error" ? "text-sm text-danger" : "text-sm font-semibold text-ink-2"}>{message.text}</p> : null}
        </div>
      </div>
    </section>
  );
}
