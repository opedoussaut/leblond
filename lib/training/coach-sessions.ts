import { z } from "zod";
import { METHODS_FOR_PLANS } from "./catalogue";
import { PLAN_PLACES } from "./plans";
import { TEMPLATE_VERSION, type Block, type ExerciseSnapshot, type Modality } from "./session-templates";
import { ILLUSTRATIONS } from "./illustrations";

/**
 * Coach sessions: complete sessions written for one climber by their coach
 * (Claude outside the app, later Patrick), pushed with a personal coach key and
 * offered in the session type list. Starting one copies its exercises into a
 * normal training session. Pure domain code (no I/O).
 *
 * Loads and volumes are the coach's proposal for this climber, not a validated
 * prescription; every exercise stays editable and skippable in the player.
 */

/**
 * MuscleWiki exercise pages checked to exist (https://musclewiki.com/exercise/<slug>).
 * A link is only shown for a slug in this list, so a session never sends the
 * climber to a missing page. Add a slug here once its page has been checked.
 */
export const MUSCLEWIKI_SLUGS = [
  "adductor-stretch-dynamic-unilateral-4-point-position", "adductor-stretch-seated-bilateral-static",
  "band-face-pull", "band-hip-abduction", "band-pull-apart", "barbell-front-raise", "bench-dips",
  "bodyweight-box-squat", "bodyweight-step-down", "cable-external-rotation", "cable-internal-rotation",
  "cable-lat-prayer", "calves-stretch-variation-one", "cat-pose", "chest-stretch-variation-one",
  "child-pose-arms-extended", "dead-hang", "dumbbell-bulgarian-split-squat", "dumbbell-curl",
  "dumbbell-overhead-press", "dumbbell-pullover", "dumbbell-romanian-deadlift", "dumbbell-wrist-extension",
  "glute-bridge", "good-mornings", "hamstring-stretch-supine-static", "hanging-knee-raises",
  "hip-flexor-stretch-kneeling-lunge-2", "kettlebell-goblet-squat", "kettlebell-romanian-deadlift",
  "lat-and-shoulder-external-rotation-stretch-1-kneeling-dowel", "pull-ups", "push-up", "side-lunges",
  "single-leg-glute-bridge", "wall-sit", "weighted-pull-ups",
] as const;
const musclewikiSlugs: ReadonlySet<string> = new Set(MUSCLEWIKI_SLUGS);

export function musclewikiUrl(slug: string | undefined | null): string | null {
  return slug && musclewikiSlugs.has(slug) ? "https://musclewiki.com/exercise/" + slug : null;
}

/**
 * Sites whose exercise pages were checked to show a clear illustration or video,
 * for exercises MuscleWiki has no page for. A demo link must point to one of them.
 */
export const DEMO_HOSTS = [
  "workoutlabs.com", "latticetraining.com", "www.caliverse.app", "sworkit.com", "www.acefitness.org",
] as const;
const demoHosts: ReadonlySet<string> = new Set(DEMO_HOSTS);

/** A demo link if its host is allowed, else null. */
export function demoUrl(url: string | undefined | null): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return u.protocol === "https:" && demoHosts.has(u.hostname) ? u.toString() : null;
  } catch { return null; }
}

const BLOCKS = ["WARMUP", "MAIN", "COOLDOWN"] as const satisfies readonly Block[];
const MODALITIES = ["REPS", "HOLD", "TIME", "ROUTES", "INTERVALS", "FREE"] as const satisfies readonly Modality[];
const methodIds = new Set(METHODS_FOR_PLANS.map((m) => m.id));
const text = (max: number) => z.string().trim().max(max);

export const MAX_COACH_EXERCISES = 40;

export const coachExerciseSchema = z.object({
  block: z.enum(BLOCKS),
  name: z.string().trim().min(1).max(120),
  modality: z.enum(MODALITIES).default("REPS"),
  sets: z.number().int().min(1).max(30).optional(),
  reps: z.number().int().min(1).max(200).optional(),
  seconds: z.number().int().min(1).max(7200).optional(),
  /** Rest between two sets of this exercise. */
  restSeconds: z.number().int().min(0).max(1800).optional(),
  /** Rest after this exercise, before the next one starts. */
  restAfterSeconds: z.number().int().min(0).max(900).optional(),
  /** Edge size in mm for hangs and no-hangs (12, 20…): pre-filled when logging a set. */
  edgeMm: z.number().int().min(3).max(60).optional(),
  /** "4 kg", "poids du corps", "bande légère"… shown as written. */
  load: text(80).optional(),
  intensity: text(160).optional(),
  summary: text(500).optional(),
  steps: z.array(z.string().trim().min(1).max(300)).max(8).optional(),
  safety: text(300).optional(),
  /** MuscleWiki page; must be one of MUSCLEWIKI_SLUGS. */
  musclewiki: z.string().refine((s) => musclewikiSlugs.has(s), "Unverified MuscleWiki page").optional(),
  /** Illustrated demo elsewhere (when MuscleWiki has no page): a page on one of DEMO_HOSTS. */
  demo: z.object({
    label: z.string().trim().min(1).max(60),
    url: z.string().max(500).refine((u) => demoUrl(u) !== null, "Demo must be an https page on an approved site"),
  }).strict().optional(),
  /** One of LEBLOND's own drawings (lib/training/illustrations.ts), shown with the exercise. */
  illustration: z.enum(ILLUSTRATIONS).optional(),
  /** Atlas method the exercise belongs to, for the Atlas link. */
  methodId: z.string().refine((id) => methodIds.has(id), "Unknown training method").optional(),
}).strict();

export const coachSourceSchema = z.object({
  label: z.string().trim().min(1).max(120),
  url: z.url({ protocol: /^https$/ }).max(500),
}).strict();

export const coachSessionSchema = z.object({
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,59}$/),
  title: z.string().trim().min(1).max(120),
  objective: text(300).default(""),
  minutes: z.number().int().min(10).max(240),
  place: z.enum(PLAN_PLACES).nullable().default(null),
  exercises: z.array(coachExerciseSchema).min(1).max(MAX_COACH_EXERCISES),
  /** Where the content comes from (coaching articles, studies, MuscleWiki…). */
  sources: z.array(coachSourceSchema).max(8).default([]),
  notes: text(1000).default(""),
  /**
   * Offered to every climber (the coach's library), not only to the key's owner.
   * Only an administrator's key may share. Shared content must stay generic:
   * no one's personal or health details.
   */
  shared: z.boolean().default(false),
}).strict();

export type CoachExercise = z.infer<typeof coachExerciseSchema>;
export type CoachSessionInput = z.input<typeof coachSessionSchema>;
export type CoachSessionData = z.infer<typeof coachSessionSchema>;
export type CoachSession = CoachSessionData & { id: string; ownerId: string; author: "CLAUDE" | "PATRICK"; updatedAt: string };

/** The jsonb `content` column: everything but the columns of their own. */
export function coachContent(s: CoachSessionData) {
  return { exercises: s.exercises, sources: s.sources, notes: s.notes };
}

export const COACH_SESSION_COLUMNS = "id,user_id,slug,title,objective,minutes,place,author,shared,content,updated_at" as const;

type Row = {
  id: string; user_id: string; shared: boolean; slug: string; title: string; objective: string; minutes: number; place: string | null;
  author: string; content: unknown; updated_at: string;
};

/** A stored row, re-validated: a row that no longer parses is skipped (null). */
export function coachSessionFromRow(row: Row): CoachSession | null {
  const content = (row.content && typeof row.content === "object" ? row.content : {}) as Record<string, unknown>;
  const parsed = coachSessionSchema.safeParse({
    slug: row.slug, title: row.title, objective: row.objective, minutes: row.minutes, place: row.place,
    exercises: content.exercises, sources: content.sources ?? [], notes: content.notes ?? "", shared: row.shared,
  });
  if (!parsed.success) return null;
  return { ...parsed.data, id: row.id, ownerId: row.user_id, author: row.author === "PATRICK" ? "PATRICK" : "CLAUDE", updatedAt: row.updated_at };
}

const same = (s: string) => ({ fr: s, en: s });

/** Snapshot stored with each exercise of a started session (same shape as the Atlas templates, plus the coach fields). */
export function coachSnapshot(e: CoachExercise, slug: string, index: number): ExerciseSnapshot {
  return {
    version: TEMPLATE_VERSION,
    key: `coach:${slug}:${index}`,
    summary: same(e.summary ?? ""),
    steps: (e.steps ?? []).map(same),
    intensity: same(e.intensity ?? ""),
    ...(e.safety ? { safety: same(e.safety) } : {}),
    ...(e.load ? { load: e.load } : {}),
    ...(e.musclewiki ? { musclewiki: e.musclewiki } : {}),
    ...(e.restAfterSeconds ? { restAfter: e.restAfterSeconds } : {}),
    ...(e.edgeMm ? { edgeMm: e.edgeMm } : {}),
    ...(e.demo ? { demo: e.demo } : {}),
    ...(e.illustration ? { illustration: e.illustration } : {}),
  };
}

/** The training_session_exercises rows (without ids) for a coach session. */
export function coachExerciseRows(s: CoachSessionData) {
  return s.exercises.map((e, position) => ({
    position, block: e.block, method_id: e.methodId ?? null, name: e.name,
    instructions: coachSnapshot(e, s.slug, position), modality: e.modality,
    target_sets: e.sets ?? null, target_reps: e.reps ?? null, target_seconds: e.seconds ?? null,
    rest_seconds: e.restSeconds ?? null, intensity: (e.intensity ?? "").slice(0, 160),
  }));
}
