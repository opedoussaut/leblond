import type { Localized, TrainingEntry } from "@/lib/training/catalogue";
import type { AtlasDetail } from "@/lib/training/atlas-types";
import { METHOD_DETAILS } from "@/lib/training/atlas-content/methods";
import { COACHING_DETAILS } from "@/lib/training/atlas-content/coaching";
import { TOOL_DETAILS } from "@/lib/training/atlas-content/tools";

export type { AtlasDetail, AtlasDiagram, AtlasSource, ProtocolKey, ProtocolRow, SourceKind } from "@/lib/training/atlas-types";
export { METHOD_PROTOCOL_KEYS } from "@/lib/training/atlas-types";

/**
 * ATLAS DIMENSIONS ARE EDITORIAL EMPHASIS INDICES (0–5).
 * They are not performance norms, research effect sizes or user assessments.
 * They never replace Lattice's observed tests or a qualified coach.
 */
export const ATLAS_AXES = [
  "footwork","reading","fingerForce","pulling","contactPower","aerobic",
  "powerEndurance","mobility","mental","recovery","planning","measurement"
] as const;
export type AtlasAxis = typeof ATLAS_AXES[number];
export type AtlasScores = readonly [number,number,number,number,number,number,number,number,number,number,number,number];
export const ATLAS_LABELS: Record<AtlasAxis, Localized> = {
  footwork:{fr:"Pieds",en:"Footwork"},
  reading:{fr:"Lecture",en:"Reading"},
  fingerForce:{fr:"Force doigts",en:"Finger force"},
  pulling:{fr:"Traction",en:"Pulling"},
  contactPower:{fr:"Explosivité",en:"Explosiveness"},
  aerobic:{fr:"Aérobie",en:"Aerobic"},
  powerEndurance:{fr:"Résistance",en:"Power endurance"},
  mobility:{fr:"Mobilité",en:"Mobility"},
  mental:{fr:"Mental",en:"Mental"},
  recovery:{fr:"Récupération",en:"Recovery"},
  planning:{fr:"Planification",en:"Planning"},
  measurement:{fr:"Évaluation",en:"Measurement"},
};
export const ATLAS_SCORES: Readonly<Record<string,AtlasScores>> = {
  "technique":[5,5,1,1,2,2,2,3,3,2,2,4],
  "constraints":[5,5,1,2,3,2,2,4,3,2,2,3],
  "limit-bouldering":[3,4,3,4,5,1,2,2,3,3,2,3],
  "max-hangs":[0,0,5,2,1,0,1,0,0,4,3,5],
  "repeaters":[0,0,4,1,1,2,5,0,0,3,3,4],
  "easy-volume":[4,3,1,1,1,5,3,2,2,3,2,2],
  "four-by-four":[2,3,2,2,3,2,5,1,3,3,3,3],
  "campus":[1,2,4,4,5,0,1,2,2,5,3,3],
  "strength-conditioning":[1,1,3,5,3,1,2,4,1,4,4,3],
  "mental":[2,5,0,0,1,1,2,1,5,3,3,4],
  "periodized":[4,4,4,4,4,4,4,4,4,5,5,5],
  "lattice":[3,3,5,4,4,4,4,4,3,5,5,5],
  "power-company":[5,5,4,4,4,4,4,3,5,4,5,4],
  "crimpd":[3,2,5,4,4,5,5,2,2,4,5,4],
  "hoopers":[4,4,4,4,3,2,2,4,3,4,4,4],
  "hangboard":[0,0,5,2,1,1,4,0,0,3,2,5],
  "training-board":[4,4,3,4,5,2,2,3,3,3,2,3],
  "force-sensor":[0,0,5,0,0,0,1,0,0,1,3,5],
  "video-tool":[5,5,0,0,2,0,1,2,4,1,3,5],
};

/**
 * Enriched Atlas content (FR + EN, sourced, with a method-specific diagram)
 * for every catalogue entry. See lib/training/atlas-content/.
 */
export const ATLAS_DETAILS: Readonly<Record<string, AtlasDetail>> = {
  ...METHOD_DETAILS,
  ...COACHING_DETAILS,
  ...TOOL_DETAILS,
};

export function atlasDetail(entry: Pick<TrainingEntry, "id">): AtlasDetail | undefined {
  return ATLAS_DETAILS[entry.id];
}
