import { z } from "zod";
import { METHODS_FOR_PLANS, type Localized } from "./catalogue";
import type { Block, ExerciseSnapshot, Modality } from "./session-templates";

/** Pure domain model for executable training sessions (no I/O here). */

export const TRAINING_STATUSES = ["PLANNED", "IN_PROGRESS", "COMPLETED", "SKIPPED", "CANCELED", "INTERRUPTED"] as const;
export type TrainingStatus = (typeof TRAINING_STATUSES)[number];
export type ExerciseStatus = "PENDING" | "DONE" | "MODIFIED" | "SKIPPED";

export type TrainingSet = {
  id: string; setIndex: number; reps: number | null; seconds: number | null;
  loadKg: number | null; completed: boolean; notes: string;
};
export type TrainingExercise = {
  id: string; position: number; block: Block; methodId: string | null; name: string;
  instructions: Partial<ExerciseSnapshot>; modality: Modality;
  targetSets: number | null; targetReps: number | null; targetSeconds: number | null; restSeconds: number | null;
  intensity: string; status: ExerciseStatus; rpe: number | null; notes: string; sets: TrainingSet[];
};
export type TrainingSession = {
  id: string; title: string; objective: string; methodId: string | null;
  planId: string | null; planSessionIndex: number | null; calendarEntryId: string | null;
  climbingSessionId: string | null; venue: string; status: TrainingStatus;
  scheduledDate: string | null; scheduledTime: string | null; plannedMinutes: number | null;
  startedAt: string | null; pausedAt: string | null; pausedSeconds: number; completedAt: string | null;
  actualMinutes: number | null; currentIndex: number; rpe: number | null; pain: number | null;
  painNotes: string; notes: string; createdAt: string;
};

const methodIds = new Set(METHODS_FOR_PLANS.map((m) => m.id));
const optionalMethod = z.string().nullable().refine((v) => v === null || methodIds.has(v), "Unknown method");
const localDate = z.iso.date().refine((v) => v >= "2020-01-01" && v <= "2100-12-31");
const localTime = z.union([z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/), z.literal("")]);

/** Every way to create a training session. */
export const createTrainingSessionSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("quick"),
    methodId: optionalMethod,
    title: z.string().trim().max(120),
    minutes: z.number().int().min(10).max(240),
    date: localDate, time: localTime,
    startNow: z.boolean(),
  }).strict(),
  z.object({
    source: z.literal("plan"),
    planId: z.guid(), planSessionIndex: z.number().int().min(0).max(13),
    date: localDate, time: localTime,
    startNow: z.boolean(),
  }).strict(),
  z.object({ source: z.literal("calendar"), calendarEntryId: z.guid(), startNow: z.boolean() }).strict(),
]);
export type CreateTrainingSessionInput = z.infer<typeof createTrainingSessionSchema>;

/** A training session already done, entered after the fact: type, when, total time, free description. */
export const pastTrainingSchema = z.object({
  methodId: optionalMethod,
  title: z.string().trim().max(120),
  date: localDate,
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  minutes: z.number().int().min(5).max(480),
  rpe: z.number().int().min(1).max(10).nullable(),
  notes: z.string().trim().max(2000),
}).strict();

/** Editable fields of a session that is not running. */
export const editTrainingSchema = z.object({
  sessionId: z.guid(),
  title: z.string().trim().min(1).max(120),
  date: localDate,
  time: z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/),
  minutes: z.number().int().min(5).max(480),
  rpe: z.number().int().min(1).max(10).nullable(),
  pain: z.number().int().min(0).max(10).nullable(),
  notes: z.string().trim().max(2000),
}).strict();

export const saveSetSchema = z.object({
  exerciseId: z.guid(),
  setIndex: z.number().int().min(1).max(50),
  reps: z.number().int().min(0).max(500).nullable(),
  seconds: z.number().int().min(0).max(7200).nullable(),
  loadKg: z.number().min(-100).max(300).multipleOf(0.5).nullable(),
  completed: z.boolean(),
  notes: z.string().trim().max(300),
}).strict();
export type SaveSetInput = z.infer<typeof saveSetSchema>;

export const exerciseStatusSchema = z.object({
  exerciseId: z.guid(),
  status: z.enum(["PENDING", "DONE", "MODIFIED", "SKIPPED"]),
  rpe: z.number().int().min(1).max(10).nullable(),
  notes: z.string().trim().max(500),
}).strict();

export const completeSessionSchema = z.object({
  sessionId: z.guid(),
  rpe: z.number().int().min(1).max(10).nullable(),
  pain: z.number().int().min(0).max(10).nullable(),
  painNotes: z.string().trim().max(500),
  notes: z.string().trim().max(2000),
  climbingSessionId: z.guid().nullable(),
}).strict();

/** Allowed lifecycle transitions; the server rejects everything else. */
const TRANSITIONS: Record<TrainingStatus, readonly TrainingStatus[]> = {
  PLANNED: ["IN_PROGRESS", "SKIPPED", "CANCELED"],
  IN_PROGRESS: ["COMPLETED", "INTERRUPTED"],
  INTERRUPTED: ["IN_PROGRESS", "COMPLETED"],
  SKIPPED: ["PLANNED"],
  CANCELED: ["PLANNED"],
  COMPLETED: [],
};
export function canTransition(from: TrainingStatus, to: TrainingStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

/**
 * Active training time in whole seconds, derived only from timestamps so it
 * stays correct when the app is backgrounded, the phone sleeps or the page
 * reloads. Paused time is excluded.
 */
export function activeSeconds(
  s: Pick<TrainingSession, "startedAt" | "pausedAt" | "pausedSeconds" | "completedAt">,
  now: Date,
): number {
  if (!s.startedAt) return 0;
  const start = new Date(s.startedAt).getTime();
  const end = s.completedAt ? new Date(s.completedAt).getTime() : now.getTime();
  const pausedOpen = s.pausedAt && !s.completedAt ? Math.max(0, end - new Date(s.pausedAt).getTime()) : 0;
  return Math.max(0, Math.floor((end - start - pausedOpen) / 1000) - s.pausedSeconds);
}

/** Seconds left on a rest timer that ends at `endsAt` (epoch ms). */
export function restRemaining(endsAt: number | null, now: number): number {
  if (!endsAt) return 0;
  return Math.max(0, Math.ceil((endsAt - now) / 1000));
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0"), ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** The status an exercise gets when the session is completed. */
export function settledExerciseStatus(e: Pick<TrainingExercise, "status" | "sets" | "targetSets">): ExerciseStatus {
  if (e.status !== "PENDING") return e.status;
  const done = e.sets.filter((s) => s.completed).length;
  if (done === 0) return "SKIPPED";
  return e.targetSets && done < e.targetSets ? "MODIFIED" : "DONE";
}

export type SessionSummary = {
  exercises: number; done: number; modified: number; skipped: number; pending: number;
  plannedSets: number; completedSets: number; totalReps: number; totalHoldSeconds: number;
  plannedMinutes: number | null; actualMinutes: number | null;
};

/** Planned-versus-actual summary of one session. */
export function summarize(session: Pick<TrainingSession, "plannedMinutes" | "actualMinutes">, exercises: TrainingExercise[]): SessionSummary {
  const count = (st: ExerciseStatus) => exercises.filter((e) => e.status === st).length;
  const sets = exercises.flatMap((e) => e.sets.filter((s) => s.completed).map((s) => ({ s, e })));
  return {
    exercises: exercises.length,
    done: count("DONE"), modified: count("MODIFIED"), skipped: count("SKIPPED"), pending: count("PENDING"),
    plannedSets: exercises.reduce((n, e) => n + (e.targetSets ?? 0), 0),
    completedSets: sets.length,
    totalReps: sets.reduce((n, { s }) => n + (s.reps ?? 0), 0),
    totalHoldSeconds: sets.reduce((n, { s, e }) => n + (e.modality === "HOLD" || e.modality === "INTERVALS" || e.modality === "TIME" || e.modality === "FREE" ? (s.seconds ?? 0) : 0), 0),
    plannedMinutes: session.plannedMinutes,
    actualMinutes: session.actualMinutes,
  };
}

export type AdherenceStats = {
  planned: number; completed: number; skipped: number; interrupted: number; upcoming: number;
  completionRate: number | null; activeMinutes: number; averageRpe: number | null; painReports: number;
};

/**
 * Plan adherence over sessions whose scheduled date (or creation date) falls
 * before `today`. Upcoming sessions are counted separately and never as missed.
 */
export function adherence(
  sessions: Pick<TrainingSession, "status" | "scheduledDate" | "createdAt" | "actualMinutes" | "rpe" | "pain">[],
  today: string,
): AdherenceStats {
  const dated = sessions.map((s) => ({ s, date: s.scheduledDate ?? s.createdAt.slice(0, 10) }));
  const upcoming = dated.filter(({ s, date }) => s.status === "PLANNED" && date >= today).length;
  const due = dated.filter(({ s, date }) => !(s.status === "PLANNED" && date >= today) && s.status !== "CANCELED");
  const completed = due.filter(({ s }) => s.status === "COMPLETED");
  const rpes = completed.map(({ s }) => s.rpe).filter((n): n is number => n !== null);
  return {
    planned: due.length,
    completed: completed.length,
    skipped: due.filter(({ s }) => s.status === "SKIPPED" || s.status === "PLANNED").length,
    interrupted: due.filter(({ s }) => s.status === "INTERRUPTED").length,
    upcoming,
    completionRate: due.length ? completed.length / due.length : null,
    activeMinutes: completed.reduce((n, { s }) => n + (s.actualMinutes ?? 0), 0),
    averageRpe: rpes.length ? Math.round((rpes.reduce((a, b) => a + b, 0) / rpes.length) * 10) / 10 : null,
    painReports: completed.filter(({ s }) => (s.pain ?? 0) >= 3).length,
  };
}

/** Local calendar date (YYYY-MM-DD) for a Date in a given IANA zone. */
export function localDate_(d: Date, timeZone = "Europe/Paris"): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Date of weekday `day` (0 = Monday) in the week that starts on `monday`. */
export function dateForPlanDay(monday: string, day: number): string {
  const [y, m, d] = monday.split("-").map(Number);
  const out = new Date(Date.UTC(y, m - 1, d + day));
  return out.toISOString().slice(0, 10);
}

/** Monday of the local week containing `date` (YYYY-MM-DD). */
export function mondayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const offset = (dt.getUTCDay() + 6) % 7;
  dt.setUTCDate(dt.getUTCDate() - offset);
  return dt.toISOString().slice(0, 10);
}

export const pick = (l: Localized | undefined, locale: "fr" | "en") => (l ? l[locale] : "");
