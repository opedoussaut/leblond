import { z } from "zod";
import { FRENCH_ROUTE_GRADES } from "@/lib/grading/route-grades";
import { WALL_ANGLES } from "./types";

/**
 * Route (sport / roped) climbing vocabulary. Deliberately separate from the
 * bouldering model: French sport grades only, no colour circuits, no Font.
 */
export const ROUTE_STYLES = ["LEAD", "TOPROPE", "AUTOBELAY"] as const;
export type RouteStyle = (typeof ROUTE_STYLES)[number];

/** Clean ascents first; ordered from "best" to "did not top". */
export const ROUTE_RESULTS = ["ONSIGHT", "FLASH", "REDPOINT", "TOP_WITH_REST", "ATTEMPT"] as const;
export type RouteResult = (typeof ROUTE_RESULTS)[number];

export const CLEAN_RESULTS: readonly RouteResult[] = ["ONSIGHT", "FLASH", "REDPOINT"];
export const isClean = (r: RouteResult) => CLEAN_RESULTS.includes(r);
export const isTopped = (r: RouteResult) => r !== "ATTEMPT";
/** Onsight and flash only exist on the first ascent of a route. */
export const isFirstGoOnly = (r: RouteResult) => r === "ONSIGHT" || r === "FLASH";

export function routeGradeIndex(grade: string): number {
  return (FRENCH_ROUTE_GRADES as readonly string[]).indexOf(grade);
}

export const logRouteAscentSchema = z.object({
  sessionId: z.guid(),
  clientId: z.guid(),
  grade: z.enum(FRENCH_ROUTE_GRADES),
  style: z.enum(ROUTE_STYLES),
  result: z.enum(ROUTE_RESULTS),
  falls: z.number().int().min(0).max(50).nullable(),
  routeName: z.string().trim().max(120),
  wallAngle: z.enum(WALL_ANGLES),
  routeProjectId: z.guid().nullable().optional(),
  /** The gym's own colour when it grades routes by colour; `grade` is then the climber's French equivalent. */
  nativeGrade: z.string().min(1).max(20).nullable().optional(),
  /** Goes it took (each line). Onsight / flash are single-try by definition. */
  tries: z.number().int().min(1).max(100).default(1),
  /** Comment on the climb. */
  notes: z.string().trim().max(500).default(""),
  /** Extra lines of the same grade/style/result logged in one tap (one id each, for idempotency). */
  extraClientIds: z.array(z.guid()).max(29).default([]),
  /** Keep this route as a project (creates it from the name, or "Projet <grade>"). Single line only. */
  asProject: z.boolean().default(false),
}).strict()
  .refine((v) => !isClean(v.result) || !v.falls, "A clean ascent has no falls")
  .refine((v) => !isFirstGoOnly(v.result) || v.tries === 1, "Onsight and flash are first-go results")
  .refine((v) => !v.asProject || v.extraClientIds.length === 0, "A project is a single route");
export type LogRouteAscentInput = z.infer<typeof logRouteAscentSchema>;

/** Case- and accent-insensitive key used to recognise the same named route. */
export function routeKey(name: string): string {
  return name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}

/* ── Route projects ─────────────────────────────────────────────────────── */
export const ROUTE_PROJECT_STATUSES = ["ACTIVE", "SENT", "ABANDONED"] as const;
export type RouteProjectStatus = (typeof ROUTE_PROJECT_STATUSES)[number];

export const createRouteProjectSchema = z.object({
  gymId: z.guid(),
  routeName: z.string().trim().min(1).max(120),
  grade: z.enum(FRENCH_ROUTE_GRADES),
  goalStyle: z.enum(ROUTE_STYLES),
  notes: z.string().trim().max(2000),
}).strict();

export const updateRouteProjectSchema = z.object({
  id: z.guid(),
  grade: z.enum(FRENCH_ROUTE_GRADES),
  goalStyle: z.enum(ROUTE_STYLES),
  status: z.enum(ROUTE_PROJECT_STATUSES),
  notes: z.string().trim().max(2000),
}).strict();

/**
 * Does this ascent complete a project? It must be clean, and in the project's
 * goal style — a lead ascent also satisfies a top-rope or auto-belay goal.
 */
export function completesProject(result: RouteResult, style: RouteStyle, goal: RouteStyle): boolean {
  return isClean(result) && (style === goal || style === "LEAD");
}
