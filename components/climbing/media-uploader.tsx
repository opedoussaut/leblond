"use client";

import { useRouter } from "next/navigation";
import { useId, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { registerMedia } from "@/lib/actions/media";
import type { MediaType } from "@/lib/climbing/types";
import { fmt } from "@/lib/i18n";
import { MAX_IMAGE_BYTES, MAX_VIDEO_BYTES, MEDIA_BUCKET, mediaKind, mediaPath } from "@/lib/media";
import { getBrowserClient } from "@/lib/supabase/client";

async function readVideoMeta(file: File): Promise<{ duration: number | null; width: number | null; height: number | null }> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.onloadedmetadata = () => {
      resolve({
        duration: Number.isFinite(v.duration) ? Math.round(v.duration * 100) / 100 : null,
        width: v.videoWidth || null,
        height: v.videoHeight || null,
      });
      URL.revokeObjectURL(url);
    };
    v.onerror = () => {
      resolve({ duration: null, width: null, height: null });
      URL.revokeObjectURL(url);
    };
    v.src = url;
  });
}

/**
 * Uploads photos/videos straight from the device to the private Storage
 * bucket (RLS: the user's own folder only), then registers the media row.
 * Videos never transit through the app server.
 */
export function MediaUploader({
  userId,
  problemId,
  sessionId,
  attemptId = null,
  compact = false,
  onUploaded,
}: {
  userId: string;
  problemId: string;
  sessionId: string | null;
  attemptId?: string | null;
  compact?: boolean;
  onUploaded?: () => void;
}) {
  const { t } = useI18n();
  const router = useRouter();
  const photoId = useId();
  const videoId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoKind, setVideoKind] = useState<MediaType>("ATTEMPT_VIDEO");
  const photoRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLInputElement>(null);

  async function upload(file: File, mediaType: MediaType) {
    setError(null);
    const kind = mediaKind(file.type);
    if (!kind || (kind === "image") !== (mediaType === "PROBLEM_PHOTO")) return setError(t.problem.badType);
    const max = kind === "image" ? MAX_IMAGE_BYTES : MAX_VIDEO_BYTES;
    if (file.size > max) return setError(fmt(t.problem.tooLarge, { max: Math.round(max / 1024 / 1024) }));

    setBusy(true);
    try {
      const path = mediaPath(userId, problemId, crypto.randomUUID(), file.type);
      const meta = kind === "video" ? await readVideoMeta(file) : { duration: null, width: null, height: null };
      const { error: upErr } = await getBrowserClient()
        .storage.from(MEDIA_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw upErr;
      const res = await registerMedia({
        storagePath: path,
        problemId,
        sessionId,
        attemptId,
        mediaType,
        mimeType: file.type,
        sizeBytes: file.size,
        durationSeconds: meta.duration,
        width: meta.width,
        height: meta.height,
      });
      if (!res.ok) throw new Error(res.error);
      onUploaded?.();
      router.refresh();
    } catch {
      setError(t.problem.uploadError);
    } finally {
      setBusy(false);
      if (photoRef.current) photoRef.current.value = "";
      if (videoRef.current) videoRef.current.value = "";
    }
  }

  return (
    <div className={cn(compact ? "flex flex-wrap items-center gap-2" : "space-y-3")}>
      <label htmlFor={photoId} className={buttonClass("secondary", "md", "cursor-pointer")}>
        📷 {busy ? t.problem.uploading : t.problem.addPhoto}
      </label>
      <input
        ref={photoRef}
        id={photoId}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={busy}
        onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], "PROBLEM_PHOTO")}
      />
      {!compact ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="sr-only" htmlFor={`${videoId}-kind`}>
            {t.problem.videoKind}
          </label>
          <select
            id={`${videoId}-kind`}
            value={videoKind}
            onChange={(e) => setVideoKind(e.target.value as MediaType)}
            className="min-h-12 rounded-xl border border-line bg-surface px-3"
          >
            <option value="ATTEMPT_VIDEO">{t.problem.attemptVideo}</option>
            <option value="SEND_VIDEO">{t.problem.sendVideo}</option>
          </select>
          <label htmlFor={videoId} className={buttonClass("secondary", "md", "cursor-pointer")}>
            🎥 {busy ? t.problem.uploading : t.problem.addVideo}
          </label>
          <input
            ref={videoRef}
            id={videoId}
            type="file"
            accept="video/mp4,video/quicktime,video/webm"
            capture="environment"
            className="sr-only"
            disabled={busy}
            onChange={(e) => e.target.files?.[0] && upload(e.target.files[0], videoKind)}
          />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
