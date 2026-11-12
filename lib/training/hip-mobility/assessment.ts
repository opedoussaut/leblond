import { z } from "zod";
import type { Localized } from "@/lib/training/catalogue";
import type { Level, TestId } from "./content";

/**
 * Beginner hip-mobility assessment (protocol v1): four simple, repeatable tests,
 * recorded LEFT and RIGHT. Each side gets a DESCRIBED performance level (0–4),
 * plus a measured value when one can be taken with a tape measure or by counting.
 *
 * There is no flexibility score, no angle estimated by eye and no clinical claim:
 * the levels describe what the climber did, with what support, under which
 * conditions. The training stage derived from them is LEBLOND's own label.
 */
export const MOBILITY_PROTOCOL_VERSION = 1;
/** Bump when the stage rules below change, so older labels stay explainable. */
export const STAGE_RULES_VERSION = 1;
/** Assessments are repeated every few weeks: this is years of history. */
export const MAX_MOBILITY_ASSESSMENTS = 120;

export const SIDES = ["LEFT", "RIGHT", "BOTH"] as const;
export type Side = (typeof SIDES)[number];
/** From none to heavy: NONE, LIGHT (fingertips / one hand), HANDS (both hands), HEAVY (hands + cushion or full support). */
export const SUPPORTS = ["NONE", "LIGHT", "HANDS", "HEAVY"] as const;
export type Support = (typeof SUPPORTS)[number];
/** Warning signs that call for a clinician before progressing. */
export const WARNING_FLAGS = ["CATCHING", "BLOCK", "SHARP_PAIN"] as const;
export type WarningFlag = (typeof WARNING_FLAGS)[number];
export const DISCOMFORT_AREAS = ["hip", "groin", "knee", "back", "other"] as const;
export type DiscomfortArea = (typeof DISCOMFORT_AREAS)[number];
export const TIMES_OF_DAY = ["MORNING", "MIDDAY", "EVENING"] as const;

export type ValueSpec = { unit: "count" | "cm"; min: number; max: number; higherIsBetter: boolean; label: Localized };

export type TestDefinition = {
  id: TestId;
  name: Localized;
  question: Localized;
  optional: boolean;
  setup: readonly Localized[];
  /** What each performance level means, 0 → 4. The definition IS the level. */
  levels: readonly [Localized, Localized, Localized, Localized, Localized];
  value: ValueSpec;
  /** A second, whole-body measurement recorded once (side BOTH), not used for the stage. */
  both?: ValueSpec & { name: Localized; how: Localized };
  stop: Localized;
};

const L = (fr: string, en: string): Localized => ({ fr, en });

export const MOBILITY_TESTS: readonly TestDefinition[] = [
  {
    id: "A", optional: false,
    name: L("A · Rotation de hanche (90/90 modifié, avec appui)", "A · Hip rotation (modified 90/90, supported)"),
    question: L("Peux-tu faire tourner les jambes d’une position à l’autre ?", "Can you rotate your legs from one position to the other?"),
    setup: [
      L("Assis au sol, ou sur un coussin dont tu notes la hauteur, mains derrière toi, genoux pliés, pieds plus écartés que les hanches.",
        "Sit on the floor, or on a cushion whose height you record, hands behind you, knees bent, feet wider than your hips."),
      L("Côté gauche = les genoux tournent vers la gauche (jambe gauche devant). Côté droit = vers la droite.",
        "Left side = the knees turn to the left (left leg in front). Right side = to the right."),
      L("Fais jusqu’à 6 transitions vers chaque côté, lentement. Compte celles que tu fais sous contrôle, sans tomber dans la position.",
        "Do up to 6 transitions to each side, slowly. Count the ones you control, without dropping into the position."),
    ],
    levels: [
      L("Impossible d’entrer ou de rester dans la position de ce côté, même avec les mains et un coussin.",
        "Cannot get into or stay in the position on this side, even with hands and a cushion."),
      L("Tient la position avec les mains et/ou un coussin, mais ne peut pas y entrer seul sous contrôle.",
        "Holds the position with hands and/or a cushion, but cannot move into it with control."),
      L("Entre dans la position sous contrôle avec les deux mains au sol et/ou un coussin.",
        "Moves into the position with control, both hands on the floor and/or a cushion."),
      L("Entre dans la position sous contrôle avec une seule main ou le bout des doigts.",
        "Moves into the position with control using one hand or fingertips only."),
      L("Entre dans la position sous contrôle sans les mains.", "Moves into the position with control, hands-free."),
    ],
    value: { unit: "count", min: 0, max: 6, higherIsBetter: true, label: L("Transitions contrôlées sur 6", "Controlled transitions out of 6") },
    stop: L("Arrête si le genou tourne ou fait mal, ou si ça accroche dans la hanche.", "Stop if the knee twists or hurts, or if something catches in the hip."),
  },
  {
    id: "B", optional: false,
    name: L("B · Écartement (abduction)", "B · Abduction"),
    question: L("Jusqu’où peux-tu écarter les genoux et les pieds sous contrôle ?", "How far can you separate your knees and feet with control?"),
    setup: [
      L("Allongé sur le dos, plantes de pied l’une contre l’autre, talons à une distance confortable du bassin. Laisse les genoux s’ouvrir sans forcer.",
        "Lie on your back, soles of the feet together, heels a comfortable distance from your hips. Let the knees open without forcing."),
      L("Avec un mètre ruban, mesure la distance entre l’extérieur de chaque genou (au niveau du pli) et le sol. Moins = plus d’ouverture.",
        "With a tape measure, measure the distance between the outside of each knee (at the crease) and the floor. Less = more opening."),
      L("Puis essaie de remonter et redescendre chaque genou lentement : c’est ce contrôle que décrit le niveau.",
        "Then try to lift and lower each knee slowly: that control is what the level describes."),
    ],
    levels: [
      L("Impossible de mettre les plantes de pied ensemble allongé sans gêne, même avec des coussins sous les genoux.",
        "Cannot bring the soles together lying down without discomfort, even with cushions under the knees."),
      L("Plantes de pied ensemble seulement avec des coussins sous les genoux.", "Soles together only with cushions under the knees."),
      L("Plantes de pied ensemble sans coussin, mais le genou ne se lève pas et ne se repose pas sous contrôle.",
        "Soles together without cushions, but the knee cannot be lifted and lowered with control."),
      L("Descend et remonte le genou sous contrôle sur une partie de l’amplitude.", "Lowers and lifts the knee with control through part of the range."),
      L("Descend et remonte le genou sous contrôle sur toute l’amplitude confortable.", "Lowers and lifts the knee with control through the whole comfortable range."),
    ],
    value: { unit: "cm", min: 0, max: 80, higherIsBetter: false, label: L("Distance genou–sol (cm)", "Knee-to-floor distance (cm)") },
    both: {
      unit: "cm", min: 10, max: 200, higherIsBetter: true,
      label: L("Écart des pieds (cm)", "Stance width (cm)"),
      name: L("Écart de pieds contrôlé (facultatif)", "Controlled stance width (optional)"),
      how: L("Debout, une main sur un support : écarte les pieds jusqu’à l’écart le plus large où tu peux transférer ton poids d’un pied à l’autre et revenir sans perdre l’équilibre. Mesure entre l’intérieur des talons.",
        "Standing, one hand on a support: step the feet apart to the widest stance where you can shift your weight from foot to foot and come back without losing balance. Measure between the inside of the heels."),
    },
    stop: L("Arrête si l’aine pince ou si tu sens un blocage net.", "Stop if the groin pinches or you feel a hard block."),
  },
  {
    id: "C", optional: false,
    name: L("C · Flexion de hanche active (marche basse)", "C · Active hip flexion (low step)"),
    question: L("Peux-tu poser un pied sur une marche basse sans t’aider des mains ?", "Can you place one foot on a low step without using your hands?"),
    setup: [
      L("Debout face à une marche stable dont tu mesures la hauteur, un support à portée de main pour la sécurité.",
        "Stand facing a stable step whose height you measure, with a support within reach for safety."),
      L("Lève le genou et pose tout le pied sur la marche, sans te pencher en arrière, puis redescends.",
        "Lift the knee and place the whole foot on the step without leaning back, then step down."),
      L("Note la marche la plus haute réussie sous contrôle, pour chaque jambe.", "Record the highest step you reach with control, for each leg."),
    ],
    levels: [
      L("Impossible de poser le pied sur la marche la plus basse disponible, même avec appui des mains.",
        "Cannot place the foot on the lowest step available, even with hand support."),
      L("Pose le pied sur une marche basse seulement avec appui des mains.", "Places the foot on a low step only with hand support."),
      L("Pose le pied sur une marche basse (≈ 10–20 cm) sans les mains, sous contrôle.",
        "Places the foot on a low step (≈ 10–20 cm) without hands, with control."),
      L("Pose le pied sur une marche moyenne (≈ 25–35 cm) sans les mains, sous contrôle.",
        "Places the foot on a mid step (≈ 25–35 cm) without hands, with control."),
      L("Pose le pied sur une marche haute (≈ 40 cm ou plus) sans les mains, sous contrôle.",
        "Places the foot on a high step (≈ 40 cm or more) without hands, with control."),
    ],
    value: { unit: "cm", min: 0, max: 80, higherIsBetter: true, label: L("Hauteur de marche réussie (cm)", "Highest step reached (cm)") },
    stop: L("Marche stable uniquement ; arrête si tu accroches les orteils ou si le genou fait mal.",
      "Stable step only; stop if you catch your toes or the knee hurts."),
  },
  {
    id: "D", optional: true,
    name: L("D · Fonctionnel au mur (facultatif)", "D · Functional on the wall (optional)"),
    question: L("Sur un mur très facile ou un pan peu déversant, peux-tu tenir deux prises de pied et déplacer un pied en gardant l’équilibre ?",
      "On a very easy wall or a gently overhanging board, can you hold two footholds and move one foot while keeping your balance?"),
    setup: [
      L("Mains sur de grosses prises, pieds sur deux prises de pied écartées. Note l’inclinaison du mur et l’écart entre les prises de pied.",
        "Hands on big holds, feet on two separated footholds. Record the wall angle and the spacing between the footholds."),
      L("Côté gauche = le pied gauche bouge vers une autre prise et revient ; le pied droit reste en pression.",
        "Left side = the left foot moves to another foothold and back; the right foot keeps pressure."),
      L("Fais 5 essais par côté. Compte les transferts propres : sans glisser, sans décoller l’autre pied.",
        "Do 5 tries per side. Count the clean transfers: no slipping, the other foot never cuts."),
    ],
    levels: [
      L("Impossible de garder les deux pieds sur les deux prises.", "Cannot keep both feet on the two footholds."),
      L("Garde les deux pieds, mais bouger un pied fait glisser ou décoller l’autre.", "Keeps both feet on, but moving one foot makes the other slip or cut."),
      L("Déplace le pied vers une prise proche pendant que l’autre reste, avec effort.", "Moves the foot to a close foothold while the other stays, with effort."),
      L("Déplace le pied à l’écart noté, sous contrôle, les deux pieds en pression.", "Moves the foot at the recorded spacing, with control, both feet keeping pressure."),
      L("Déplace le pied vers une prise large ou haute sous contrôle et tourne la hanche vers le mur.",
        "Moves the foot to a wide or high foothold with control and turns the hip into the wall."),
    ],
    value: { unit: "count", min: 0, max: 5, higherIsBetter: true, label: L("Transferts propres sur 5", "Clean transfers out of 5") },
    stop: L("Terrain très facile, tapis épais ou pieds proches du sol ; ne force jamais une combinaison de prises difficile.",
      "Very easy terrain, a thick mat or feet close to the ground; never force a hard foothold combination."),
  },
];

export const TEST_BY_ID: ReadonlyMap<TestId, TestDefinition> = new Map(MOBILITY_TESTS.map((t) => [t.id, t]));
/** Tests every assessment covers, both sides (D is optional). */
export const CORE_TESTS: readonly TestId[] = ["A", "B", "C"];

export const mobilityResultSchema = z.object({
  test: z.enum(["A", "B", "C", "D"]),
  side: z.enum(SIDES),
  /** false: not done this time (see skipReason). */
  done: z.boolean(),
  /** PAIN counts as the lowest level; NOT_POSSIBLE (no step, no wall) is just missing. */
  skipReason: z.enum(["PAIN", "NOT_POSSIBLE"]).nullable().default(null),
  level: z.number().int().min(0).max(4).nullable(),
  value: z.number().min(0).max(200).nullable(),
  support: z.enum(SUPPORTS),
  discomfort: z.number().int().min(0).max(10),
  discomfortArea: z.enum(DISCOMFORT_AREAS).nullable().default(null),
  /** The climber moved by their own muscles (not pushed, pulled or dropped into it). */
  active: z.boolean(),
  flags: z.array(z.enum(WARNING_FLAGS)).max(3).default([]),
}).strict();
export type MobilityResult = z.infer<typeof mobilityResultSchema>;

export const mobilityConditionsSchema = z.object({
  warmedUp: z.boolean(),
  timeOfDay: z.enum(TIMES_OF_DAY),
  /** Cushion under the hips for test A, in cm (0 = none). */
  cushionCm: z.number().int().min(0).max(40),
  /** Test D only. angle: degrees past vertical (0 = vertical, negative = slab). */
  wall: z.object({
    kind: z.enum(["WALL", "BOARD"]),
    angleDeg: z.number().int().min(-20).max(60),
    spacingCm: z.number().int().min(10).max(200),
  }).strict().nullable(),
  notes: z.string().trim().max(300),
}).strict();
export type MobilityConditions = z.infer<typeof mobilityConditionsSchema>;

function inRange(spec: ValueSpec, v: number) { return v >= spec.min && v <= spec.max; }

export const mobilityAssessmentInputSchema = z.object({
  assessedOn: z.iso.date().refine((v) => v >= "2020-01-01" && v <= "2100-12-31"),
  conditions: mobilityConditionsSchema,
  results: z.array(mobilityResultSchema).min(1).max(16),
  notes: z.string().trim().max(1000),
}).strict().superRefine((input, ctx) => {
  const seen = new Set<string>();
  for (const [i, r] of input.results.entries()) {
    const key = r.test + ":" + r.side;
    if (seen.has(key)) ctx.addIssue({ code: "custom", message: "Duplicate result " + key, path: ["results", i] });
    seen.add(key);
    const def = TEST_BY_ID.get(r.test)!;
    if (r.side === "BOTH") {
      if (!def.both) ctx.addIssue({ code: "custom", message: "No whole-body measure for " + r.test, path: ["results", i] });
      else if (r.done && (r.value === null || !inRange(def.both, r.value))) ctx.addIssue({ code: "custom", message: "Bad value", path: ["results", i, "value"] });
      continue;
    }
    if (r.done) {
      if (r.level === null) ctx.addIssue({ code: "custom", message: "A done test needs a level", path: ["results", i, "level"] });
      if (r.value !== null && !inRange(def.value, r.value)) ctx.addIssue({ code: "custom", message: "Value out of range", path: ["results", i, "value"] });
    } else if (r.skipReason === null) {
      ctx.addIssue({ code: "custom", message: "A test not done needs a reason", path: ["results", i, "skipReason"] });
    }
  }
  for (const test of CORE_TESTS) for (const side of ["LEFT", "RIGHT"] as const) {
    if (!seen.has(test + ":" + side)) ctx.addIssue({ code: "custom", message: `Missing ${test} ${side}`, path: ["results"] });
  }
  const d = input.results.filter((r) => r.test === "D" && r.done);
  if (d.length > 0 && !input.conditions.wall) ctx.addIssue({ code: "custom", message: "Test D needs the wall conditions", path: ["conditions", "wall"] });
});
export type MobilityAssessmentInput = z.infer<typeof mobilityAssessmentInputSchema>;
export type SavedMobilityAssessment = MobilityAssessmentInput & { id: string; stage: Level; rulesVersion: number; protocolVersion: number; createdAt: string };

/**
 * The level a test reached on its weaker side: a side skipped because of pain
 * counts as 0, a side not possible (no step, no wall) is missing. Null = not tested.
 */
export function testLevel(results: readonly MobilityResult[], test: TestId): number | null {
  const sides = results.filter((r) => r.test === test && r.side !== "BOTH");
  const levels = sides.flatMap((r) => r.done && r.level !== null ? [r.level] : !r.done && r.skipReason === "PAIN" ? [0] : []);
  return levels.length ? Math.min(...levels) : null;
}

export type StageResult = {
  stage: Level;
  /** Core tests (A–C) that were not done, so the stage rests on fewer tests. */
  missing: TestId[];
  /** The test(s) that set the stage: the weakest link. */
  limitedBy: TestId[];
  functionalTested: boolean;
};

/**
 * Internal training stage (rules v1), weakest link first:
 *  - core tests A–C at level 0–1 → stage 0 (heavy support);
 *  - weakest core test at level 2 → stage 1 (supported movement);
 *  - weakest core test at 3 or 4 → stage 2 (controlled, modest range);
 *  - stage 3 also needs test D at 3+ (functional on the wall), stage 4 needs every test at 4.
 * Without test D the stage stays at 2 at most: functional ability was not tested.
 */
export function classifyStage(results: readonly MobilityResult[]): StageResult {
  const core = CORE_TESTS.map((t) => ({ t, level: testLevel(results, t) }));
  const tested = core.filter((c): c is { t: TestId; level: number } => c.level !== null);
  const missing = core.filter((c) => c.level === null).map((c) => c.t);
  const d = testLevel(results, "D");
  if (tested.length === 0) return { stage: 0, missing, limitedBy: [], functionalTested: d !== null };
  const base = Math.min(...tested.map((c) => c.level));
  let stage: Level = base <= 1 ? 0 : base === 2 ? 1 : 2;
  let limitedBy = tested.filter((c) => c.level === base).map((c) => c.t);
  if (base >= 3 && d !== null) {
    if (d >= 3) { stage = 3; limitedBy = d < base ? ["D"] : limitedBy; }
    else limitedBy = ["D"];
    if (base === 4 && d === 4) stage = 4;
  }
  return { stage, missing, limitedBy, functionalTested: d !== null };
}

/** Editorial thresholds for a left/right gap worth a clinician's look (not a diagnosis). */
export const ASYMMETRY_RULES = { levelGap: 2, value: { A: 3, B: 10, C: 15, D: 3 } as Record<TestId, number> };

/** Tests where left and right differ enough to mention, with the gap. */
export function asymmetries(results: readonly MobilityResult[]): { test: TestId; levelGap: number; valueGap: number | null }[] {
  const out: { test: TestId; levelGap: number; valueGap: number | null }[] = [];
  for (const def of MOBILITY_TESTS) {
    const left = results.find((r) => r.test === def.id && r.side === "LEFT" && r.done);
    const right = results.find((r) => r.test === def.id && r.side === "RIGHT" && r.done);
    if (!left || !right || left.level === null || right.level === null) continue;
    const levelGap = Math.abs(left.level - right.level);
    const valueGap = left.value !== null && right.value !== null ? Math.abs(left.value - right.value) : null;
    if (levelGap >= ASYMMETRY_RULES.levelGap || (valueGap !== null && valueGap >= ASYMMETRY_RULES.value[def.id])) {
      out.push({ test: def.id, levelGap, valueGap });
    }
  }
  return out;
}

/** Results of a stored row, re-validated; rows that no longer parse are dropped. */
export function parseStoredResults(value: unknown): MobilityResult[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((r) => {
    const parsed = mobilityResultSchema.safeParse(r);
    return parsed.success ? [parsed.data] : [];
  });
}

export function parseStoredConditions(value: unknown): MobilityConditions | null {
  const parsed = mobilityConditionsSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
