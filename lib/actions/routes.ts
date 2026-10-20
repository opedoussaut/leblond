"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { completesProject, isFirstGoOnly, logRouteAscentSchema, routeKey } from "@/lib/climbing/routes";
import type { Tables } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/validation/common";

export type RouteAscentRow = Pick<Tables<"route_ascents">,
  "id" | "session_id" | "client_id" | "route_name" | "grade" | "style" | "result" | "falls" | "wall_angle" | "created_at" | "route_project_id">;
const COLUMNS = "id,session_id,client_id,route_name,grade,style,result,falls,wall_angle,created_at,route_project_id";

/**
 * Logs one climb of a route in a live ROUTE session. Idempotent per client_id:
 * a retried tap returns the ascent already stored instead of duplicating it.
 */
export async function logRouteAscent(input: unknown): Promise<ActionResult<RouteAscentRow & { projectSent?: boolean }>> {
  const viewer = await requireViewer();
  const parsed = logRouteAscentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;

  const { data: existing } = await viewer.supabase.from("route_ascents").select(COLUMNS).eq("client_id", v.clientId).maybeSingle();
  if (existing) return { ok: true, data: existing as RouteAscentRow };

  const { data: session } = await viewer.supabase.from("sessions").select("id, gym_id, discipline, ended_at")
    .eq("id", v.sessionId).maybeSingle();
  if (!session || session.discipline !== "ROUTE") return { ok: false, error: "notFound" };
  if (session.ended_at) return { ok: false, error: "invalid" };

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

  const { data, error } = await viewer.supabase.from("route_ascents").insert({
    user_id: viewer.userId, session_id: v.sessionId, client_id: v.clientId, route_name: name || null,
    grade: v.grade, style: v.style, result: v.result, falls: v.result === "ATTEMPT" || v.result === "TOP_WITH_REST" ? v.falls : 0,
    wall_angle: v.wallAngle, route_project_id: project?.id ?? null,
  }).select(COLUMNS).single();
  if (error?.code === "23505") {
    const { data: again } = await viewer.supabase.from("route_ascents").select(COLUMNS).eq("client_id", v.clientId).maybeSingle();
    if (again) return { ok: true, data: again as RouteAscentRow };
  }
  if (error || !data) return { ok: false, error: "unknownError" };
  let projectSent = false;
  if (project && project.status === "ACTIVE" && completesProject(v.result, v.style, project.goal_style)) {
    const { error: sentError } = await viewer.supabase.from("route_projects")
      .update({ status: "SENT", sent_at: data.created_at }).eq("id", project.id).eq("status", "ACTIVE");
    projectSent = !sentError;
    revalidatePath("/projects");
  }
  revalidatePath("/session/" + v.sessionId);
  return { ok: true, data: { ...(data as RouteAscentRow), projectSent } };
}

export async function deleteRouteAscent(ascentId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!z.guid().safeParse(ascentId).success) return { ok: false, error: "invalid" };
  const { data, error } = await viewer.supabase.from("route_ascents").delete().eq("id", ascentId).select("session_id").maybeSingle();
  if (error) return { ok: false, error: "unknownError" };
  if (data) revalidatePath("/session/" + data.session_id);
  return { ok: true };
}
