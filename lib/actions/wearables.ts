"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { getProvider } from "@/lib/integrations/wearables/registry";
import { loadTokens, markConnection, saveConnection, saveWorkout } from "@/lib/integrations/wearables/store";
import { ProviderCapabilityError, WEARABLE_PROVIDERS } from "@/lib/integrations/wearables/types";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ActionResult } from "@/lib/validation/common";

const providerSchema = z.enum(WEARABLE_PROVIDERS);

export async function disconnectProvider(provider: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  const p = providerSchema.safeParse(provider);
  const admin = createAdminClient();
  if (!p.success || !admin) return { ok: false, error: "invalid" };
  const tokens = await loadTokens(admin, viewer.userId, p.data).catch(() => null);
  if (tokens) await getProvider(p.data).disconnect(tokens).catch(() => undefined);
  await markConnection(admin, viewer.userId, p.data, "DISCONNECTED");
  revalidatePath("/settings/connections");
  return { ok: true };
}

export async function syncProvider(provider: string): Promise<ActionResult<{ inserted: number; duplicates: number }>> {
  const viewer = await requireViewer();
  const p = providerSchema.safeParse(provider);
  const admin = createAdminClient();
  if (!p.success || !admin) return { ok: false, error: "invalid" };
  const adapter = getProvider(p.data);
  let tokens = await loadTokens(admin, viewer.userId, p.data).catch(() => null);
  if (!tokens) return { ok: false, error: "not_connected" };
  try {
    if (tokens.expiresAt && tokens.expiresAt.getTime() < Date.now() + 600_000 && tokens.refreshToken && adapter.refreshTokens) {
      tokens = await adapter.refreshTokens(tokens.refreshToken);
      await saveConnection(admin, viewer.userId, p.data, tokens);
    }
    const { data: conn } = await viewer.supabase.from("wearable_connections").select("last_sync_at").eq("provider", p.data).maybeSingle();
    const since = conn?.last_sync_at ? new Date(conn.last_sync_at) : new Date(Date.now() - 30 * 86_400_000);
    const workouts = await adapter.syncActivities(tokens, since);
    let inserted = 0;
    let duplicates = 0;
    for (const w of workouts) {
      const r = await saveWorkout(viewer.supabase, viewer.userId, w);
      if (r.status === "inserted") inserted++;
      else duplicates++;
    }
    await admin
      .from("wearable_connections")
      .update({ last_sync_at: new Date().toISOString(), last_error: null })
      .eq("user_id", viewer.userId)
      .eq("provider", p.data);
    revalidatePath("/settings/connections");
    return { ok: true, data: { inserted, duplicates } };
  } catch (e) {
    if (e instanceof ProviderCapabilityError) return { ok: false, error: e.code };
    await markConnection(admin, viewer.userId, p.data, "ERROR", "sync_failed");
    revalidatePath("/settings/connections");
    return { ok: false, error: "sync_failed" };
  }
}

export async function linkActivityToSession(activityId: string, sessionId: string | null): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!z.guid().safeParse(activityId).success || (sessionId !== null && !z.guid().safeParse(sessionId).success)) {
    return { ok: false, error: "invalid" };
  }
  const { error } = sessionId
    ? await viewer.supabase.rpc("link_wearable_activity", { p_activity_id: activityId, p_session_id: sessionId })
    : await viewer.supabase.rpc("unlink_wearable_activity", { p_activity_id: activityId });
  if (error) return { ok: false, error: "unknownError" };
  revalidatePath("/settings/connections");
  if (sessionId) revalidatePath(`/session/${sessionId}`);
  revalidatePath("/progress");
  return { ok: true };
}

export async function deleteActivity(activityId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!z.guid().safeParse(activityId).success) return { ok: false, error: "invalid" };
  const { data: a } = await viewer.supabase
    .from("wearable_activities")
    .select("raw_file_reference, session_id")
    .eq("id", activityId)
    .single();
  if (!a) return { ok: false, error: "notFound" };
  if (a.session_id) await viewer.supabase.rpc("unlink_wearable_activity", { p_activity_id: activityId });
  if (a.raw_file_reference) await viewer.supabase.storage.from("wearable-files").remove([a.raw_file_reference]);
  const { error } = await viewer.supabase.from("wearable_activities").delete().eq("id", activityId);
  if (error) return { ok: false, error: "unknownError" };
  revalidatePath("/settings/connections");
  return { ok: true };
}
