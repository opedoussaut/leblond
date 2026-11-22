"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { GRADE_SYSTEMS } from "@/lib/climbing/types";
import { DEFAULT_BOULDER_TABLE, fontIndex } from "@/lib/grading/harmonise";
import { isFontGrade } from "@/lib/grading/ordering";
import type { ActionResult } from "@/lib/validation/common";

const lineSchema = z.object({
  system: z.enum(GRADE_SYSTEMS),
  grade: z.string().min(1).max(20),
  from: z.string().refine(isFontGrade),
  to: z.string().refine(isFontGrade),
}).refine((v) => !!DEFAULT_BOULDER_TABLE[v.system]?.[v.grade], { path: ["grade"] })
  .refine((v) => isFontGrade(v.from) && isFontGrade(v.to) && fontIndex(v.from) <= fontIndex(v.to), { path: ["to"] });

/**
 * Sets the climber's own Font span for one native grade. A span equal to the
 * default removes the climber's line (back to the default). Native grades are
 * never touched.
 */
export async function saveGradeCorrespondence(input: z.input<typeof lineSchema>): Promise<ActionResult> {
  const v = lineSchema.safeParse(input);
  if (!v.success) return { ok: false, error: "invalid" };
  const viewer = await requireViewer();
  const { system, grade, from, to } = v.data;
  const def = DEFAULT_BOULDER_TABLE[system]![grade];
  const table = viewer.supabase.from("grade_correspondences");
  const { error } = def.from === from && def.to === to
    ? await table.delete().eq("grade_system", system).eq("native_grade", grade)
    : await table.upsert({ user_id: viewer.userId, grade_system: system, native_grade: grade, font_from: from, font_to: to, updated_at: new Date().toISOString() },
      { onConflict: "user_id,grade_system,native_grade" });
  if (error) return { ok: false, error: "unknown" };
  revalidatePath("/settings/grades");
  revalidatePath("/follow-up");
  return { ok: true };
}

/** Removes every line of the climber's for one scale (back to the default table). */
export async function resetGradeCorrespondences(system: string): Promise<ActionResult> {
  const v = z.enum(GRADE_SYSTEMS).safeParse(system);
  if (!v.success || !DEFAULT_BOULDER_TABLE[v.data]) return { ok: false, error: "invalid" };
  const viewer = await requireViewer();
  const { error } = await viewer.supabase.from("grade_correspondences").delete().eq("grade_system", v.data);
  if (error) return { ok: false, error: "unknown" };
  revalidatePath("/settings/grades");
  revalidatePath("/follow-up");
  return { ok: true };
}
