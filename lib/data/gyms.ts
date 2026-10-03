import "server-only";
import type { Tables } from "@/lib/supabase/database.types";
import type { ServerSupabase } from "@/lib/supabase/server";

export type GymRow = Tables<"gyms">;

export async function listGymsWithFavourites(supabase: ServerSupabase, userId: string) {
  const [{ data: gyms, error }, { data: favs }] = await Promise.all([
    supabase.from("gyms").select("*").eq("active", true).order("brand").order("name"),
    supabase.from("favourite_gyms").select("gym_id").eq("user_id", userId),
  ]);
  if (error) throw new Error(error.message);
  return { gyms: gyms ?? [], favouriteIds: (favs ?? []).map((f) => f.gym_id) };
}
