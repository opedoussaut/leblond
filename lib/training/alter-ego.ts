import { z } from "zod";
import { PACT_STATUSES, PROGRESSION_V1, type Pact } from "@/lib/analytics/alter-ego";
import { gradeToScore } from "@/lib/grading/ordering";
import { FRENCH_ROUTE_GRADES } from "@/lib/grading/route-grades";
import { planSessionSchema } from "./plans";

const routeGrades: readonly string[] = FRENCH_ROUTE_GRADES;
const boulderGrade = z.string().refine((g) => gradeToScore("FONT", g) !== null, "Unknown Font grade").nullable();
const routeGrade = z.string().refine((g) => routeGrades.includes(g), "Unknown route grade").nullable();

/** A start and a goal go together, and a goal can't sit under the start. */
const bothOrdered = (from: string | null, to: string | null, score: (grade: string) => number | null) => {
  if (from === null || to === null) return from === to;
  return (score(to) ?? -1) >= (score(from) ?? 0);
};

export const signPactSchema = z.object({
  displayName: z.string().trim().min(1).max(40),
  planId: z.guid(),
  startDate: z.iso.date(),
  horizonWeeks: z.number().int().min(1).max(52),
  startBoulderGrade: boulderGrade, targetBoulderGrade: boulderGrade,
  startRouteGrade: routeGrade, targetRouteGrade: routeGrade,
}).strict()
  .refine((v) => bothOrdered(v.startBoulderGrade, v.targetBoulderGrade, (g) => gradeToScore("FONT", g)), "Boulder goal")
  .refine((v) => bothOrdered(v.startRouteGrade, v.targetRouteGrade, (g) => routeGrades.indexOf(g)), "Route goal");
export type SignPactInput = z.infer<typeof signPactSchema>;

export const changePactSchema = z.object({
  id: z.guid(),
  action: z.enum(["pause", "resume", "finish", "abandon"]),
}).strict();

const progressionSchema = z.object({
  version: z.number(), weeklyGain: z.number(), maxGain: z.number(), deloadEvery: z.number().int().min(1), deloadFactor: z.number(),
}).strict();

export type PactRow = {
  id: string; display_name: string; plan_name: string; plan_snapshot: unknown; progression: unknown;
  start_date: string; horizon_weeks: number; status: string; paused_since: string | null; paused_days: number;
  start_boulder_grade: string | null; target_boulder_grade: string | null;
  start_route_grade: string | null; target_route_grade: string | null;
};

/** A stored pact as a domain value, or null if its signed terms no longer parse. */
export function pactFromRow(row: PactRow): Pact | null {
  const plan = z.array(planSessionSchema).min(1).safeParse(row.plan_snapshot);
  const progression = progressionSchema.safeParse(row.progression);
  const status = z.enum(PACT_STATUSES).safeParse(row.status);
  if (!plan.success || !status.success) return null;
  return {
    id: row.id, displayName: row.display_name, planName: row.plan_name, plan: plan.data,
    progression: progression.success ? progression.data : PROGRESSION_V1,
    startDate: row.start_date, horizonWeeks: row.horizon_weeks, status: status.data,
    pausedSince: row.paused_since, pausedDays: row.paused_days,
    startBoulderGrade: row.start_boulder_grade, targetBoulderGrade: row.target_boulder_grade,
    startRouteGrade: row.start_route_grade, targetRouteGrade: row.target_route_grade,
  };
}
