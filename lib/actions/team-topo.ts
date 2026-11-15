"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { KmzError, kmlText } from "@/lib/integrations/outdoor/kmz";
import { CIRCUIT_COLORS, searchable, type CircuitColor } from "@/lib/integrations/outdoor/boolder";
import { buildTeamTopo, parseKml, type SkipReason } from "@/lib/integrations/outdoor/mymaps";
import { circuitsOf, mergeTopoList, parseTopoList, type ListedProblem, type MergeReport } from "@/lib/integrations/outdoor/topo-list";
import { impactToken, topoImpact, type CurrentTopoRow } from "@/lib/integrations/outdoor/topo-impact";
import { FONT_SCALE, type FontGrade } from "@/lib/grading/systems";
import type { ActionResult } from "@/lib/validation/common";

/** Below Next's 1 MB server-action body limit, with room for the form fields. */
const MAX_UPLOAD_BYTES = 900 * 1024;
/** A pasted list: a few hundred lines per site. */
const MAX_LIST_CHARS = 200_000;

export type TopoImportError =
  | "forbidden" | "site" | "noFile" | "tooLarge" | "notKml" | "linkOnly" | "empty" | "emptyList" | "noTopoYet" | "elsewhere" | "failed";

/** Names shown when the admin is asked to confirm; the rest is counted. */
const MAX_REMOVED_NAMES = 60;

export type TopoImportState =
  | null
  | { ok: false; error: TopoImportError; site?: string; km?: number; mapName?: string | null }
  | {
      /** Nothing was written: the import would remove boulders, the admin has to confirm it. */
      ok: true;
      step: "confirm";
      token: string;
      site: string;
      mapName: string | null;
      problems: number;
      current: number;
      kept: number;
      added: number;
      removed: number;
      removedNames: string[];
      unlinked: number;
    }
  | {
      ok: true;
      step: "done";
      problems: number;
      circuits: number;
      added: number;
      updated: number;
      removed: number;
      unlinked: number;
      /** Climbers' boulders that found their topo boulder again. */
      relinked: number;
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
  relinked: z.number().int().default(0),
});

type Supabase = Awaited<ReturnType<typeof requireViewer>>["supabase"];
type CurrentRow = CurrentTopoRow & Pick<ListedProblem, "name_searchable" | "grade" | "circuit_color" | "circuit_number">;

/** The site's current team topo, every boulder (the API returns 1000 rows at a time). */
async function currentTopo(supabase: Supabase, gymId: string): Promise<CurrentRow[] | null> {
  const rows: CurrentRow[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("outdoor_problems")
      .select("id, source_key, name, name_searchable, grade, circuit_color, circuit_number, latitude, longitude, outdoor_areas!inner(gym_id)")
      .eq("source", "LEBLOND")
      .eq("outdoor_areas.gym_id", gymId)
      .order("id")
      .range(from, from + 999);
    if (error) return null;
    for (const p of data ?? []) {
      if (!p.source_key) continue;
      rows.push({
        id: p.id, key: p.source_key, name: p.name, name_searchable: p.name_searchable, grade: p.grade as FontGrade,
        circuit_color: p.circuit_color as CircuitColor | null, circuit_number: p.circuit_number, latitude: p.latitude, longitude: p.longitude,
      });
    }
    if ((data ?? []).length < 1000) return rows;
  }
}

/**
 * Admin-only: imports a topo drawn in Google My Maps (KMZ/KML export), and/or
 * the written list of its circuits and boulders (see topo-list.ts), into an
 * outdoor site outside the Boolder catalogue. The file is read here and never
 * stored; only the boulders reach the database, through
 * admin_import_leblond_topo() in the admin's own session.
 *
 * The import replaces the site's topo, so it is checked first (topo-impact.ts):
 * a file whose boulders stand kilometres away is another site's topo and is
 * refused; an import that removes boulders is only described, and runs when
 * the admin sends it again with the confirmation of that exact change.
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

  const { data: gym } = await viewer.supabase.from("gyms").select("name").eq("id", gymId.data).maybeSingle();
  if (!gym) return { ok: false, error: "site" };
  const current = await currentTopo(viewer.supabase, gymId.data);
  if (!current) return { ok: false, error: "failed" };

  // Positions: the uploaded My Maps export, or else the site's current topo.
  let pins: ListedProblem[];
  let mapName: string | null = null;
  let skipped: Array<{ name: string; folder: string | null; reason: SkipReason }> = [];
  if (hasFile) {
    if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "tooLarge" };
    try {
      const doc = parseKml(kmlText(new Uint8Array(await file.arrayBuffer())));
      if (doc.networkLinkOnly) return { ok: false, error: "linkOnly" };
      const topo = buildTeamTopo(doc);
      mapName = topo.name;
      pins = topo.problems;
      skipped = topo.skipped;
    } catch (e) {
      return { ok: false, error: e instanceof KmzError ? e.code : "notKml" };
    }
    if (pins.length === 0) return { ok: false, error: "empty" };
  } else {
    pins = current.map(({ key, name, name_searchable, grade, circuit_color, circuit_number, latitude, longitude }) => ({
      key, name, name_searchable, grade, circuit_color, circuit_number, latitude, longitude,
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

  // Before anything is written: is this the site's topo, and what would it remove?
  let linked = new Map<number, number>();
  if (current.length > 0) {
    const { data: links, error: linksError } = await viewer.supabase.rpc("admin_topo_link_counts", { p_gym_id: gymId.data });
    if (linksError) return { ok: false, error: "failed" };
    linked = new Map((links ?? []).map((l) => [l.outdoor_problem_id, l.logged]));
  }
  const impact = topoImpact(current, problems, linked);
  if (impact.elsewhere) {
    return { ok: false, error: "elsewhere", site: gym.name, km: Math.round(impact.shiftKm ?? 0), mapName };
  }
  if (impact.removed.length > 0) {
    const token = impactToken(gymId.data, problems.map((p) => p.key), impact.removed.map((r) => r.id));
    if (formData.get("confirm") !== token) {
      return {
        ok: true, step: "confirm", token, site: gym.name, mapName,
        problems: problems.length, current: impact.current, kept: impact.kept, added: impact.added,
        removed: impact.removed.length, removedNames: impact.removed.slice(0, MAX_REMOVED_NAMES).map((r) => r.name),
        unlinked: impact.unlinked,
      };
    }
  }

  const creditField = z.string().trim().max(200).safeParse(formData.get("credit") ?? "");
  const credit = creditField.success && creditField.data ? creditField.data : null;
  const { data, error } = await viewer.supabase.rpc("admin_import_leblond_topo", {
    p_gym_id: gymId.data,
    p_topo: { credit, circuits: circuitsOf(problems), problems, skipped: skipped.length },
  });
  if (error) {
    if (error.message.includes("TOPO_ELSEWHERE")) return { ok: false, error: "elsewhere", site: gym.name, mapName };
    return { ok: false, error: error.message.includes("NOT_A_TEAM_SITE") ? "site" : "failed" };
  }
  const result = counts.safeParse(data);
  if (!result.success) return { ok: false, error: "failed" };

  revalidatePath("/settings/admin");
  revalidatePath("/session/new");
  return { ok: true, step: "done", ...result.data, skipped, list };
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
