import type { TrainingExercise, TrainingSession } from "@/lib/training/sessions";
import { HIP_METHOD_ID, LEVELS, type Level } from "./content";
import type { MobilitySessionRecord } from "./prescription";

/** True for a training session of the hip-mobility programme. */
export function isHipMobilitySession(s: Pick<TrainingSession, "methodId">): boolean {
  return s.methodId === HIP_METHOD_ID;
}

/** The local date a session counts on: its scheduled day, else the day it ended or was created. */
export function sessionDate(s: Pick<TrainingSession, "scheduledDate" | "completedAt" | "createdAt">): string {
  return s.scheduledDate ?? (s.completedAt ?? s.createdAt).slice(0, 10);
}

/**
 * A recorded hip-mobility session as the progression rules and the analytics read
 * it. Only sessions that were actually done (completed or stopped early) count;
 * exercises without a mobility snapshot are ignored.
 */
export function mobilityRecord(session: TrainingSession, exercises: readonly TrainingExercise[]): MobilitySessionRecord | null {
  if (!isHipMobilitySession(session)) return null;
  if (session.status !== "COMPLETED" && session.status !== "INTERRUPTED") return null;
  const mobile = exercises.filter((e) => e.instructions.mobility?.exerciseId);
  if (mobile.length === 0) return null;
  const raw = mobile[0].instructions.mobility!.level;
  const level: Level = (LEVELS as readonly number[]).includes(raw) ? raw : 0;
  return {
    id: session.id, date: sessionDate(session), status: session.status, level,
    pain: session.pain, rpe: session.rpe, minutes: session.actualMinutes,
    exercises: mobile.map((e) => ({
      exerciseId: e.instructions.mobility!.exerciseId,
      status: e.status,
      prescribed: e.instructions.mobility!.dose ?? null,
      sets: e.sets.map((s) => ({
        side: s.side ?? null, reps: s.reps, variant: s.variant ?? null, controlled: s.controlled ?? null,
        discomfort: s.discomfort ?? null, flags: s.flags ?? [], completed: s.completed,
      })),
    })),
  };
}
