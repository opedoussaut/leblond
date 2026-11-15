/*
 * Exercise illustrations for the hip-mobility programme and tests and for the
 * coach-session exercises: David's drawings for LEBLOND, one image per
 * exercise in public/illustrations (lib/training/illustrations.ts). The images
 * carry no text, so they serve every language; the name comes from the page.
 */
import { ILLUSTRATION_SIZES, illustrationSrc, isIllustration, type IllustrationId } from "@/lib/training/illustrations";

const TEST_DRAWINGS: Record<string, IllustrationId> = { A: "seated-hip-rotations", B: "butterfly", C: "low-step-placements", D: "wall-step" };

export function MobilityIllustration({ exerciseId, test, title, className = "" }: {
  exerciseId?: string; test?: string; title: string; className?: string;
}) {
  const id = test ? TEST_DRAWINGS[test] : exerciseId;
  if (!isIllustration(id)) return null;
  const [width, height] = ILLUSTRATION_SIZES[id];
  return <figure className={"h-fit w-fit max-w-xs overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-black/5 " + className}>
    {/* A small public file shown as is: a plain <img> with its own size, no optimiser round trip. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={illustrationSrc(id)} alt={title} width={width} height={height} loading="lazy" decoding="async"
      className="block h-auto max-h-60 w-auto max-w-full" />
  </figure>;
}
