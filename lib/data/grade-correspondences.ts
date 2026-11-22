import "server-only";
import { toOverrides, type CorrespondenceOverride } from "@/lib/grading/harmonise";
import type { ServerSupabase } from "@/lib/supabase/server";

/** The climber's own correspondence lines (RLS-scoped); none when the read fails, so the defaults apply. */
export async function loadCorrespondenceOverrides(supabase: ServerSupabase): Promise<CorrespondenceOverride[]> {
  const { data, error } = await supabase.from("grade_correspondences").select("grade_system, native_grade, font_from, font_to");
  if (error || !data) return [];
  return toOverrides(data);
}
