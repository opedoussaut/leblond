"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { completesProject, isFirstGoOnly, logRouteAscentSchema, routeKey } from "@/lib/climbing/routes";
import type { Tables } from "@/lib/supabase/database.types";
import type { GradeSystem } from "@/lib/climbing/types";
import { isValidGrade } from "@/lib/grading";
import { isColourSystem } from "@/lib/grading/conversions";
import type { ActionResult } from "@/lib/validation/common";

export type RouteAscentRow = Pick<Tables<"route_ascents">,
  "id" | "session_id" | "client_id" | "route_name" | "grade" | "style" | "result" | "falls" | "wall_angle" | "created_at" | "route_project_id" | "native_grade" | "native_grade_system" | "tries" | "notes">;
const COLUMNS = "id,session_id,client_id,route_name,grade,style,result,falls,wall_angle,created_at,route_project_id,native_grade,native_grade_system,tries,notes";

export type RouteLogResult = { rows: RouteAscentRow[]; projectSent: boolean; project: { id: string; route_name: string } | null };

/**
 * Logs one or several identical route lines (same grade, style, result, tries and
 * comment) in a ROUTE session. Idempotent per client id: a retried tap returns the
 * lines already stored instead of duplicating them.
 */
export async function logRouteAscent(input: unknown): Promise<ActionResult<RouteLogResult>> {
  const viewer = await requireViewer();
  const parsed = logRouteAscentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;

  const clientIds = [v.clientId, ...v.extraClientIds];
  const { data: existing } = await viewer.supabase.from("route_ascents").select(COLUMNS).in("client_id", clientIds);
  if (existing && existing.length === clientIds.length) {
    return { ok: true, data: { rows: existing as RouteAscentRow[], projectSent: false, project: null } };
  }

  const { data: session } = await viewer.supabase.from("sessions").select("id, gym_id, discipline, started_at, ended_at, gyms(grading_system, route_grading)")
    .eq("id", v.sessionId).maybeSingle();
  if (!session || session.discipline !== "ROUTE") return { ok: false, error: "notFound" };

  // Native colour: only at gyms that grade by colour, and only one of that gym's colours.
  // Only gyms that grade their ROUTES by colour accept a native colour; others use French grades directly.
  const gymSystem = (session.gyms?.route_grading === "GYM_COLOR" ? session.gyms.grading_system : "FONT") as GradeSystem;
  const nativeGrade = v.nativeGrade ?? null;
  if (nativeGrade && (!isColourSystem(gymSystem) || !isValidGrade(gymSystem, nativeGrade))) return { ok: false, error: "invalidGrade" };

  // A finished session (added afterwards or being edited): date the ascent inside it.
  let createdAt: string | undefined;
  if (session.ended_at) {
    const { count } = await viewer.supabase.from("route_ascents").select("id", { count: "exact", head: true }).eq("session_id", session.id);
    const at = Math.min(new Date(session.ended_at).getTime(), new Date(session.started_at).getTime() + ((count ?? 0) + 1) * 1000);
    createdAt = new Date(at).toISOString();
  }

  // A project chosen in the logger, or an active project at this venue with the same name.
  let name = v.routeName.trim();
  let project: { id: string; route_name: string; goal_style: "LEAD" | "TOPROPE" | "AUTOBELAY"; status: string } | null = null;
  if (v.routeProjectId) {
    const { data: p } = await viewer.supabase.from("route_projects").select("id, route_name, goal_style, status, gym_id")
      .eq("id", v.routeProjectId).maybeSingle();
    if (!p || p.gym_id !== session.gym_id) return { ok: false, error: "invalid" };
    project = p;
    name = name || p.route_name;
  } else if (name) {
    const { data: p } = await viewer.supabase.from("route_projects").select("id, route_name, goal_style, status")
      .eq("gym_id", session.gym_id).eq("route_key", routeKey(name)).maybeSingle();
    project = p ?? null;
  }
  if (project && isFirstGoOnly(v.result)) return { ok: false, error: "notFirstAscent" };

  // "★ Projet": keep this route as a project (created from its name, or "Projet <grade>").
  let createdProject: { id: string; route_name: string } | null = null;
  if (v.asProject && !project) {
    let projectName = name;
    if (!projectName) {
      const { data: others } = await viewer.supabase.from("route_projects").select("route_key").eq("gym_id", session.gym_id);
      const taken = new Set((others ?? []).map((o) => o.route_key));
      let n = 1;
      do { projectName = `Projet ${v.grade}${n > 1 ? ` (${n})` : ""}`; n++; } while (taken.has(routeKey(projectName)));
    }
    const { data: p, error: pError } = await viewer.supabase.from("route_projects").insert({
      user_id: viewer.userId, gym_id: session.gym_id, route_name: projectName, route_key: routeKey(projectName),
      grade: v.grade, goal_style: "LEAD", notes: v.notes,
    }).select("id, route_name, goal_style, status").single();
    if (pError || !p) return { ok: false, error: "unknownError" };
    project = p;
    createdProject = { id: p.id, route_name: p.route_name };
    name = p.route_name;
    revalidatePath("/projects");
  }

  // Onsight / flash are only possible on the first ascent of a named route at this venue.
  if (name && isFirstGoOnly(v.result)) {
    const { data: sameVenue } = await viewer.supabase.from("sessions").select("id").eq("gym_id", session.gym_id).eq("discipline", "ROUTE");
    const ids = (sameVenue ?? []).map((s) => s.id);
    const { data: previous } = ids.length
      ? await viewer.supabase.from("route_ascents").select("route_name").in("session_id", ids).not("route_name", "is", null)
      : { data: [] as { route_name: string | null }[] };
    if ((previous ?? []).some((p) => p.route_name && routeKey(p.route_name) === routeKey(name))) {
      return { ok: false, error: "notFirstAscent" };
    }
  }

  const already = new Set((existing ?? []).map((e) => e.client_id));
  const rows = clientIds.filter((c) => !already.has(c)).map((clientId, i) => ({
    user_id: viewer.userId, session_id: v.sessionId, client_id: clientId, route_name: name || null,
    grade: v.grade, style: v.style, result: v.result, falls: v.result === "ATTEMPT" || v.result === "TOP_WITH_REST" ? v.falls : 0,
    wall_angle: v.wallAngle, route_project_id: project?.id ?? null, tries: v.tries, notes: v.notes,
    native_grade: nativeGrade, native_grade_system: nativeGrade ? gymSystem : null,
    ...(createdAt ? { created_at: new Date(new Date(createdAt).getTime() + i * 1000).toISOString() } : {}),
  }));
  const { data: inserted, error } = await viewer.supabase.from("route_ascents").insert(rows).select(COLUMNS);
  if (error?.code === "23505") {
    const { data: again } = await viewer.supabase.from("route_ascents").select(COLUMNS).in("client_id", clientIds);
    if (again?.length) return { ok: true, data: { rows: again as RouteAscentRow[], projectSent: false, project: createdProject } };
  }
  if (error || !inserted?.length) return { ok: false, error: "unknownError" };
  const data = inserted[inserted.length - 1];
  let projectSent = false;
  if (project && project.status === "ACTIVE" && completesProject(v.result, v.style, project.goal_style)) {
    const { error: sentError } = await viewer.supabase.from("route_projects")
      .update({ status: "SENT", sent_at: data.created_at }).eq("id", project.id).eq("status", "ACTIVE");
    projectSent = !sentError;
    revalidatePath("/projects");
  }
  revalidatePath("/session/" + v.sessionId);
  return { ok: true, data: { rows: [...(existing ?? []), ...inserted] as RouteAscentRow[], projectSent, project: createdProject } };
}

/** Edit the comment (and tries) of a logged route line. */
export async function updateRouteAscent(input: unknown): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = z.object({ id: z.guid(), notes: z.string().trim().max(500), tries: z.number().int().min(1).max(100).optional() })
    .strict().safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { id, notes, tries } = parsed.data;
  const { data, error } = await viewer.supabase.from("route_ascents")
    .update({ notes, ...(tries ? { tries } : {}) }).eq("id", id).select("session_id").maybeSingle();
  if (error || !data) return { ok: false, error: error?.code === "23514" ? "notFirstAscent" : "unknownError" };
  revalidatePath("/session/" + data.session_id);
  return { ok: true };
}

export async function deleteRouteAscent(ascentId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!z.guid().safeParse(ascentId).success) return { ok: false, error: "invalid" };
  const { data, error } = await viewer.supabase.from("route_ascents").delete().eq("id", ascentId).select("session_id").maybeSingle();
  if (error) return { ok: false, error: "unknownError" };
  if (data) revalidatePath("/session/" + data.session_id);
  return { ok: true };
}
