import "server-only";
import { fontView, type FontView } from "@/lib/analytics/font-view";
import type { ClimbingDataset } from "@/lib/analytics/types";
import { conversionTable, type ConversionTable } from "@/lib/grading/harmonise";
import type { ServerSupabase } from "@/lib/supabase/server";
import { loadCorrespondenceOverrides } from "./grade-correspondences";

/** The climber's boulders on Font: their own lines from Réglages on top of the default table. */
export async function loadFontView(supabase: ServerSupabase, dataset: ClimbingDataset): Promise<FontView & { table: ConversionTable }> {
  const table = conversionTable(await loadCorrespondenceOverrides(supabase));
  return { ...fontView(dataset, table), table };
}
