"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { Button, buttonClass } from "@/components/ui/button";
import { removeRivalPhoto, setRivalPhoto } from "@/lib/actions/alter-ego";
import type { RivalPortrait as PortraitId } from "@/lib/analytics/rival";
import type { Locale } from "@/lib/i18n";
import { rivalDictionary } from "@/lib/i18n/rival";
import { MEDIA_BUCKET } from "@/lib/media";
import { resizeSquarePhoto } from "@/lib/photo-resize";
import { PROFILE_PHOTO_SOURCE_MAX_BYTES, RIVAL_PHOTO_FOLDER, photoObjectPath } from "@/lib/profile-photo";
import { getBrowserClient } from "@/lib/supabase/client";
import { RivalPortrait } from "./rival-portrait";

/**
 * Rival settings: the climber's own picture for the rival. Without one, the
 * drawn portrait shows; a picture replaces it everywhere, and removing it brings
 * the portrait back. Like the profile photo, it goes straight from the device
 * to the climber's own private folder ("<me>/rival/"), then the server checks
 * and records it.
 */
export function RivalPhotoEditor({ locale, pactId, userId, photoUrl, portrait, name }: {
  locale: Locale; pactId: string; userId: string; photoUrl: string | null; portrait: PortraitId; name: string;
}) {
  const t = rivalDictionary(locale).photo;
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
      let resized: Awaited<ReturnType<typeof resizeSquarePhoto>>;
      try {
        resized = await resizeSquarePhoto(file);
      } catch {
        return setMessage({ kind: "error", text: t.badType });
      }
      const path = photoObjectPath(userId, RIVAL_PHOTO_FOLDER, crypto.randomUUID(), resized.type);
      const { error } = await getBrowserClient().storage.from(MEDIA_BUCKET)
        .upload(path, resized.blob, { contentType: resized.type, upsert: false });
      if (error) throw error;
      const res = await setRivalPhoto({ id: pactId, storagePath: path });
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
      const res = await removeRivalPhoto({ id: pactId });
      if (!res.ok) throw new Error("remove");
      setMessage({ kind: "ok", text: t.removed });
      router.refresh();
    } catch {
      setMessage({ kind: "error", text: t.error });
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-labelledby="rival-photo-heading" className="leblond-premium-surface p-5 sm:p-6">
      <h2 id="rival-photo-heading" className="text-base font-bold">{t.title}</h2>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="shrink-0 self-center p-1 sm:self-auto">
          <RivalPortrait portrait={portrait} photoUrl={photoUrl} size={88} label={hasPhoto ? t.current : name} />
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-sm text-ink-2">{hasPhoto ? t.usingPhoto : t.usingPortrait}</p>
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
          <p className="text-xs text-ink-3">{t.private}</p>
          {message ? <p role={message.kind === "error" ? "alert" : "status"}
            className={message.kind === "error" ? "text-sm text-danger" : "text-sm font-semibold text-ink-2"}>{message.text}</p> : null}
        </div>
      </div>
    </section>
  );
}
