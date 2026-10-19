import { z } from "zod";
import { TRAINING_AXES, METHODS_FOR_PLANS, type TrainingAxis, type TrainingEntry } from "./catalogue";

/**
 * These are self-reported, anchored 1–5 SKILL ratings, not grade-equivalents.
 * They must never be described as measured finger force, climbing grades,
 * medically established abilities, or validated longitudinal forecasts.
 */
export type SkillRatings = Record<TrainingAxis, number>;
export const skillRatingsSchema = z.object({
  technique: z.number().min(1).max(5).multipleOf(0.5),
  fingers: z.number().min(1).max(5).multipleOf(0.5),
  power: z.number().min(1).max(5).multipleOf(0.5),
  endurance: z.number().min(1).max(5).multipleOf(0.5),
  mental: z.number().min(1).max(5).multipleOf(0.5),
  structure: z.number().min(1).max(5).multipleOf(0.5),
}).strict();

export const DEFAULT_SKILLS: SkillRatings = {
  technique: 3, fingers: 3, power: 3, endurance: 3, mental: 3, structure: 3,
};

export const SKILL_PROMPTS: Record<TrainingAxis, { en: string; fr: string }> = {
  technique: { en: "How consistently do you find efficient feet, balance and movement solutions on unfamiliar climbs?",
    fr: "Dans quelle mesure trouves-tu des placements de pieds, équilibres et mouvements efficaces sur des blocs inconnus ?" },
  fingers: { en: "Relative to the climbs you attempt, how reliably can you hold small or demanding grips without pain?",
    fr: "Par rapport aux blocs que tu essaies, dans quelle mesure tiens-tu les petites prises exigeantes sans douleur ?" },
  power: { en: "How reliably can you execute coordinated, dynamic or near-limit moves?",
    fr: "Avec quelle aisance réalises-tu les mouvements dynamiques, coordonnés ou proches de ta limite ?" },
  endurance: { en: "How well can you maintain movement quality and grip capacity through sustained climbing?",
    fr: "Dans quelle mesure gardes-tu une bonne gestuelle et de la force pendant une escalade prolongée ?" },
  mental: { en: "How well do you manage route-reading, pacing, commitment and fear within safe conditions?",
    fr: "Dans quelle mesure gères-tu lecture, rythme, engagement et appréhension en conditions sécurisées ?" },
  structure: { en: "How consistently do you follow a realistic plan, recover and adjust based on feedback?",
    fr: "Dans quelle mesure suis-tu un plan réaliste, récupères-tu et ajustes-tu l'entraînement selon les retours ?" },
};

export const RATING_ANCHORS = {
  en: ["1 · Rarely", "2 · Inconsistently", "3 · Sometimes", "4 · Usually", "5 · Reliably"],
  fr: ["1 · Rarement", "2 · Irrégulièrement", "3 · Parfois", "4 · Souvent", "5 · Avec régularité"],
} as const;

const methodIds = new Set(METHODS_FOR_PLANS.map((m) => m.id));
export const assessmentInputSchema = z.object({
  methodId: z.string().refine((s) => methodIds.has(s), "Unknown method"),
  ratings: skillRatingsSchema,
  horizonWeeks: z.number().int().min(4).max(24),
  sessionsPerWeek: z.number().int().min(1).max(5),
  goal: z.string().trim().max(300),
}).strict();
export type AssessmentInput = z.infer<typeof assessmentInputSchema>;
export type SavedAssessment = AssessmentInput & { id: string; createdAt: string };
export const checkinInputSchema = z.object({
  assessmentId: z.guid(),
  week: z.number().int().min(1).max(24),
  ratings: skillRatingsSchema,
  notes: z.string().trim().max(800),
}).strict();
export type SavedCheckin = z.infer<typeof checkinInputSchema> & { id: string; createdAt: string };

/**
 * Simple, explicit ILLUSTRATIVE linear scenario. Not a prediction.
 * Max-emphasis axis gains up to 0.8 rating points over 12 weeks, with
 * diminishing additional effect of planned sessions, capped by score 5.
 *
 * Chosen parameters are editorial coaching assumptions, NOT measured
 * rates or validated effect sizes. A trajectory never asserts that a
 * specific Font grade is achievable within a chosen number of weeks.
 */
export function expectedRatingsAtWeek(
  baseline: SkillRatings,
  method: Pick<TrainingEntry, "scores">,
  week: number,
  horizonWeeks: number,
  sessionsPerWeek: number,
): SkillRatings {
  const ratio = Math.min(1, Math.max(0, week) / Math.max(1, horizonWeeks));
  const durationFactor = Math.min(1.5, horizonWeeks / 12);
  const frequencyFactor = Math.min(1.2, 0.8 + 0.1 * Math.min(4, Math.max(1, sessionsPerWeek)));
  return Object.fromEntries(TRAINING_AXES.map((axis, index) => {
    const focus = method.scores[index] / 5;
    const gain = ratio * 0.8 * focus * durationFactor * frequencyFactor;
    return [axis, Math.round(Math.min(5, baseline[axis] + gain) * 100) / 100];
  })) as SkillRatings;
}

/** Rank training methods by how strongly they address the climber's reported gaps.
 * This is a fit heuristic, not an efficacy ranking.
 */
export function methodMatches(ratings: SkillRatings, limit = 3) {
  return METHODS_FOR_PLANS.map((method) => {
    const fit = TRAINING_AXES.reduce((acc, axis, index) => acc + (5 - ratings[axis]) * (method.scores[index] / 5), 0);
    const priority = [...TRAINING_AXES].sort((a, b) =>
      (5 - ratings[b]) * (method.scores[TRAINING_AXES.indexOf(b)] / 5) -
      (5 - ratings[a]) * (method.scores[TRAINING_AXES.indexOf(a)] / 5))[0];
    return { method, fit, priority };
  }).sort((a, b) => b.fit - a.fit || a.method.title.localeCompare(b.method.title)).slice(0, limit);
}

export function elapsedWeeks(since: string, now: Date): number {
  return Math.max(0, Math.floor((now.getTime() - new Date(since).getTime()) / (7 * 86_400_000)));
}
