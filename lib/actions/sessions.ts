"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { ATTEMPT_RESULTS, isSend, STYLE_TAGS, WALL_ANGLES, type GradeSystem } from "@/lib/climbing/types";
import { isValidGrade } from "@/lib/grading";
import type { Tables } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/validation/common";

const id = z.guid();

/* ───────────── Sessions ───────────── */

export async function startSession(gymId: string): Promise<ActionResult<{ sessionId: string }>> {
  const viewer = await requireViewer();
  if (!id.safeParse(gymId).success) return { ok: false, error: "invalid" };
  const { data, error } = await viewer.supabase
    .from("sessions")
    .insert({ gym_id: gymId, user_id: viewer.userId, source: "MANUAL" })
    .select("id")
    .single();
  if (error) {
    // One live session per climber: resume it instead.
    if (error.code === "23505") {
      const { data: live } = await viewer.supabase.from("sessions").select("id").is("ended_at", null).maybeSingle();
      if (live) return { ok: true, data: { sessionId: live.id } };
    }
    return { ok: false, error: "unknownError" };
  }
  await viewer.supabase.from("favourite_gyms").upsert({ user_id: viewer.userId, gym_id: gymId });
  revalidatePath("/", "layout");
  return { ok: true, data: { sessionId: data.id } };
}

export async function endSession(sessionId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!id.safeParse(sessionId).success) return { ok: false, error: "invalid" };
  const { data: s } = await viewer.supabase.from("sessions").select("started_at, ended_at").eq("id", sessionId).single();
  if (!s) return { ok: false, error: "notFound" };
  if (s.ended_at) return { ok: true };
  const end = new Date();
  const minutes = Math.max(0, Math.round((end.getTime() - new Date(s.started_at).getTime()) / 60_000));
  const { error } = await viewer.supabase
    .from("sessions")
    .update({ ended_at: end.toISOString(), duration_minutes: Math.min(minutes, 1440) })
    .eq("id", sessionId);
  if (error) return { ok: false, error: "unknownError" };
  revalidatePath("/", "layout");
  return { ok: true };
}

const scale = z.coerce.number().int().min(1).max(5).nullable();
const feelingsSchema = z.object({
  notes: z.string().max(4000).nullable(),
  perceivedEnergyBefore: scale,
  perceivedEnergyAfter: scale,
  fatigue: scale,
  motivation: scale,
});

const blankToNull = (v: FormDataEntryValue | null) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);

export async function updateSessionDetails(sessionId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = feelingsSchema.safeParse({
    notes: blankToNull(formData.get("notes")),
    perceivedEnergyBefore: blankToNull(formData.get("perceivedEnergyBefore")),
    perceivedEnergyAfter: blankToNull(formData.get("perceivedEnergyAfter")),
    fatigue: blankToNull(formData.get("fatigue")),
    motivation: blankToNull(formData.get("motivation")),
  });
  if (!id.safeParse(sessionId).success || !parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const { error } = await viewer.supabase
    .from("sessions")
    .update({
      notes: v.notes,
      perceived_energy_before: v.perceivedEnergyBefore,
      perceived_energy_after: v.perceivedEnergyAfter,
      fatigue: v.fatigue,
      motivation: v.motivation,
    })
    .eq("id", sessionId);
  if (error) return { ok: false, error: "unknownError" };
  revalidatePath(`/session/${sessionId}`);
  return { ok: true };
}

export async function deleteSession(sessionId: string): Promise<void> {
  const viewer = await requireViewer();
  if (!id.safeParse(sessionId).success) return;
  await viewer.supabase.from("sessions").delete().eq("id", sessionId);
  revalidatePath("/", "layout");
  redirect("/session");
}

/* ───────────── Problems ───────────── */

const createProblemSchema = z.object({
  gymId: id,
  nativeGrade: z.string().min(1).max(10),
  wallAngle: z.enum(WALL_ANGLES).optional(),
});

export type LiveProblem = Tables<"problems"> & { tags: string[] };

export async function createProblem(input: z.input<typeof createProblemSchema>): Promise<ActionResult<LiveProblem>> {
  const viewer = await requireViewer();
  const parsed = createProblemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { data: gym } = await viewer.supabase.from("gyms").select("grading_system").eq("id", parsed.data.gymId).single();
  if (!gym) return { ok: false, error: "notFound" };
  const system = gym.grading_system as GradeSystem;
  if (!isValidGrade(system, parsed.data.nativeGrade)) return { ok: false, error: "invalidGrade" };

  const { data, error } = await viewer.supabase
    .from("problems")
    .insert({
      gym_id: parsed.data.gymId,
      created_by: viewer.userId,
      native_grade: parsed.data.nativeGrade,
      native_grade_system: system,
      // Native Font grades are their own normalised grade: no separate estimate stored.
      wall_angle: parsed.data.wallAngle ?? "UNKNOWN",
    })
    .select()
    .single();
  if (error) return { ok: false, error: "unknownError" };
  return { ok: true, data: { ...data, tags: [] } };
}

const updateProblemSchema = z.object({
  problemId: id,
  name: z.string().trim().max(120).nullable().optional(),
  wallAngle: z.enum(WALL_ANGLES).optional(),
  wallZone: z.string().trim().max(80).nullable().optional(),
  setter: z.string().trim().max(80).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
  tags: z.array(z.enum(STYLE_TAGS)).max(12).optional(),
  // Optional Font estimate for colour-graded problems. null clears it.
  estimate: z
    .object({ grade: z.string().max(4), confidence: z.number().min(0).max(1) })
    .nullable()
    .optional(),
});

export async function updateProblem(input: z.input<typeof updateProblemSchema>): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = updateProblemSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const { data: problem } = await viewer.supabase
    .from("problems")
    .select("native_grade_system")
    .eq("id", v.problemId)
    .single();
  if (!problem) return { ok: false, error: "notFound" };

  const patch: Partial<Tables<"problems">> = {};
  if (v.name !== undefined) patch.name = v.name || null;
  if (v.wallAngle !== undefined) patch.wall_angle = v.wallAngle;
  if (v.wallZone !== undefined) patch.wall_zone = v.wallZone || null;
  if (v.setter !== undefined) patch.setter = v.setter || null;
  if (v.notes !== undefined) patch.notes = v.notes || null;
  if (v.estimate !== undefined) {
    if (problem.native_grade_system === "FONT") return { ok: false, error: "invalid" };
    if (v.estimate === null) {
      Object.assign(patch, {
        normalized_grade: null,
        normalized_grade_system: null,
        normalization_confidence: null,
        normalization_source: null,
      });
    } else {
      if (!isValidGrade("FONT", v.estimate.grade)) return { ok: false, error: "invalidGrade" };
      Object.assign(patch, {
        normalized_grade: v.estimate.grade,
        normalized_grade_system: "FONT",
        normalization_confidence: Math.round(v.estimate.confidence * 100) / 100,
        normalization_source: "USER_ESTIMATE",
      });
    }
  }
  if (Object.keys(patch).length) {
    const { error } = await viewer.supabase.from("problems").update(patch).eq("id", v.problemId);
    if (error) return { ok: false, error: "unknownError" };
  }
  if (v.tags) {
    const { data: tagRows } = await viewer.supabase.from("tags").select("id, slug").in("slug", v.tags);
    await viewer.supabase.from("problem_tags").delete().eq("problem_id", v.problemId);
    if (tagRows?.length) {
      const { error } = await viewer.supabase
        .from("problem_tags")
        .insert(tagRows.map((t) => ({ problem_id: v.problemId, tag_id: t.id })));
      if (error) return { ok: false, error: "unknownError" };
    }
  }
  revalidatePath(`/problem/${v.problemId}`);
  return { ok: true };
}

export async function deleteProblem(problemId: string): Promise<void> {
  const viewer = await requireViewer();
  if (!id.safeParse(problemId).success) return;
  const { data: media } = await viewer.supabase.from("media").select("storage_path").eq("problem_id", problemId);
  if (media?.length) await viewer.supabase.storage.from("media").remove(media.map((m) => m.storage_path));
  await viewer.supabase.from("problems").delete().eq("id", problemId);
  revalidatePath("/", "layout");
  redirect("/session");
}

/* ───────────── Attempts ───────────── */

const logSchema = z.object({ sessionId: id, problemId: id, result: z.enum(ATTEMPT_RESULTS) });

export async function logAttempt(
  input: z.input<typeof logSchema>,
): Promise<ActionResult<{ attempt: Tables<"attempts">; suggestFlash: boolean }>> {
  const viewer = await requireViewer();
  const parsed = logSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { data, error } = await viewer.supabase.rpc("log_attempt", {
    p_session_id: parsed.data.sessionId,
    p_problem_id: parsed.data.problemId,
    p_result: parsed.data.result,
  });
  if (error || !data) {
    return { ok: false, error: error?.message === "FLASH_NOT_FIRST_ATTEMPT" ? "flashOnlyFirst" : "unknownError" };
  }
  // A send closes an active project on that problem.
  if (isSend(data.result)) {
    await viewer.supabase
      .from("projects")
      .update({ status: "SENT", completed_at: data.created_at })
      .eq("problem_id", data.problem_id)
      .eq("status", "ACTIVE");
  }
  return { ok: true, data: { attempt: data, suggestFlash: data.result === "TOP" && data.attempt_number === 1 } };
}

const correctSchema = z.object({ attemptId: id, result: z.enum(ATTEMPT_RESULTS) });

/** Re-classify an attempt (e.g. TOP → FLASH on attempt #1). The DB rejects FLASH on later attempts. */
export async function correctAttempt(input: z.input<typeof correctSchema>): Promise<ActionResult<Tables<"attempts">>> {
  const viewer = await requireViewer();
  const parsed = correctSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { data, error } = await viewer.supabase
    .from("attempts")
    .update({ result: parsed.data.result })
    .eq("id", parsed.data.attemptId)
    .select()
    .single();
  if (error) return { ok: false, error: error.code === "23514" ? "flashOnlyFirst" : "unknownError" };
  revalidatePath(`/problem/${data.problem_id}`);
  return { ok: true, data };
}

/** Remove the most recent attempt on a problem (undo). Older attempts are kept to preserve history. */
export async function deleteLatestAttempt(attemptId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!id.safeParse(attemptId).success) return { ok: false, error: "invalid" };
  const { data: a } = await viewer.supabase.from("attempts").select("problem_id, attempt_number").eq("id", attemptId).single();
  if (!a) return { ok: false, error: "notFound" };
  const { data: latest } = await viewer.supabase
    .from("attempts")
    .select("id")
    .eq("problem_id", a.problem_id)
    .order("attempt_number", { ascending: false })
    .limit(1)
    .single();
  if (latest?.id !== attemptId) return { ok: false, error: "notLatest" };
  const { error } = await viewer.supabase.from("attempts").delete().eq("id", attemptId);
  if (error) return { ok: false, error: "unknownError" };
  revalidatePath(`/problem/${a.problem_id}`);
  return { ok: true };
}
