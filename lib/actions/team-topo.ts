"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { KmzError, kmlText } from "@/lib/integrations/outdoor/kmz";
import { CIRCUIT_COLORS, searchable, type CircuitColor } from "@/lib/integrations/outdoor/boolder";
import { buildTeamTopo, parseKml, type SkipReason } from "@/lib/integrations/outdoor/mymaps";
import { circuitsOf, mergeTopoList, parseTopoList, type ListedProblem, type MergeReport } from "@/lib/integrations/outdoor/topo-list";
import { FONT_SCALE, type FontGrade } from "@/lib/grading/systems";
import type { ActionResult } from "@/lib/validation/common";

/** Below Next's 1 MB server-action body limit, with room for the form fields. */
const MAX_UPLOAD_BYTES = 900 * 1024;
/** A pasted list: a few hundred lines per site. */
const MAX_LIST_CHARS = 200_000;

export type TopoImportError = "forbidden" | "site" | "noFile" | "tooLarge" | "notKml" | "linkOnly" | "empty" | "emptyList" | "noTopoYet" | "failed";

export type TopoImportState =
  | null
  | { ok: false; error: TopoImportError }
  | {
      ok: true;
      problems: number;
      circuits: number;
      added: number;
      updated: number;
      removed: number;
      unlinked: number;
      skipped: Array<{ name: string; folder: string | null; reason: SkipReason }>;
      /** Only when a written list was given. */
      list: (MergeReport & { unreadable: string[] }) | null;
    };

const counts = z.object({
  problems: z.number().int(),
  circuits: z.number().int(),
  added: z.number().int(),
  updated: z.number().int(),
  removed: z.number().int(),
  unlinked: z.number().int(),
});

/**
 * Admin-only: imports a topo drawn in Google My Maps (KMZ/KML export), and/or
 * the written list of its circuits and boulders (see topo-list.ts), into an
 * outdoor site outside the Boolder catalogue. The file is read here and never
 * stored; only the boulders reach the database, through
 * admin_import_leblond_topo() in the admin's own session.
 */
export async function importTeamTopo(_prev: TopoImportState, formData: FormData): Promise<TopoImportState> {
  const viewer = await requireViewer();
  if (viewer.role !== "admin") return { ok: false, error: "forbidden" };
  const gymId = z.guid().safeParse(formData.get("gymId"));
  if (!gymId.success) return { ok: false, error: "site" };
  const file = formData.get("file");
  const hasFile = file instanceof File && file.size > 0;
  const listText = String(formData.get("list") ?? "").slice(0, MAX_LIST_CHARS);
  if (!hasFile && !listText.trim()) return { ok: false, error: "noFile" };

  // Positions: the uploaded My Maps export, or else the site's current topo.
  let pins: ListedProblem[];
  let skipped: Array<{ name: string; folder: string | null; reason: SkipReason }> = [];
  if (hasFile) {
    if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "tooLarge" };
    try {
      const doc = parseKml(kmlText(new Uint8Array(await file.arrayBuffer())));
      if (doc.networkLinkOnly) return { ok: false, error: "linkOnly" };
      const topo = buildTeamTopo(doc);
      pins = topo.problems;
      skipped = topo.skipped;
    } catch (e) {
      return { ok: false, error: e instanceof KmzError ? e.code : "notKml" };
    }
    if (pins.length === 0) return { ok: false, error: "empty" };
  } else {
    const { data, error } = await viewer.supabase
      .from("outdoor_problems")
      .select("source_key, name, name_searchable, grade, circuit_color, circuit_number, latitude, longitude, outdoor_areas!inner(gym_id)")
      .eq("source", "LEBLOND")
      .eq("outdoor_areas.gym_id", gymId.data);
    if (error) return { ok: false, error: "failed" };
    pins = (data ?? []).filter((p) => p.source_key).map((p) => ({
      key: p.source_key as string,
      name: p.name,
      name_searchable: p.name_searchable,
      grade: p.grade as FontGrade,
      circuit_color: p.circuit_color as CircuitColor | null,
      circuit_number: p.circuit_number,
      latitude: p.latitude,
      longitude: p.longitude,
    }));
    if (pins.length === 0) return { ok: false, error: "noTopoYet" };
  }

  // The written list, when given, is the reference for circuits, numbers, names and grades.
  let problems = pins;
  let list: (MergeReport & { unreadable: string[] }) | null = null;
  if (listText.trim()) {
    const parsed = parseTopoList(listText);
    if (parsed.entries.length === 0) return { ok: false, error: "emptyList" };
    const merged = mergeTopoList(pins, parsed);
    problems = merged.problems;
    list = { ...merged.report, unreadable: parsed.unreadable };
  }

  const creditField = z.string().trim().max(200).safeParse(formData.get("credit") ?? "");
  const credit = creditField.success && creditField.data ? creditField.data : null;
  const { data, error } = await viewer.supabase.rpc("admin_import_leblond_topo", {
    p_gym_id: gymId.data,
    p_topo: { credit, circuits: circuitsOf(problems), problems, skipped: skipped.length },
  });
  if (error) return { ok: false, error: error.message.includes("NOT_A_TEAM_SITE") ? "site" : "failed" };
  const result = counts.safeParse(data);
  if (!result.success) return { ok: false, error: "failed" };

  revalidatePath("/settings/admin");
  revalidatePath("/session/new");
  return { ok: true, ...result.data, skipped, list };
}

// ── One boulder at a time (team topos only) ────────────────────────────────

export type TopoProblemRow = {
  id: number;
  name: string;
  grade: FontGrade;
  circuit_color: CircuitColor | null;
  circuit_number: string | null;
  steepness: string;
  sit_start: boolean;
  latitude: number | null;
  longitude: number | null;
};

const coord = (min: number, max: number) => z.number().min(min).max(max).nullable();
const problemInput = z.object({
  gymId: z.guid(),
  id: z.number().int().positive().nullable(),
  name: z.string().trim().min(1).max(160),
  grade: z.enum(FONT_SCALE),
  circuitColor: z.enum(CIRCUIT_COLORS).nullable(),
  circuitNumber: z.string().trim().toLowerCase().regex(/^\d{1,3}[a-d]?$/).nullable(),
  steepness: z.enum(["", "slab", "wall", "overhang", "roof", "traverse", "other"]),
  sitStart: z.boolean(),
  latitude: coord(-90, 90),
  longitude: coord(-180, 180),
}).strict();

/** The import's key rule, so a later re-import recognises the boulder. */
function topoKey(color: CircuitColor | null, number: string | null, name: string): string {
  return (color ? `${color}:${number ?? searchable(name)}` : `hc:${searchable(name)}`).slice(0, 200);
}

/** Admin-only: adds (id null) or corrects one boulder of a team topo. */
export async function saveTopoProblem(input: unknown): Promise<ActionResult<TopoProblemRow>> {
  const viewer = await requireViewer();
  if (viewer.role !== "admin") return { ok: false, error: "forbidden" };
  const parsed = problemInput.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const p = parsed.data;
  if (p.circuitColor && !p.circuitNumber) return { ok: false, error: "invalid" };
  if ((p.latitude === null) !== (p.longitude === null)) return { ok: false, error: "position" };
  const number = p.circuitColor ? p.circuitNumber : null;
  const name = p.name.replace(/\s+/g, " ");
  const { data, error } = await viewer.supabase.rpc("admin_save_topo_problem", {
    p_gym_id: p.gymId,
    p_id: p.id as number,
    p_problem: {
      key: topoKey(p.circuitColor, number, name),
      name, name_searchable: searchable(name), grade: p.grade,
      circuit_color: p.circuitColor, circuit_number: number,
      steepness: p.steepness, sit_start: p.sitStart, latitude: p.latitude, longitude: p.longitude,
    },
  });
  if (error) {
    return { ok: false, error: error.code === "23505" ? "duplicate" : error.code === "P0002" ? "notFound" : error.code === "42501" ? "forbidden" : "failed" };
  }
  revalidatePath("/settings/admin", "layout");
  return {
    ok: true,
    data: { id: data as number, name, grade: p.grade, circuit_color: p.circuitColor, circuit_number: number,
      steepness: p.steepness, sit_start: p.sitStart, latitude: p.latitude, longitude: p.longitude },
  };
}

/** Admin-only: deletes one boulder of a team topo; climbers' logs keep their tries. */
export async function deleteTopoProblem(input: unknown): Promise<ActionResult<{ unlinked: number }>> {
  const viewer = await requireViewer();
  if (viewer.role !== "admin") return { ok: false, error: "forbidden" };
  const parsed = z.object({ gymId: z.guid(), id: z.number().int().positive() }).strict().safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { data, error } = await viewer.supabase.rpc("admin_delete_topo_problem", { p_gym_id: parsed.data.gymId, p_id: parsed.data.id });
  if (error) return { ok: false, error: error.code === "P0002" ? "notFound" : error.code === "42501" ? "forbidden" : "failed" };
  revalidatePath("/settings/admin", "layout");
  return { ok: true, data: { unlinked: Number((data as { unlinked?: number } | null)?.unlinked ?? 0) } };
}
