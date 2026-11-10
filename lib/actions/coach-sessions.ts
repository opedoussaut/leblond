"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";

type Result<T = undefined> = { ok: true; data: T } | { ok: false; error: "invalid" | "too_many_keys" | "not_found" | "unknown" };

/** Creates a coach key and returns it in clear: the only time it is ever shown. */
export async function createCoachKey(label: string): Promise<Result<{ key: string }>> {
  const viewer = await requireViewer();
  const parsed = z.string().trim().min(1).max(60).safeParse(label);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { data, error } = await viewer.supabase.rpc("create_coach_key", { p_label: parsed.data });
  if (error || !data) return { ok: false, error: error?.message?.includes("too_many_keys") ? "too_many_keys" : "unknown" };
  revalidatePath("/settings");
  return { ok: true, data: { key: data } };
}

export async function revokeCoachKey(id: string): Promise<Result> {
  const viewer = await requireViewer();
  if (!z.guid().safeParse(id).success) return { ok: false, error: "invalid" };
  const { data, error } = await viewer.supabase.rpc("revoke_coach_key", { p_id: id });
  if (error) return { ok: false, error: "unknown" };
  if (!data) return { ok: false, error: "not_found" };
  revalidatePath("/settings");
  return { ok: true, data: undefined };
}

/** Removes a coach session from the list (sessions already created from it are kept). */
export async function removeCoachSession(id: string): Promise<Result> {
  const viewer = await requireViewer();
  if (!z.guid().safeParse(id).success) return { ok: false, error: "invalid" };
  const { error, count } = await viewer.supabase.from("coach_sessions").delete({ count: "exact" }).eq("id", id);
  if (error) return { ok: false, error: "unknown" };
  if (!count) return { ok: false, error: "not_found" };
  revalidatePath("/train/sessions");
  return { ok: true, data: undefined };
}
