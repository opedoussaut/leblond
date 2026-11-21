"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PROGRESSION_V1, pactTransition } from "@/lib/analytics/alter-ego";
import { RIVAL_LEVELS, RIVAL_PORTRAITS, RIVAL_TONES } from "@/lib/analytics/rival";
import { requireViewer } from "@/lib/auth/viewer";
import { checkUploadedPhoto } from "@/lib/data/uploaded-photo";
import { MEDIA_BUCKET } from "@/lib/media";
import { RIVAL_PHOTO_FOLDER, isOwnPhotoPath } from "@/lib/profile-photo";
import { changePactSchema, pactFromRow, signPactSchema } from "@/lib/training/alter-ego";
import { planSessionSchema } from "@/lib/training/plans";
import { localDate_ } from "@/lib/training/sessions";

type Result = { ok: true; id: string } | { ok: false; error: "invalid" | "grades" | "open_pact" | "not_found" | "unknown" };

function revalidatePact() {
  revalidatePath("/programmes");
  revalidatePath("/rival");
  revalidatePath("/rival/settings");
  revalidatePath("/home");
}

/** Signs a pact from one of the climber's plans. The plan is copied, so editing it later changes nothing. */
export async function signPact(input: unknown): Promise<Result> {
  const viewer = await requireViewer();
  const parsed = signPactSchema.safeParse(input);
  if (!parsed.success) {
    // The two grade rules apply to the whole form, every other rule to one field.
    return { ok: false, error: parsed.error.issues.some((i) => i.path.length === 0) ? "grades" : "invalid" };
  }
  const v = parsed.data;
  const { data: plan } = await viewer.supabase.from("training_plans").select("id, name, sessions").eq("id", v.planId).maybeSingle();
  if (!plan) return { ok: false, error: "not_found" };
  const sessions = z.array(planSessionSchema).min(1).max(14).safeParse(plan.sessions);
  if (!sessions.success) return { ok: false, error: "invalid" };
  const { data, error } = await viewer.supabase.from("alter_ego_pacts").insert({
    user_id: viewer.userId, display_name: v.displayName, plan_id: plan.id, plan_name: plan.name,
    plan_snapshot: sessions.data, progression: PROGRESSION_V1, start_date: v.startDate, horizon_weeks: v.horizonWeeks,
    start_boulder_grade: v.startBoulderGrade, target_boulder_grade: v.targetBoulderGrade,
    start_route_grade: v.startRouteGrade, target_route_grade: v.targetRouteGrade,
  }).select("id").single();
  if (error?.code === "23505") return { ok: false, error: "open_pact" };
  if (error || !data) return { ok: false, error: "unknown" };
  revalidatePact();
  return { ok: true, id: data.id };
}

export async function changePact(input: unknown): Promise<{ ok: boolean }> {
  const viewer = await requireViewer();
  const parsed = changePactSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const { id, action } = parsed.data;
  const { data: row } = await viewer.supabase.from("alter_ego_pacts").select("*").eq("id", id).maybeSingle();
  const pact = row ? pactFromRow(row) : null;
  if (!pact) return { ok: false };
  const update = pactTransition(pact, action, localDate_(new Date()));
  if (!update) return { ok: false };
  const { error } = await viewer.supabase.from("alter_ego_pacts").update(update).eq("id", id).eq("user_id", viewer.userId);
  if (error) return { ok: false };
  revalidatePact();
  return { ok: true };
}

const rivalSettingsSchema = z.object({
  id: z.guid(),
  name: z.string().trim().min(1).max(40),
  portrait: z.enum(RIVAL_PORTRAITS),
  tone: z.enum(RIVAL_TONES),
  level: z.enum(RIVAL_LEVELS),
  chaseProjects: z.boolean(),
  goalDate: z.iso.date().nullable(),
}).strict().refine((v) => v.level !== "GOAL" || v.goalDate !== null, "The goal level needs a date");

/** The rival's name, face, voice and level. The other signed terms (programme, start, duration) never change. */
export async function updateRivalSettings(input: unknown): Promise<{ ok: boolean }> {
  const viewer = await requireViewer();
  const parsed = rivalSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false };
  const v = parsed.data;
  if (v.goalDate && v.goalDate <= localDate_(new Date())) return { ok: false };
  const { data, error } = await viewer.supabase.from("alter_ego_pacts").update({
    display_name: v.name, portrait: v.portrait, tone: v.tone, level: v.level, chase_projects: v.chaseProjects, goal_date: v.goalDate,
  }).eq("id", v.id).eq("user_id", viewer.userId).select("id");
  if (error || !data?.length) return { ok: false };
  revalidatePact();
  return { ok: true };
}

const rivalPhotoSchema = z.object({ id: z.guid(), storagePath: z.string().max(200) }).strict();

/**
 * Gives the rival the photo the browser has just uploaded to "<me>/rival/":
 * checked like the profile photo, then the previous rival photo is deleted.
 */
export async function setRivalPhoto(input: unknown): Promise<{ ok: boolean; error?: string }> {
  const viewer = await requireViewer();
  const parsed = rivalPhotoSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { id, storagePath: path } = parsed.data;
  const check = await checkUploadedPhoto(viewer.supabase, viewer.userId, RIVAL_PHOTO_FOLDER, path);
  if (!check.ok) return check;
  const storage = viewer.supabase.storage.from(MEDIA_BUCKET);
  const { data: row } = await viewer.supabase.from("alter_ego_pacts").select("photo_path").eq("id", id).eq("user_id", viewer.userId).maybeSingle();
  if (!row) {
    await storage.remove([path]);
    return { ok: false, error: "notFound" };
  }
  const { error } = await viewer.supabase.from("alter_ego_pacts").update({ photo_path: path }).eq("id", id).eq("user_id", viewer.userId);
  if (error) {
    await storage.remove([path]);
    return { ok: false, error: "unknownError" };
  }
  if (row.photo_path !== path && isOwnPhotoPath(viewer.userId, RIVAL_PHOTO_FOLDER, row.photo_path)) await storage.remove([row.photo_path]);
  revalidatePact();
  return { ok: true };
}

/** Removes the rival's photo: its drawn portrait is shown again. */
export async function removeRivalPhoto(input: unknown): Promise<{ ok: boolean }> {
  const viewer = await requireViewer();
  const parsed = z.object({ id: z.guid() }).strict().safeParse(input);
  if (!parsed.success) return { ok: false };
  const { data: row } = await viewer.supabase.from("alter_ego_pacts").select("photo_path").eq("id", parsed.data.id).eq("user_id", viewer.userId).maybeSingle();
  if (!row) return { ok: false };
  const { error } = await viewer.supabase.from("alter_ego_pacts").update({ photo_path: null }).eq("id", parsed.data.id).eq("user_id", viewer.userId);
  if (error) return { ok: false };
  if (isOwnPhotoPath(viewer.userId, RIVAL_PHOTO_FOLDER, row.photo_path)) await viewer.supabase.storage.from(MEDIA_BUCKET).remove([row.photo_path]);
  revalidatePact();
  return { ok: true };
}
