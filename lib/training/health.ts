import { z } from "zod";

/**
 * Self-reported health for training decisions: WHERE it hurts and HOW MUCH it
 * limits training. This is not a diagnosis. LEBLOND only uses it to keep
 * load away from a declared area, and always defers to a health professional.
 *
 * Levels follow how a climber can still train:
 *  - DISCOMFORT: train at reduced load;
 *  - PAIN: avoid loading the area;
 *  - ACUTE: acute or worsening — stop and see a professional.
 */
export const BODY_AREAS = ["fingers", "wrist", "elbow", "shoulder", "back", "hip", "knee", "other"] as const;
export type BodyArea = (typeof BODY_AREAS)[number];
export const PAIN_LEVELS = ["DISCOMFORT", "PAIN", "ACUTE"] as const;
export type PainLevel = (typeof PAIN_LEVELS)[number];

export const injurySchema = z.object({ area: z.enum(BODY_AREAS), level: z.enum(PAIN_LEVELS) }).strict();
export type Injury = z.infer<typeof injurySchema>;
export const injuriesSchema = z.array(injurySchema).max(BODY_AREAS.length)
  .refine((list) => new Set(list.map((i) => i.area)).size === list.length, "Each area once");

export type Health = { injuries: Injury[]; unspecifiedPain: boolean };
export const NO_HEALTH_ISSUE: Health = { injuries: [], unspecifiedPain: false };

/** 1 = light, 2 = moderate, 3 = heavy involvement of an area. */
export type Load = 0 | 1 | 2 | 3;
export type LoadMap = Partial<Record<Exclude<BodyArea, "other">, 1 | 2 | 3>>;

/**
 * Which areas each protocol test and each Atlas method loads. EDITORIAL
 * coaching heuristics, not biomechanical measurements: they only decide what
 * LEBLOND offers, adapts or leaves out when an area is declared.
 */
export const TEST_LOADS: Readonly<Record<"hang-20mm" | "pull-ups" | "continuous-climb" | "quiet-feet", LoadMap>> = {
  "hang-20mm": { fingers: 3, elbow: 2, shoulder: 2, wrist: 2 },
  "pull-ups": { shoulder: 3, elbow: 3, fingers: 1, wrist: 1, back: 1 },
  "continuous-climb": { fingers: 1, wrist: 1, elbow: 1, shoulder: 1, back: 1, knee: 1 },
  "quiet-feet": { fingers: 1, shoulder: 1, knee: 1 },
};

export const METHOD_LOADS: Readonly<Record<string, LoadMap>> = {
  "technique": { fingers: 1, wrist: 1, shoulder: 1, knee: 1 },
  "constraints": { fingers: 1, wrist: 1, shoulder: 1, knee: 1 },
  "limit-bouldering": { fingers: 3, shoulder: 3, elbow: 2, wrist: 2, back: 2, knee: 2 },
  "max-hangs": { fingers: 3, elbow: 2, shoulder: 2, wrist: 2 },
  "repeaters": { fingers: 3, elbow: 2, shoulder: 2, wrist: 1 },
  "easy-volume": { fingers: 1, wrist: 1, elbow: 1, shoulder: 1, knee: 1 },
  "four-by-four": { fingers: 2, elbow: 2, shoulder: 2, wrist: 1, knee: 1 },
  "campus": { fingers: 3, elbow: 3, shoulder: 3, wrist: 2 },
  "strength-conditioning": { shoulder: 3, elbow: 2, wrist: 2, back: 2, knee: 1 },
  "hip-mobility": { hip: 1, knee: 1, back: 1 },
  "mental": { fingers: 1, shoulder: 1 },
  "periodized": { fingers: 2, elbow: 2, shoulder: 2, wrist: 1, back: 1, knee: 1 },
};

/** Methods that only make sense near maximal effort: no "reduced load" version. */
export const MAXIMAL_METHODS: ReadonlySet<string> = new Set(["limit-bouldering", "max-hangs", "campus"]);

/**
 * Health as declared in an assessment context. Legacy assessments only stored
 * a yes/no "current pain" answer to a question about fingers, elbows and
 * shoulders; it is kept as unlocalised pain, never turned into declared areas.
 */
export function healthFromContext(ctx: { currentPain?: boolean; injuries?: Injury[] } | null | undefined): Health {
  if (!ctx) return NO_HEALTH_ISSUE;
  const injuries = injuriesSchema.safeParse(ctx.injuries ?? []);
  return { injuries: injuries.success ? injuries.data : [], unspecifiedPain: !ctx.injuries && ctx.currentPain === true };
}

/** Injuries the rules act on: declared areas, plus legacy pain read as pain in the areas the old question named. */
export function restrictionsOf(health: Health): Injury[] {
  if (!health.unspecifiedPain) return health.injuries;
  const declared = new Set(health.injuries.map((i) => i.area));
  const legacy = (["fingers", "elbow", "shoulder"] as const)
    .filter((area) => !declared.has(area)).map((area) => ({ area, level: "PAIN" as const }));
  return [...health.injuries, ...legacy];
}

export function needsProfessional(health: Health): boolean {
  return health.injuries.some((i) => i.level === "ACUTE");
}

export type VerdictStatus = "ok" | "adapt" | "avoid";
export type Verdict = { status: VerdictStatus; because: Array<{ area: BodyArea; level: PainLevel; load: Load }> };

const RANK: Record<VerdictStatus, number> = { ok: 0, adapt: 1, avoid: 2 };
const LEVEL_RANK: Record<PainLevel, number> = { DISCOMFORT: 0, PAIN: 1, ACUTE: 2 };

/**
 * What to do with an exercise given its loads and the declared injuries:
 *  - ACUTE: any load on the area → avoid;
 *  - PAIN: moderate or heavy load → avoid, light load → adapt;
 *  - DISCOMFORT: heavy load → avoid if the exercise is maximal, else adapt;
 *    moderate → adapt; light → ok.
 * An area outside the list ("other") is assumed to be lightly involved in everything.
 */
export function loadVerdict(loads: LoadMap, injuries: readonly Injury[], maximal: boolean): Verdict {
  let status: VerdictStatus = "ok";
  const because: Verdict["because"] = [];
  for (const injury of injuries) {
    const load: Load = injury.area === "other" ? 1 : loads[injury.area] ?? 0;
    if (load === 0) continue;
    const s: VerdictStatus = injury.level === "ACUTE" ? "avoid"
      : injury.level === "PAIN" ? (load >= 2 ? "avoid" : "adapt")
      : load === 3 ? (maximal ? "avoid" : "adapt") : load === 2 ? "adapt" : "ok";
    if (s === "ok") continue;
    because.push({ area: injury.area, level: injury.level, load });
    if (RANK[s] > RANK[status]) status = s;
  }
  because.sort((a, b) => LEVEL_RANK[b.level] - LEVEL_RANK[a.level] || b.load - a.load);
  return { status, because };
}

/** Verdict for an Atlas method (null = a gentle mobility session, which loads nothing heavily). */
export function methodVerdict(methodId: string | null, health: Health): Verdict {
  const loads = methodId ? METHOD_LOADS[methodId] ?? {} : {};
  return loadVerdict(loads, restrictionsOf(health), methodId !== null && MAXIMAL_METHODS.has(methodId));
}

/** Tests measure capacity, so they count as maximal: at reduced load they are not comparable. */
export function testVerdict(testId: keyof typeof TEST_LOADS, health: Health): Verdict {
  return loadVerdict(TEST_LOADS[testId], restrictionsOf(health), true);
}
