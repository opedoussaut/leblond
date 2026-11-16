/**
 * LEBLOND's exercise illustrations: one language-neutral image per exercise in
 * public/illustrations/<id>.webp (drawn by David for LEBLOND, labels removed so
 * the same picture serves every language; names and steps stay in the app).
 * Shown by components/training/mobility-illustrations.tsx.
 */
export const ILLUSTRATION_SIZES = {
  "supine-knee-sways": [960, 720],
  "seated-hip-rotations": [960, 720],
  "adductor-rock-backs": [960, 720],
  "low-step-placements": [960, 720],
  "lateral-weight-shifts": [960, 720],
  "butterfly": [960, 720],
  "wall-step": [708, 371],
  "knee-to-wall": [960, 720],
  "supine-hip-internal-rotation": [708, 351],
  "wall-slides": [960, 720],
  "wall-straddle": [960, 720],
  "assisted-side-lunge": [451, 341],
  "cat-cow": [255, 428],
  "childs-pose": [719, 251],
  "deep-squat-hold": [428, 343],
  "figure-four-chair": [393, 353],
  "forearm-stretch": [280, 451],
  "glute-bridge": [329, 385],
  "half-kneeling-hip-flexor": [247, 451],
  "hip-hinge-dowel": [380, 368],
  "kneeling-lat-stretch": [468, 416],
  "leg-swings": [259, 410],
  "legs-up-breathing": [619, 301],
  "low-lunge-rotation": [281, 408],
  "passive-hang-feet": [580, 335],
  "quadruped-hip-circles": [279, 404],
  "quadruped-thoracic-rotation": [280, 401],
  "romanian-deadlift": [304, 358],
  "side-lying-quad": [407, 330],
  "strap-hamstring": [312, 455],
  "towel-thoracic-opener": [403, 427],
  "wall-calf": [437, 334],
  "wall-pec": [531, 388],
  "wall-upper-back-extension": [572, 384],
  // ChatGPT pictures in the same style (Olivier, 2026-11-16), title panel removed.
  "band-face-pull": [960, 701],
  "band-lateral-walk": [960, 680],
  "cable-straight-arm-pulldown": [960, 714],
  "calf-raise-step": [960, 711],
  "clamshell": [960, 772],
  "cossack-squat": [960, 680],
  "dumbbell-curl": [960, 785],
  "hanging-knee-raise": [960, 751],
  "heel-raised-assisted-squat": [960, 829],
  "horse-stance-squat": [960, 671],
  "jefferson-curl": [960, 758],
  "long-lunge-pulse": [960, 674],
  "parallel-bar-dips": [960, 758],
  "wall-sit": [736, 909],
} as const satisfies Record<string, readonly [number, number]>;

export type IllustrationId = keyof typeof ILLUSTRATION_SIZES;
export const ILLUSTRATIONS = Object.keys(ILLUSTRATION_SIZES) as [IllustrationId, ...IllustrationId[]];

const known: ReadonlySet<string> = new Set(ILLUSTRATIONS);
export const isIllustration = (id: string | null | undefined): id is IllustrationId => !!id && known.has(id);

export const illustrationSrc = (id: IllustrationId) => `/illustrations/${id}.webp`;
