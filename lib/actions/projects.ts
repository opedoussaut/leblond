"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { createOutdoorBoulderProjectSchema, orNull } from "@/lib/climbing/outdoor-projects";
import { PROJECT_STATUSES } from "@/lib/climbing/types";
import { resolveOutdoorSite } from "@/lib/data/outdoor-sites";
import { searchable } from "@/lib/integrations/outdoor/boolder";
import type { Tables } from "@/lib/supabase/database.types";
import { pickOutdoorProblem } from "./outdoor";
import type { ActionResult } from "@/lib/validation/common";

export async function createProject(problemId: string): Promise<void> {
  const viewer = await requireViewer();
  if (!z.guid().safeParse(problemId).success) return;
  const { data: existing } = await viewer.supabase.from("projects").select("id").eq("problem_id", problemId).maybeSingle();
  if (existing) redirect(`/projects/${existing.id}`);
  const { data, error } = await viewer.supabase
    .from("projects")
    .insert({ problem_id: problemId, user_id: viewer.userId })
    .select("id")
    .single();
  if (error || !data) return;
  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

const updateSchema = z.object({
  status: z.enum(PROJECT_STATUSES),
  notes: z.string().max(4000).nullable(),
});

export async function updateProject(projectId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = updateSchema.safeParse({
    status: formData.get("status"),
    notes: (formData.get("notes") as string | null)?.trim() || null,
  });
  if (!z.guid().safeParse(projectId).success || !parsed.success) return { ok: false, error: "invalid" };
  const { status, notes } = parsed.data;
  const { error } = await viewer.supabase
    .from("projects")
    .update({ status, notes, completed_at: status === "ACTIVE" ? null : new Date().toISOString() })
    .eq("id", projectId);
  if (error) return { ok: false, error: "unknownError" };
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { ok: true };
}

/* ───────────── Outdoor boulder projects ───────────── */

/**
 * Starts a boulder project outdoors, without a session: at an existing outdoor
 * site or a new one, on a boulder picked from the site's topo (the climber's
 * own problem for it is reused) or typed by hand, with its native Font grade,
 * sector, angle, beta and topo citation. An existing project on that boulder is
 * reused (one project per boulder).
 */
export async function createOutdoorBoulderProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  const viewer = await requireViewer();
  const parsed = createOutdoorBoulderProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const site = await resolveOutdoorSite(viewer, v.site, "BOULDER");
  if (!site.ok) return site;

  const details = {
    wall_zone: orNull(v.sector), wall_angle: v.wallAngle,
    beta: orNull(v.beta), topo_ref: orNull(v.topoRef), topo_url: orNull(v.topoUrl),
  };
  let problemId: string;
  if (v.outdoorProblemId !== null) {
    const picked = await pickOutdoorProblem({ gymId: site.gymId, outdoorProblemId: v.outdoorProblemId });
    if (!picked.ok || !picked.data) return { ok: false, error: picked.ok ? "unknownError" : picked.error };
    problemId = picked.data.id;
    // The climber's grade and details win over the topo's; empty fields keep what was there.
    const patch: Partial<Tables<"problems">> = { native_grade: v.grade };
    if (v.name) patch.name = v.name;
    if (v.wallAngle !== "UNKNOWN") patch.wall_angle = v.wallAngle;
    for (const k of ["wall_zone", "beta", "topo_ref", "topo_url"] as const) if (details[k]) patch[k] = details[k];
    const { error } = await viewer.supabase.from("problems").update(patch).eq("id", problemId);
    if (error) return { ok: false, error: "unknownError" };
  } else {
    const { data, error } = await viewer.supabase.from("problems").insert({
      gym_id: site.gymId, created_by: viewer.userId, name: v.name,
      native_grade: v.grade, native_grade_system: "FONT", ...details,
    }).select("id").single();
    if (error || !data) return { ok: false, error: "unknownError" };
    problemId = data.id;
  }

  const { data: existing } = await viewer.supabase.from("projects").select("id").eq("problem_id", problemId).maybeSingle();
  let projectId = existing?.id;
  if (!projectId) {
    const { data, error } = await viewer.supabase.from("projects")
      .insert({ problem_id: problemId, user_id: viewer.userId, notes: orNull(v.notes) }).select("id").single();
    if (error || !data) return { ok: false, error: "unknownError" };
    projectId = data.id;
  }
  revalidatePath("/projects");
  return { ok: true, data: { id: projectId } };
}

export interface TopoBoulderHit {
  id: number;
  name: string;
  grade: string;
  circuit_color: string | null;
  circuit_number: string | null;
}

/** Boulders of an outdoor site's topo matching a name (accent/case-insensitive), for the project form. */
export async function searchTopoBoulders(gymId: string, query: string): Promise<TopoBoulderHit[]> {
  const viewer = await requireViewer();
  const q = searchable(String(query ?? "")).slice(0, 60);
  if (!z.guid().safeParse(gymId).success || q.length < 2) return [];
  const { data: area } = await viewer.supabase.from("outdoor_areas").select("id").eq("gym_id", gymId).maybeSingle();
  if (!area) return [];
  const { data } = await viewer.supabase.from("outdoor_problems")
    .select("id, name, grade, circuit_color, circuit_number")
    .eq("area_id", area.id).ilike("name_searchable", `%${q}%`).order("popularity", { ascending: false, nullsFirst: false }).limit(15);
  return data ?? [];
}
