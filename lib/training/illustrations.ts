/**
 * LEBLOND's own exercise drawings (components/training/mobility-illustrations.tsx).
 * The first ones illustrate the hip-mobility programme; the others are for
 * coach-session exercises that no approved demo site shows.
 */
export const ILLUSTRATIONS = [
  "supine-knee-sways", "seated-hip-rotations", "adductor-rock-backs", "low-step-placements",
  "lateral-weight-shifts", "butterfly", "wall-step",
  "knee-to-wall", "supine-hip-internal-rotation", "wall-slides", "wall-straddle",
] as const;
export type IllustrationId = (typeof ILLUSTRATIONS)[number];

const known: ReadonlySet<string> = new Set(ILLUSTRATIONS);
export const isIllustration = (id: string | null | undefined): id is IllustrationId => !!id && known.has(id);
