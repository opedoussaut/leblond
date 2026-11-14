import { z } from "zod";
import { FONT_SCALE } from "@/lib/grading/systems";
import { WALL_ANGLES } from "./types";

/*
 * Outdoor projects (boulders and routes): where the project is (an existing
 * outdoor site or a new one typed by the climber), and the details a climber
 * wants to keep — sector, angle, beta, topo citation and link. Grades are the
 * native ones as entered: Font for boulders, French for routes. Never converted.
 */

/** Link to the original topo / guide page: https only, never a copy of it. */
export const topoUrlSchema = z.union([z.string().trim().max(500).regex(/^https:\/\/\S+$/), z.literal("")]);

/** An existing outdoor site, or a new one created on the fly (shared catalogue, brand OUTDOOR). */
export const outdoorSiteSchema = z.union([
  z.object({ gymId: z.guid() }).strict(),
  z.object({
    newSite: z.object({
      name: z.string().trim().min(2).max(120),
      city: z.string().trim().max(120).default(""),
      sourceUrl: topoUrlSchema.default(""),
    }).strict(),
  }).strict(),
]);
export type OutdoorSiteInput = z.input<typeof outdoorSiteSchema>;

/** A Font grade typed in any case, written as the Font scale stores it (unknown grades unchanged). */
export function fontSpelling(grade: string): string {
  return FONT_SCALE.find((g) => g.toLowerCase() === grade.toLowerCase()) ?? grade;
}

/** Details shared by outdoor boulder and route projects. */
export const outdoorDetailsShape = {
  sector: z.string().trim().max(80).default(""),
  wallAngle: z.enum(WALL_ANGLES).default("UNKNOWN"),
  beta: z.string().trim().max(2000).default(""),
  topoRef: z.string().trim().max(160).default(""),
  topoUrl: topoUrlSchema.default(""),
};

export const createOutdoorBoulderProjectSchema = z.object({
  site: outdoorSiteSchema,
  /** A boulder picked from the site's topo (Boolder or team topo), if any. */
  outdoorProblemId: z.number().int().positive().nullable().default(null),
  name: z.string().trim().max(120).default(""),
  /** Native Font grade as entered, in the scale's own spelling ("7a" → "7A", "4C" → "4c"). */
  grade: z.string().trim().transform(fontSpelling).pipe(z.enum(FONT_SCALE)),
  notes: z.string().trim().max(4000).default(""),
  ...outdoorDetailsShape,
}).strict()
  // A boulder typed by hand needs a name to be recognisable in the list.
  .refine((v) => v.outdoorProblemId !== null || v.name.length > 0, { path: ["name"] });
export type CreateOutdoorBoulderProjectInput = z.input<typeof createOutdoorBoulderProjectSchema>;

/** Where a project is, for the projects list: "Site · Secteur". */
export function projectPlace(site: string | null | undefined, sector: string | null | undefined): string {
  return [site?.trim(), sector?.trim()].filter(Boolean).join(" · ");
}

/** Empty strings from forms are stored as no value. */
export function orNull(v: string | null | undefined): string | null {
  const s = v?.trim();
  return s ? s : null;
}
