"use server";

import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import type { ActionResult } from "@/lib/validation/common";
import type { LiveProblem } from "./sessions";

const schema = z.object({ gymId: z.guid(), outdoorProblemId: z.number().int().positive() });

/**
 * Picks a Fontainebleau boulder from the Boolder catalogue. Reuses the
 * climber's existing problem for that boulder (so attempts accumulate across
 * sessions) or creates it with Boolder's grade as the native Font grade.
 */
export async function pickOutdoorProblem(input: z.input<typeof schema>): Promise<ActionResult<LiveProblem>> {
  const viewer = await requireViewer();
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { gymId, outdoorProblemId } = parsed.data;

  const { data: op } = await viewer.supabase
    .from("outdoor_problems")
    .select("id, name, grade, wall_angle, outdoor_areas!inner(gym_id)")
    .eq("id", outdoorProblemId)
    .maybeSingle();
  if (!op) return { ok: false, error: "notFound" };
  if (op.outdoor_areas.gym_id !== gymId) return { ok: false, error: "invalid" };

  const existing = async () => {
    const { data } = await viewer.supabase
      .from("problems")
      .select("*, problem_tags(tags(slug))")
      .eq("created_by", viewer.userId)
      .eq("outdoor_problem_id", outdoorProblemId)
      .maybeSingle();
    if (!data) return null;
    const { problem_tags, ...row } = data;
    return { ...row, tags: problem_tags.map((pt) => pt.tags?.slug).filter((s): s is string => Boolean(s)) };
  };

  const found = await existing();
  if (found) return { ok: true, data: found };

  const { data, error } = await viewer.supabase
    .from("problems")
    .insert({
      gym_id: gymId,
      created_by: viewer.userId,
      name: op.name.slice(0, 120),
      native_grade: op.grade,
      native_grade_system: "FONT",
      wall_angle: op.wall_angle,
      outdoor_problem_id: outdoorProblemId,
    })
    .select()
    .single();
  if (error) {
    // Picked twice at the same moment: the unique index kept one row; use it.
    if (error.code === "23505") {
      const again = await existing();
      if (again) return { ok: true, data: again };
    }
    return { ok: false, error: "unknownError" };
  }
  return { ok: true, data: { ...data, tags: [] } };
}
