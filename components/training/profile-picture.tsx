"use client";

import { useState } from "react";
import { AVATAR_LEVELS } from "@/lib/analytics/avatar";
import { pictureSource } from "@/lib/profile-photo";
import { AVATAR_RING, AvatarPortrait } from "./avatar-portrait";

/**
 * The climber's profile picture everywhere "you" appear: the photo they
 * uploaded, ringed in their avatar colour, or else their progression avatar.
 * If the photo's signed URL has expired or fails, the avatar takes over.
 */
export function ProfilePicture({ photoUrl, level, size = 56, label }: {
  photoUrl: string | null | undefined; level: number; size?: number; label?: string;
}) {
  const [failed, setFailed] = useState<string | null>(null);
  const source = pictureSource(photoUrl && photoUrl !== failed ? photoUrl : null, level);
  if (source.kind === "avatar") return <AvatarPortrait level={level} size={size} label={label} />;
  const colour = AVATAR_LEVELS[Math.max(0, Math.min(AVATAR_LEVELS.length - 1, level))]!;
  const ring = Math.max(2, Math.round(size / 18));
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a private, signed, already-resized image; next/image cannot optimise it.
    <img src={source.src} width={size} height={size} alt={label ?? ""} aria-hidden={label ? undefined : true}
      decoding="async" draggable={false} data-profile-photo="" data-avatar={colour}
      onError={() => setFailed(source.src)}
      className="shrink-0 rounded-full bg-surface-2 object-cover"
      style={{ width: size, maxWidth: "100%", height: "auto", aspectRatio: "1 / 1", boxShadow: `0 0 0 ${ring}px ${AVATAR_RING[colour]}` }} />
  );
}
