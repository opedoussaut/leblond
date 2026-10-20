"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer, type Viewer } from "@/lib/auth/viewer";
import { completesProject, createRouteProjectSchema, routeKey, updateRouteProjectSchema } from "@/lib/climbing/routes";
import type { ActionResult } from "@/lib/validation/common";

function revalidateProjects(id?: string) {
  revalidatePath("/projects");
  if (id) revalidatePath("/projects/routes/" + id);
}

/** Ascents of a named route at a venue (accent/case-insensitive), oldest first. */
async function ascentsOfNamedRoute(viewer: Viewer, gymId: string, key: string) {
  const { data: sessions } = await viewer.supabase.from("sessions").select("id").eq("gym_id", gymId).eq("discipline", "ROUTE");
  const ids = (sessions ?? []).map((s) => s.id);
  if (!ids.length) return [];
  const { data } = await viewer.supabase.from("route_ascents")
    .select("id, route_name, result, style, created_at, route_project_id")
    .in("session_id", ids).not("route_name", "is", null).order("created_at");
  return (data ?? []).filter((a) => a.route_name && routeKey(a.route_name) === key);
}

/**
 * Starts a route project. Earlier ascents of the same named route at that
 * venue are attached to it, so the history is complete from day one; if one
 * of them already completed the goal, the project starts as sent.
 */
export async function createRouteProject(input: unknown): Promise<ActionResult<{ id: string }>> {
  const viewer = await requireViewer();
  const parsed = createRouteProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const { data: gym } = await viewer.supabase.from("gyms").select("has_routes").eq("id", v.gymId).maybeSingle();
  if (!gym?.has_routes) return { ok: false, error: "invalid" };
  const key = routeKey(v.routeName);
  const { data: existing } = await viewer.supabase.from("route_projects").select("id")
    .eq("gym_id", v.gymId).eq("route_key", key).maybeSingle();
  if (existing) return { ok: true, data: { id: existing.id } };

  const { data, error } = await viewer.supabase.from("route_projects").insert({
    user_id: viewer.userId, gym_id: v.gymId, route_name: v.routeName, route_key: key,
    grade: v.grade, goal_style: v.goalStyle, notes: v.notes,
  }).select("id").single();
  if (error || !data) return { ok: false, error: "unknownError" };

  const past = (await ascentsOfNamedRoute(viewer, v.gymId, key)).filter((a) => !a.route_project_id);
  if (past.length) {
    await viewer.supabase.from("route_ascents").update({ route_project_id: data.id }).in("id", past.map((a) => a.id));
    const done = past.find((a) => completesProject(a.result, a.style, v.goalStyle));
    if (done) await viewer.supabase.from("route_projects").update({ status: "SENT", sent_at: done.created_at }).eq("id", data.id);
  }
  revalidateProjects(data.id);
  return { ok: true, data: { id: data.id } };
}

export async function updateRouteProject(input: unknown): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = updateRouteProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const { data: current } = await viewer.supabase.from("route_projects").select("status, sent_at").eq("id", v.id).maybeSingle();
  if (!current) return { ok: false, error: "notFound" };
  const sentAt = v.status === "SENT" ? (current.sent_at ?? new Date().toISOString()) : null;
  const { error } = await viewer.supabase.from("route_projects")
    .update({ grade: v.grade, goal_style: v.goalStyle, status: v.status, notes: v.notes, sent_at: sentAt }).eq("id", v.id);
  if (error) return { ok: false, error: "unknownError" };
  revalidateProjects(v.id);
  return { ok: true };
}

export async function deleteRouteProject(id: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!z.guid().safeParse(id).success) return { ok: false, error: "invalid" };
  const { error } = await viewer.supabase.from("route_projects").delete().eq("id", id);
  if (error) return { ok: false, error: "unknownError" };
  revalidateProjects();
  return { ok: true };
}
