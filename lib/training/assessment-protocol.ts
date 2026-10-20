import { z } from "zod";
import type { Localized, TrainingAxis } from "./catalogue";

/**
 * LEBLOND structured assessment protocol (version 2).
 *
 * This is a HOUSE PROTOCOL: a small set of safe, repeatable field tests in the
 * spirit of the capacity testing used by climbing coaches (finger strength,
 * pulling, endurance, movement quality). It is NOT a scientifically validated
 * battery, no result is turned into a grade, and no test is maximal: holds are
 * bodyweight and capped, and every test can be skipped.
 *
 * Every value carries an evidence level so measured, observed, self-reported
 * and estimated information are never merged into one authoritative score.
 */
export const PROTOCOL_VERSION = 2;

export const EVIDENCE_LEVELS = ["measured", "observed", "self", "estimated", "insufficient"] as const;
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number];

export const EVIDENCE_LABELS: Record<EvidenceLevel, Localized & { hint: Localized }> = {
  measured: { fr: "Mesuré", en: "Measured", hint: { fr: "Obtenu par une procédure de test définie.", en: "Obtained with a defined test procedure." } },
  observed: { fr: "Observé", en: "Observed", hint: { fr: "Calculé à partir des séances enregistrées.", en: "Calculated from recorded climbing sessions." } },
  self: { fr: "Déclaratif", en: "Self-reported", hint: { fr: "Déclaré par le grimpeur.", en: "Declared by the climber." } },
  estimated: { fr: "Estimé", en: "Estimated", hint: { fr: "Dérivé d’une approximation explicite.", en: "Derived from an explicit approximation." } },
  insufficient: { fr: "Données insuffisantes", en: "Insufficient data", hint: { fr: "Preuve absente ou peu fiable.", en: "Evidence unavailable or unreliable." } },
};

export type TestDefinition = {
  id: "hang-20mm" | "pull-ups" | "continuous-climb" | "quiet-feet";
  name: Localized;
  dimension: TrainingAxis;
  unit: "s" | "reps" | "min" | "errors";
  higherIsBetter: boolean;
  min: number; max: number;
  minExperienceMonths: number;
  fingerLoading: boolean;
  equipment: Localized;
  procedure: readonly Localized[];
  stopRules: Localized;
  rationale: Localized;
  reference?: { label: string; url: string };
};

const loc = (fr: string, en: string): Localized => ({ fr, en });

export const PROTOCOL_TESTS: readonly TestDefinition[] = [
  {
    id: "hang-20mm", name: loc("Suspension 20 mm au poids du corps", "Bodyweight 20 mm hang"),
    dimension: "fingers", unit: "s", higherIsBetter: true, min: 0, max: 60, minExperienceMonths: 12, fingerLoading: true,
    equipment: loc("Poutre avec réglette de 20 mm, chronomètre.", "Hangboard with a 20 mm edge, timer."),
    procedure: [
      loc("Après l’échauffement des doigts, suspends-toi à deux mains en semi-arqué, bras tendus, au poids du corps.", "After a finger warm-up, hang with both hands half-crimp, straight arms, bodyweight only."),
      loc("Chronomètre jusqu’à la perte de la prise ou de la position, plafonné à 60 s.", "Time until grip or position is lost, capped at 60 s."),
      loc("Un seul essai. Note la même réglette et la même prise à chaque bilan.", "One attempt. Use the same edge and grip at every assessment."),
    ],
    stopRules: loc("Pas de test si douleur aux doigts, moins de 12 mois de grimpe, ou blessure récente.", "Skip if you have finger pain, less than 12 months of climbing, or a recent injury."),
    rationale: loc("Indicateur reproductible de la force-endurance des doigts, sans charge additionnelle.", "A repeatable indicator of finger strength-endurance without added load."),
    reference: { label: "Lattice — testing areas (finger strength, endurance, strength, flexibility)", url: "https://www.latticetraining.com/docs/latticeplan-testing" },
  },
  {
    id: "pull-ups", name: loc("Tractions strictes", "Strict pull-ups"),
    dimension: "power", unit: "reps", higherIsBetter: true, min: 0, max: 60, minExperienceMonths: 0, fingerLoading: false,
    equipment: loc("Barre ou grosses prises de poutre.", "Bar or large hangboard jugs."),
    procedure: [
      loc("Prise en pronation, largeur d’épaules, bras tendus en bas.", "Overhand grip, shoulder width, straight arms at the bottom."),
      loc("Menton au-dessus de la barre à chaque répétition, sans élan.", "Chin over the bar each rep, no kipping."),
      loc("Compte les répétitions propres jusqu’à l’échec technique.", "Count clean reps until technical failure."),
    ],
    stopRules: loc("Arrête si douleur aux épaules ou aux coudes.", "Stop if shoulders or elbows hurt."),
    rationale: loc("Mesure simple de la force de traction générale.", "A simple measure of general pulling strength."),
    reference: { label: "Power Company — metrics and their limitations", url: "https://www.powercompanyclimbing.com/blog/metrics-for-climbers" },
  },
  {
    id: "continuous-climb", name: loc("Grimpe continue sur terrain facile", "Continuous easy climbing"),
    dimension: "endurance", unit: "min", higherIsBetter: true, min: 0, max: 20, minExperienceMonths: 0, fingerLoading: false,
    equipment: loc("Traversée ou pan facile, chronomètre.", "Easy traverse or wall, timer."),
    procedure: [
      loc("Choisis un terrain 3 à 4 niveaux sous ton niveau de travail.", "Pick terrain 3–4 grades below your working level."),
      loc("Grimpe sans t’arrêter ni toucher le sol, à rythme régulier.", "Climb without stopping or touching the floor, at a steady pace."),
      loc("Arrête à 20 min ou quand tu ne peux plus continuer proprement.", "Stop at 20 min or when you can no longer climb cleanly."),
    ],
    stopRules: loc("Pas d’objectif de pompage maximal ; descends si la technique se dégrade.", "Not a max-pump test; step off when technique breaks down."),
    rationale: loc("Indicateur de l’endurance aérobie spécifique et de l’économie gestuelle.", "An indicator of specific aerobic endurance and movement economy."),
  },
  {
    id: "quiet-feet", name: loc("Erreurs de pieds sur 5 blocs faciles", "Foot errors over 5 easy problems"),
    dimension: "technique", unit: "errors", higherIsBetter: false, min: 0, max: 100, minExperienceMonths: 0, fingerLoading: false,
    equipment: loc("5 blocs faciles identiques d’un bilan à l’autre si possible ; un partenaire ou une vidéo.", "5 easy problems, the same ones at each assessment if possible; a partner or video."),
    procedure: [
      loc("Grimpe chaque bloc une fois, en regardant chaque pied jusqu’au contact.", "Climb each problem once, watching each foot onto the hold."),
      loc("Compte une erreur à chaque pied bruyant, repositionné ou qui glisse.", "Count an error for each noisy, readjusted or slipping foot."),
      loc("Additionne les erreurs des 5 blocs.", "Add up the errors over the 5 problems."),
    ],
    stopRules: loc("Aucune contrainte particulière.", "No particular restrictions."),
    rationale: loc("Observation structurée de la précision des pieds ; dépend des blocs choisis.", "A structured observation of foot precision; depends on the problems chosen."),
  },
];

export type Measurement = {
  id: TestDefinition["id"];
  value: number;
  unit: TestDefinition["unit"];
  evidence: "measured";
  protocolVersion: number;
  date: string;
  conditions: string;
  quality: "complete" | "partial";
};

export const measurementSchema = z.object({
  id: z.enum(["hang-20mm", "pull-ups", "continuous-climb", "quiet-feet"]),
  value: z.number().min(0).max(100),
  unit: z.enum(["s", "reps", "min", "errors"]),
  evidence: z.literal("measured"),
  protocolVersion: z.number().int().min(1).max(100),
  date: z.iso.date(),
  conditions: z.string().trim().max(300),
  quality: z.enum(["complete", "partial"]),
}).strict().refine((m) => {
  const def = PROTOCOL_TESTS.find((t) => t.id === m.id);
  return !!def && def.unit === m.unit && m.value >= def.min && m.value <= def.max;
}, "Value outside the test range");

export const assessmentContextSchema = z.object({
  discipline: z.enum(["BOULDER", "ROUTE", "BOTH"]),
  experienceMonths: z.number().int().min(0).max(900),
  sessionsPerWeekNow: z.number().int().min(0).max(14),
  currentPain: z.boolean(),
  rested24h: z.boolean(),
  warmedUp: z.boolean(),
  venue: z.string().trim().max(120),
  notes: z.string().trim().max(500),
  observed: z.array(z.object({
    id: z.string().max(40), value: z.string().max(40), sample: z.number().int().min(0).max(100000),
    evidence: z.enum(["observed", "insufficient"]),
  }).strict()).max(10),
}).strict();
export type AssessmentContext = z.infer<typeof assessmentContextSchema>;

/** A test is offered only when the screening says it is appropriate. */
export function testAllowed(test: TestDefinition, ctx: Pick<AssessmentContext, "experienceMonths" | "currentPain" | "warmedUp">): boolean {
  if (ctx.currentPain && (test.fingerLoading || test.id === "pull-ups")) return false;
  if (test.fingerLoading && !ctx.warmedUp) return false;
  return ctx.experienceMonths >= test.minExperienceMonths;
}

export function measurementQuality(conditions: string, ctx: Pick<AssessmentContext, "warmedUp" | "rested24h">): "complete" | "partial" {
  return conditions.trim().length >= 3 && ctx.warmedUp && ctx.rested24h ? "complete" : "partial";
}

export type ObservedEvidence = AssessmentContext["observed"][number];

/**
 * Evidence taken from the climbing journal at assessment time. Sample sizes
 * below the thresholds are reported as "insufficient" rather than as numbers.
 */
export function observedEvidence(input: {
  sessions28d: number; problems28d: number; sends28d: number; flashes28d: number;
  workingGrade: string | null; workingSample: number;
}): ObservedEvidence[] {
  const enough = input.problems28d >= 8;
  const pct = (n: number) => input.problems28d ? Math.round((n / input.problems28d) * 100) + " %" : "—";
  return [
    { id: "sessionsPerWeek", value: (input.sessions28d / 4).toFixed(1), sample: input.sessions28d, evidence: input.sessions28d >= 2 ? "observed" : "insufficient" },
    { id: "sendRate", value: enough ? pct(input.sends28d) : "—", sample: input.problems28d, evidence: enough ? "observed" : "insufficient" },
    { id: "flashRate", value: enough ? pct(input.flashes28d) : "—", sample: input.problems28d, evidence: enough ? "observed" : "insufficient" },
    { id: "workingGrade", value: input.workingGrade ?? "—", sample: input.workingSample, evidence: input.workingGrade && input.workingSample >= 8 ? "observed" : "insufficient" },
  ];
}

export const OBSERVED_LABELS: Record<string, Localized> = {
  sessionsPerWeek: loc("Séances de grimpe / semaine (28 j)", "Climbing sessions / week (28 d)"),
  sendRate: loc("Taux de réussite (28 j)", "Send rate (28 d)"),
  flashRate: loc("Taux de flash (28 j)", "Flash rate (28 d)"),
  workingGrade: loc("Niveau de travail (60 j)", "Working grade (60 d)"),
};

export type MeasurementChange = {
  id: TestDefinition["id"]; before: number; after: number; delta: number;
  direction: "better" | "worse" | "same"; comparable: boolean;
};

/**
 * Baseline-versus-follow-up comparison of measured tests. A change is only
 * marked comparable when both values come from the same protocol version and
 * both were recorded under complete conditions.
 */
export function compareMeasurements(baseline: Measurement[], followUp: Measurement[]): MeasurementChange[] {
  return followUp.flatMap((after) => {
    const before = baseline.find((b) => b.id === after.id);
    const def = PROTOCOL_TESTS.find((t) => t.id === after.id);
    if (!before || !def) return [];
    const delta = Math.round((after.value - before.value) * 10) / 10;
    const signed = def.higherIsBetter ? delta : -delta;
    return [{
      id: after.id, before: before.value, after: after.value, delta,
      direction: signed > 0 ? "better" : signed < 0 ? "worse" : "same",
      comparable: before.protocolVersion === after.protocolVersion && before.quality === "complete" && after.quality === "complete",
    }];
  });
}

export function parseMeasurements(raw: unknown): Measurement[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((m) => {
    const parsed = measurementSchema.safeParse(m);
    return parsed.success ? [parsed.data as Measurement] : [];
  });
}

export function parseContext(raw: unknown): AssessmentContext | null {
  const parsed = assessmentContextSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/** Suggested reassessment date: halfway through the horizon, at least 4 weeks out. */
export function reassessmentDate(from: string, horizonWeeks: number): string {
  const weeks = Math.max(4, Math.round(horizonWeeks / 2));
  const [y, m, d] = from.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + weeks * 7)).toISOString().slice(0, 10);
}
