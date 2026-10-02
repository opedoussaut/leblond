"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { GRADE_SYSTEMS } from "@/lib/climbing/types";
import { isValidGrade } from "@/lib/grading";
import { LOCALE_COOKIE, LOCALES } from "@/lib/i18n";
import type { ActionResult } from "@/lib/validation/common";

const gradePair = (gradeKey: string, systemKey: string) => (v: Record<string, unknown>) => {
  const g = v[gradeKey];
  const s = v[systemKey];
  if (g == null || g === "") return true;
  return typeof g === "string" && typeof s === "string" && isValidGrade(s as never, g);
};

const onboardingSchema = z
  .object({
    displayName: z.string().trim().min(1).max(60),
    language: z.enum(LOCALES),
    levelSystem: z.enum(GRADE_SYSTEMS).nullable(),
    level: z.string().max(10).nullable(),
    targetSystem: z.enum(GRADE_SYSTEMS),
    targetGrade: z.string().max(10),
    favouriteGymIds: z.array(z.uuid()).max(30),
  })
  .refine(gradePair("level", "levelSystem"), { path: ["level"] })
  .refine((v) => isValidGrade(v.targetSystem, v.targetGrade), { path: ["targetGrade"] });

export async function completeOnboarding(input: z.input<typeof onboardingSchema>): Promise<ActionResult> {
  const viewer = await requireViewer({ allowIncompleteOnboarding: true });
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const { error } = await viewer.supabase
    .from("profiles")
    .update({
      display_name: v.displayName,
      preferred_language: v.language,
      self_reported_level: v.level || null,
      self_reported_level_system: v.level ? v.levelSystem : null,
      target_grade: v.targetGrade,
      target_grade_system: v.targetSystem,
      onboarding_completed_at: new Date().toISOString(),
    })
    .eq("id", viewer.userId);
  if (error) return { ok: false, error: "unknownError" };

  if (v.favouriteGymIds.length) {
    await viewer.supabase
      .from("favourite_gyms")
      .upsert(v.favouriteGymIds.map((gym_id) => ({ user_id: viewer.userId, gym_id })));
  }
  (await cookies()).set(LOCALE_COOKIE, v.language, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
  return { ok: true };
}

const profileSchema = z
  .object({
    displayName: z.string().trim().min(1).max(60),
    language: z.enum(LOCALES),
    targetSystem: z.enum(GRADE_SYSTEMS),
    targetGrade: z.string().max(10),
    heightCm: z.coerce.number().min(100).max(250).nullable(),
    weightKg: z.coerce.number().min(25).max(250).nullable(),
    climbingSince: z.iso.date().nullable(),
    bio: z.string().max(1000).nullable(),
  })
  .refine((v) => isValidGrade(v.targetSystem, v.targetGrade), { path: ["targetGrade"] });

function nullable(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v.trim() : "";
  return s === "" ? null : s;
}

export async function updateProfile(_prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = profileSchema.safeParse({
    displayName: formData.get("displayName"),
    language: formData.get("language"),
    targetSystem: formData.get("targetSystem"),
    targetGrade: formData.get("targetGrade"),
    heightCm: nullable(formData.get("heightCm")),
    weightKg: nullable(formData.get("weightKg")),
    climbingSince: nullable(formData.get("climbingSince")),
    bio: nullable(formData.get("bio")),
  });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const { error } = await viewer.supabase
    .from("profiles")
    .update({
      display_name: v.displayName,
      preferred_language: v.language,
      target_grade: v.targetGrade,
      target_grade_system: v.targetSystem,
      height_cm: v.heightCm,
      weight_kg: v.weightKg,
      climbing_since: v.climbingSince,
      bio: v.bio,
    })
    .eq("id", viewer.userId);
  if (error) return { ok: false, error: "unknownError" };
  (await cookies()).set(LOCALE_COOKIE, v.language, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  revalidatePath("/", "layout");
  return { ok: true };
}
