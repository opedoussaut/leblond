import "server-only";
import type { Tables } from "@/lib/supabase/database.types";
import type { ServerSupabase } from "@/lib/supabase/server";

export const OUTDOOR_AREA_COLUMNS =
  "id, gym_id, name, cluster_name, tags, warning_fr, warning_en, problems_count, priority, source, credit" as const;
export const OUTDOOR_PROBLEM_COLUMNS =
  "id, name, name_searchable, grade, circuit_color, circuit_number, steepness, sit_start, popularity, parent_id, bleau_info_id, latitude, longitude" as const;

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
  /** BOOLDER (Fontainebleau catalogue) or LEBLOND (a topo made by the beta team). */
  source: string;
  credit: string | null;
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
  /** Null for a team-topo boulder known from the written list only (not on the map). */
  latitude: number | null;
  longitude: number | null;
}

/** Outdoor sites added by migration (the climber logs by grade, or picks from a team topo). */
export const OUTDOOR_SITE_PROVIDER = "LEBLOND";
/** Topos made by the beta team (Google My Maps imports) share the catalogue tables with Boolder. */
export const TEAM_TOPO_SOURCE = "LEBLOND";
export const BOOLDER_SOURCE = "BOOLDER";

/**
 * Outdoor sites outside the Boolder catalogue: sites added by migration and those
 * added by climbers. topo_problems is the size of the team topo, when one was imported.
 */
export async function listOutdoorSites(supabase: ServerSupabase): Promise<Array<Tables<"gyms"> & { topo_problems: number | null }>> {
  const [{ data, error }, { data: topos }] = await Promise.all([
    supabase.from("gyms").select("*")
      .or(`external_provider.eq.${OUTDOOR_SITE_PROVIDER},and(external_provider.is.null,brand.eq.OUTDOOR)`)
      .eq("active", true).order("name"),
    supabase.from("outdoor_areas").select("gym_id, problems_count").eq("source", TEAM_TOPO_SOURCE),
  ]);
  if (error) throw new Error(error.message);
  const sizes = new Map((topos ?? []).map((a) => [a.gym_id, a.problems_count]));
  return (data ?? []).map((g) => ({ ...g, topo_problems: sizes.get(g.id) ?? null }));
}

/** Fontainebleau areas (Boolder catalogue), most prominent first. Empty if never imported. */
export async function listOutdoorAreas(supabase: ServerSupabase): Promise<OutdoorAreaItem[]> {
  const { data, error } = await supabase
    .from("outdoor_areas")
    .select(OUTDOOR_AREA_COLUMNS)
    .eq("source", BOOLDER_SOURCE)
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
    .select(`${OUTDOOR_PROBLEM_COLUMNS}, area_id, source, outdoor_areas(name, credit)`)
    .eq("id", id)
    .maybeSingle();
  return data;
}

export async function latestOutdoorImport(supabase: ServerSupabase) {
  const { data } = await supabase
    .from("outdoor_data_imports")
    .select("imported_at, source_version, areas, problems")
    .eq("source", BOOLDER_SOURCE)
    .order("imported_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data;
}

/** Team topos already imported (Beta administration): one per site. */
export async function listTeamTopos(supabase: ServerSupabase) {
  const { data, error } = await supabase
    .from("outdoor_areas")
    .select("gym_id, name, credit, problems_count, updated_at")
    .eq("source", TEAM_TOPO_SOURCE)
    .order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
}
