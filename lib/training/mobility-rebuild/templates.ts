import { z } from "zod";
import { coachExerciseSchema, coachSnapshot } from "@/lib/training/coach-sessions";
import type { ExerciseSnapshot } from "@/lib/training/session-templates";
import {
  LETTERS, PHASES, PHASE_MINUTES, REBUILD_PROGRAMME, TOTAL_SESSIONS, schedule, validDays,
  type DatedSlot, type Letter, type Phase,
} from "./engine";

/**
 * The content of a Mobility Rebuild programme, as the coach writes it for one
 * climber and sends it with their coach key: one séance per letter (A, B, C)
 * and phase (1–6), 18 in all. The content is the climber's own (it lives in
 * their enrolment, never in this repository); this file only checks its shape:
 *
 *  - every séance lasts exactly its phase's length, and its exercises add up
 *    to that length minute for minute (check-in, warm-up, rests and logging
 *    included);
 *  - every main exercise has an alternative for when it hurts or blocks.
 */

export const rebuildExerciseSchema = coachExerciseSchema.extend({
  /** Time booked for this exercise, rests included. */
  minutes: z.number().int().min(1).max(60),
  /** What to do instead if the exercise causes pain or a block. */
  alternative: z.string().trim().min(1).max(300).optional(),
}).strict();

export type RebuildExercise = z.infer<typeof rebuildExerciseSchema>;

export const rebuildTemplateSchema = z.object({
  letter: z.enum(LETTERS),
  phase: z.number().int().min(1).max(6).transform((n) => n as Phase),
  title: z.string().trim().min(1).max(120),
  objective: z.string().trim().max(300).default(""),
  minutes: z.number().int().min(10).max(240),
  exercises: z.array(rebuildExerciseSchema).min(1).max(40),
}).strict().superRefine((t, ctx) => {
  if (t.minutes !== PHASE_MINUTES[t.phase]) {
    ctx.addIssue({ code: "custom", path: ["minutes"], message: `Phase ${t.phase} séances last ${PHASE_MINUTES[t.phase]} min` });
  }
  const sum = t.exercises.reduce((a, e) => a + e.minutes, 0);
  if (sum !== t.minutes) ctx.addIssue({ code: "custom", path: ["exercises"], message: `Exercises add up to ${sum} min, not ${t.minutes}` });
  t.exercises.forEach((e, i) => {
    if (e.block === "MAIN" && !e.alternative) ctx.addIssue({ code: "custom", path: ["exercises", i, "alternative"], message: "A main exercise needs an alternative" });
  });
});

export type RebuildTemplate = z.infer<typeof rebuildTemplateSchema>;

const usualSchema = z.object({ backPain: z.number().int().min(0).max(10), legRadiation: z.number().int().min(0).max(10) }).strict().nullable().default(null);

export const rebuildProgrammeSchema = z.object({
  programme: z.literal(REBUILD_PROGRAMME),
  /** ISO weekdays (1 = Monday): three, never two days in a row. */
  days: z.array(z.number().int().min(1).max(7)).refine(validDays, "Three weekdays, never two in a row"),
  /** The climber's usual pain levels, from their own baseline; used to read the check-in. */
  usual: usualSchema,
  templates: z.array(rebuildTemplateSchema).length(LETTERS.length * PHASES.length),
  notes: z.string().trim().max(1000).default(""),
}).strict().superRefine((p, ctx) => {
  const seen = new Set(p.templates.map((t) => t.letter + t.phase));
  for (const l of LETTERS) for (const ph of PHASES) {
    if (!seen.has(l + ph)) ctx.addIssue({ code: "custom", path: ["templates"], message: `Missing séance ${l} phase ${ph}` });
  }
});

export type RebuildProgrammeInput = z.input<typeof rebuildProgrammeSchema>;
export type RebuildProgramme = z.infer<typeof rebuildProgrammeSchema>;

/** What the enrolment stores (`content`). */
export type RebuildContent = Pick<RebuildProgramme, "usual" | "templates" | "notes"> & { version: 1 };

export function contentOf(p: RebuildProgramme): RebuildContent {
  return { version: 1, usual: p.usual, templates: p.templates, notes: p.notes };
}

/** The stored content, re-validated; null when it no longer parses. */
export function parseContent(raw: unknown): RebuildContent | null {
  const r = z.object({
    version: z.literal(1),
    usual: usualSchema,
    templates: z.array(rebuildTemplateSchema),
    notes: z.string().default(""),
  }).safeParse(raw);
  return r.success ? (r.data as RebuildContent) : null;
}

export function templateFor(content: Pick<RebuildContent, "templates">, letter: Letter, phase: Phase): RebuildTemplate | null {
  return content.templates.find((t) => t.letter === letter && t.phase === phase) ?? null;
}

export type RebuildSnapshot = ExerciseSnapshot & { minutes: number };

/** The training_session_exercises rows (without ids) of a séance of the programme. */
export function rebuildExerciseRows(t: RebuildTemplate) {
  const key = `rebuild-${t.letter.toLowerCase()}${t.phase}`;
  return t.exercises.map((e, position) => {
    const { minutes, alternative, ...coach } = e;
    const base = coachSnapshot(coach, key, position);
    const instructions: RebuildSnapshot = {
      ...base, key: `rebuild:${t.letter}${t.phase}:${position}`, minutes,
      ...(alternative ? { alternative, adaptation: { fr: alternative, en: alternative } } : {}),
    };
    return {
      position, block: e.block, method_id: e.methodId ?? null, name: e.name, instructions, modality: e.modality,
      target_sets: e.sets ?? null, target_reps: e.reps ?? null, target_seconds: e.seconds ?? null,
      rest_seconds: e.restSeconds ?? null, intensity: (e.intensity ?? "").slice(0, 160),
    };
  });
}

export type PlannedSession = DatedSlot & { title: string; exercises: ReturnType<typeof rebuildExerciseRows> };

/**
 * The séances to plan: the dated slots with the content of their planned phase.
 * Slots dated today or earlier are left out (never backdated).
 */
export function plannedSessions(p: Pick<RebuildProgramme, "days" | "templates">, today: string, startOn?: string): PlannedSession[] {
  const out: PlannedSession[] = [];
  for (const s of schedule(p.days, today, startOn)) {
    if (s.date <= today) continue;
    const t = templateFor(p, s.letter, s.phase);
    if (!t) throw new Error("template");
    out.push({ ...s, title: `${s.letter} · ${t.title}`, exercises: rebuildExerciseRows(t) });
  }
  if (out.length > TOTAL_SESSIONS) throw new Error("slots");
  return out;
}
