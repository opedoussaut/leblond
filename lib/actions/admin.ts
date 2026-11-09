"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { generateInviteCode } from "@/lib/auth/invite-code";
import { requireViewer } from "@/lib/auth/viewer";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/validation/common";

/**
 * Admin-only: a single-use invitation link, valid 30 days. Goes through the
 * admin's own session (RLS on beta_invites lets the admin alone), so it works
 * without the service-role key.
 */
export async function createBetaInvite(label: string): Promise<ActionResult<{ code: string }>> {
  const viewer = await requireViewer();
  if (viewer.role !== "admin") return { ok: false, error: "forbidden" };
  const name = z.string().trim().max(60).safeParse(label ?? "");
  if (!name.success) return { ok: false, error: "invalid" };
  // A clash between two random codes is all but impossible; retry once or twice anyway.
  for (let i = 0; i < 3; i++) {
    const code = generateInviteCode();
    const { error } = await viewer.supabase.from("beta_invites").insert({ code, label: name.data });
    if (!error) {
      revalidatePath("/settings/admin");
      return { ok: true, data: { code } };
    }
    if (error.code !== "23505") break;
  }
  return { ok: false, error: "unknownError" };
}

/** Admin-only: cancel a link that has not been used yet. */
export async function revokeBetaInvite(id: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (viewer.role !== "admin") return { ok: false, error: "forbidden" };
  if (!z.guid().safeParse(id).success) return { ok: false, error: "invalid" };
  const { error } = await viewer.supabase
    .from("beta_invites")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", id)
    .is("redeemed_at", null)
    .is("revoked_at", null);
  if (error) return { ok: false, error: "unknownError" };
  revalidatePath("/settings/admin");
  return { ok: true };
}

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
