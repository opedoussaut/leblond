import "server-only";
import type { Tables } from "@/lib/supabase/database.types";
import type { ServerSupabase } from "@/lib/supabase/server";

export type GymRow = Tables<"gyms">;

/**
 * Gyms climbers pick from by hand. Catalogue entries (one per Boolder area)
 * are excluded here and offered through the Fontainebleau area picker instead.
 */
export async function listGymsWithFavourites(supabase: ServerSupabase, userId: string) {
  const [{ data: gyms, error }, { data: favs }] = await Promise.all([
    supabase.from("gyms").select("*").eq("active", true).is("external_provider", null).order("brand").order("name"),
    supabase.from("favourite_gyms").select("gym_id").eq("user_id", userId),
  ]);
  if (error) throw new Error(error.message);
  return { gyms: gyms ?? [], favouriteIds: (favs ?? []).map((f) => f.gym_id) };
}
