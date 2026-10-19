import "server-only";
import type { ServerSupabase } from "@/lib/supabase/server";

export const OUTDOOR_AREA_COLUMNS =
  "id, gym_id, name, cluster_name, tags, warning_fr, warning_en, problems_count, priority" as const;
export const OUTDOOR_PROBLEM_COLUMNS =
  "id, name, name_searchable, grade, circuit_color, circuit_number, steepness, sit_start, popularity, parent_id, bleau_info_id" as const;

export interface OutdoorAreaItem {
  id: number;
  gym_id: string;
  name: string;
  cluster_name: string | null;
  tags: string[];
  warning_fr: string | null;
  warning_en: string | null;
  problems_count: number;
  priority: number;
}

export interface OutdoorProblemItem {
  id: number;
  name: string;
  name_searchable: string;
  grade: string;
  circuit_color: string | null;
  circuit_number: string | null;
  steepness: string;
  sit_start: boolean;
  popularity: number | null;
  parent_id: number | null;
  bleau_info_id: string | null;
}

/** Fontainebleau areas (Boolder catalogue), most prominent first. Empty if never imported. */
export async function listOutdoorAreas(supabase: ServerSupabase): Promise<OutdoorAreaItem[]> {
  const { data, error } = await supabase
    .from("outdoor_areas")
    .select(OUTDOOR_AREA_COLUMNS)
    .order("priority")
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}

/** The catalogue area behind a gym, with all its problems (paged past PostgREST's row cap). */
export async function loadOutdoorAreaForGym(supabase: ServerSupabase, gymId: string) {
  const { data: area } = await supabase.from("outdoor_areas").select(OUTDOOR_AREA_COLUMNS).eq("gym_id", gymId).maybeSingle();
  if (!area) return null;
  const problems: OutdoorProblemItem[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("outdoor_problems")
      .select(OUTDOOR_PROBLEM_COLUMNS)
      .eq("area_id", area.id)
      .order("id")
      .range(from, from + 999);
    if (error) throw new Error(error.message);
    problems.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return { area: area as OutdoorAreaItem, problems };
}

export async function loadOutdoorProblem(supabase: ServerSupabase, id: number) {
  const { data } = await supabase
    .from("outdoor_problems")
    .select(`${OUTDOOR_PROBLEM_COLUMNS}, area_id, outdoor_areas(name)`)
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function latestOutdoorImport(supabase: ServerSupabase) {
  const { data } = await supabase
    .from("outdoor_data_imports")
    .select("imported_at, source_version, areas, problems")
    .order("imported_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}
