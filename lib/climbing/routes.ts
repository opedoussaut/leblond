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
}).strict().refine((v) => !isClean(v.result) || !v.falls, "A clean ascent has no falls");
export type LogRouteAscentInput = z.infer<typeof logRouteAscentSchema>;

/** Case- and accent-insensitive key used to recognise the same named route. */
export function routeKey(name: string): string {
  return name.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();
}
