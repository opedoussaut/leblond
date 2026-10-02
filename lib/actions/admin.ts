"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/validation/common";

/** Admin-only: activate/deactivate a beta tester. Cannot target oneself. */
export async function setBetaUserActive(email: string, active: boolean): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (viewer.role !== "admin") return { ok: false, error: "forbidden" };
  const parsed = z.email().safeParse(email);
  if (!parsed.success || parsed.data === viewer.email.toLowerCase()) return { ok: false, error: "invalid" };
  const admin = createAdminClient();
  if (!admin) return { ok: false, error: "notConfigured" };
  const { error } = await admin.from("beta_users").update({ active }).eq("email", parsed.data).neq("role", "admin");
  if (error) return { ok: false, error: "unknownError" };
  revalidatePath("/settings/admin");
  return { ok: true };
}
