import { z } from "zod";
import { METHODS_FOR_PLANS } from "./catalogue";

const methodIds = new Set(METHODS_FOR_PLANS.map((method) => method.id));

/** Where a planned session happens. HOME = off-wall training (hangboard, bar, weights, mobility). */
export const PLAN_PLACES = ["BOULDER_GYM", "ROUTE_GYM", "CRAG", "HOME"] as const;
export type PlanPlace = (typeof PLAN_PLACES)[number];

/**
 * One session of the repeating weekly template. `methodId` is an Atlas method,
 * or null for a session outside the Atlas (mobility), named by `title`.
 * `place` and `title` are optional so plans saved before them still parse.
 */
export const planSessionSchema = z.object({
  day: z.number().int().min(0).max(6),
  methodId: z.string().refine((id) => methodIds.has(id), "Unknown training method").nullable(),
  minutes: z.number().int().min(10).max(240),
  notes: z.string().max(500),
  place: z.enum(PLAN_PLACES).optional(),
  title: z.string().trim().min(1).max(80).optional(),
}).strict().refine((s) => s.methodId !== null || !!s.title, "A session outside the Atlas needs a title");

export const trainingPlanSchema = z.object({
  id: z.guid().optional(),
  name: z.string().trim().min(1).max(100),
  goal: z.string().trim().max(300),
  weeks: z.number().int().min(1).max(52),
  sessions: z.array(planSessionSchema).min(1).max(14),
}).strict();

export type TrainingPlanInput = z.infer<typeof trainingPlanSchema>;
export type PlanSession = z.infer<typeof planSessionSchema>;
export type SavedTrainingPlan = TrainingPlanInput & { id: string; updatedAt: string };

export const DEFAULT_PLAN: TrainingPlanInput = {
  name: "My climbing week",
  goal: "",
  weeks: 4,
  sessions: [
    { day: 1, methodId: "technique", minutes: 60, notes: "" },
    { day: 3, methodId: "easy-volume", minutes: 60, notes: "" },
    { day: 5, methodId: "strength-conditioning", minutes: 45, notes: "" },
  ],
};
