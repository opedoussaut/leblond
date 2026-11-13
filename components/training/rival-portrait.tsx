import type { RivalPortrait as Portrait } from "@/lib/analytics/rival";

/*
 * The rival's portraits: six illustrated characters supplied by the owner as
 * free images, cropped around the face and stored as 256 px WebP files in
 * public/brand/rival. Fictional characters, not real people.
 */
export function RivalPortrait({ portrait, size = 56, label }: { portrait: Portrait; size?: number; label?: string }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- a tiny static image; next/image adds nothing here.
    <img src={`/brand/rival/${portrait}.webp`} width={size} height={size} alt={label ?? ""} aria-hidden={label ? undefined : true}
      loading="lazy" decoding="async" draggable={false}
      className="shrink-0 rounded-full bg-[#C9D3E3] object-cover" />
  );
}
