import type { RivalPortrait as Portrait } from "@/lib/analytics/rival";

/*
 * The rival's portraits: six illustrated characters supplied by the owner as
 * free images, cropped around the face and stored as 256 px WebP files in
 * public/brand/rival. Fictional characters, not real people.
 *
 * When the climber gave the rival their own picture, `photoUrl` (a signed URL
 * to their private "<me>/rival/" photo) is shown instead, in the same circle.
 */
export function RivalPortrait({ portrait, size = 56, label, photoUrl = null }: {
  portrait: Portrait; size?: number; label?: string; photoUrl?: string | null;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a tiny image (static or signed URL); next/image adds nothing here.
    <img src={photoUrl ?? `/brand/rival/${portrait}.webp`} width={size} height={size} alt={label ?? ""} aria-hidden={label ? undefined : true}
      data-rival-photo={photoUrl ? "" : undefined}
      loading="lazy" decoding="async" draggable={false}
      className="shrink-0 rounded-full bg-[#C9D3E3] object-cover" />
  );
}
