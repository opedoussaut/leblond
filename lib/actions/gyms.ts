"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { allowedSystemsForBrand, GRADE_SYSTEMS, GYM_BRANDS } from "@/lib/climbing/types";
import { requireViewer } from "@/lib/auth/viewer";
import type { Tables } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/validation/common";

const createGymSchema = z.object({
  name: z.string().trim().min(2).max(120),
  brand: z.enum(GYM_BRANDS),
  city: z.string().trim().max(120).optional().transform((v) => v || null),
  gradingSystem: z.enum(GRADE_SYSTEMS).optional(),
});

export async function createGym(input: z.input<typeof createGymSchema>): Promise<ActionResult<Tables<"gyms">>> {
  const viewer = await requireViewer({ allowIncompleteOnboarding: true });
  const parsed = createGymSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { name, brand, city } = parsed.data;
  const allowed = allowedSystemsForBrand(brand);
  const gradingSystem =
    parsed.data.gradingSystem && allowed.includes(parsed.data.gradingSystem) ? parsed.data.gradingSystem : allowed[0];

  const { data, error } = await viewer.supabase
    .from("gyms")
    .insert({ name, brand, city, country: "FR", grading_system: gradingSystem, created_by: viewer.userId })
    .select()
    .single();
  if (error) return { ok: false, error: error.code === "23505" ? "duplicate" : "unknownError" };

  await viewer.supabase.from("favourite_gyms").upsert({ user_id: viewer.userId, gym_id: data.id });
  revalidatePath("/session/new");
  return { ok: true, data };
}

export async function setFavouriteGym(gymId: string, favourite: boolean): Promise<ActionResult> {
  const viewer = await requireViewer({ allowIncompleteOnboarding: true });
  if (!z.uuid().safeParse(gymId).success) return { ok: false, error: "invalid" };
  const q = favourite
    ? viewer.supabase.from("favourite_gyms").upsert({ user_id: viewer.userId, gym_id: gymId })
    : viewer.supabase.from("favourite_gyms").delete().eq("user_id", viewer.userId).eq("gym_id", gymId);
  const { error } = await q;
  if (error) return { ok: false, error: "unknownError" };
  revalidatePath("/session/new");
  return { ok: true };
}
