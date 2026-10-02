import "server-only";
import { decryptSecret, encryptSecret } from "@/lib/security/crypto";
import type { Json } from "@/lib/supabase/database.types";
import type { createAdminClient } from "@/lib/supabase/admin";
import type { ServerSupabase } from "@/lib/supabase/server";
import { computeDedupKey, findDuplicate } from "./dedup";
import type { NormalizedWorkout, TokenSet, WearableProviderId } from "./types";

type Admin = NonNullable<ReturnType<typeof createAdminClient>>;

/* ───────────── Tokens (service role only; encrypted at rest) ───────────── */

export async function saveConnection(admin: Admin, userId: string, provider: WearableProviderId, tokens: TokenSet) {
  const { error } = await admin.from("wearable_connections").upsert(
    {
      user_id: userId,
      provider,
      status: "CONNECTED",
      provider_user_id: tokens.providerUserId,
      scopes: tokens.scopes,
      access_token_encrypted: encryptSecret(tokens.accessToken),
      refresh_token_encrypted: tokens.refreshToken ? encryptSecret(tokens.refreshToken) : null,
      expires_at: tokens.expiresAt?.toISOString() ?? null,
      last_error: null,
    },
    { onConflict: "user_id,provider" },
  );
  if (error) throw new Error("connection_save_failed");
}

export async function loadTokens(admin: Admin, userId: string, provider: WearableProviderId): Promise<TokenSet | null> {
  const { data } = await admin
    .from("wearable_connections")
    .select("access_token_encrypted, refresh_token_encrypted, expires_at, scopes, provider_user_id, status")
    .eq("user_id", userId)
    .eq("provider", provider)
    .maybeSingle();
  if (!data?.access_token_encrypted || data.status !== "CONNECTED") return null;
  return {
    accessToken: decryptSecret(data.access_token_encrypted),
    refreshToken: data.refresh_token_encrypted ? decryptSecret(data.refresh_token_encrypted) : null,
    expiresAt: data.expires_at ? new Date(data.expires_at) : null,
    scopes: data.scopes,
    providerUserId: data.provider_user_id,
  };
}

export async function markConnection(
  admin: Admin,
  userId: string,
  provider: WearableProviderId,
  status: "DISCONNECTED" | "ERROR",
  lastError: string | null = null,
) {
  await admin.from("wearable_connections").upsert(
    {
      user_id: userId,
      provider,
      status,
      last_error: lastError,
      ...(status === "DISCONNECTED"
        ? { access_token_encrypted: null, refresh_token_encrypted: null, expires_at: null, provider_user_id: null }
        : {}),
    },
    { onConflict: "user_id,provider" },
  );
}

/* ───────────── Activities (user's own client; RLS applies) ───────────── */

export type SaveResult = { status: "inserted"; id: string } | { status: "duplicate"; id: string };

/**
 * Persist a normalised workout unless it already exists, either from the same
 * provider (same external id) or from another source (time/duration match).
 */
export async function saveWorkout(supabase: ServerSupabase, userId: string, w: NormalizedWorkout): Promise<SaveResult> {
  const { data: same } = await supabase
    .from("wearable_activities")
    .select("id")
    .eq("provider", w.provider)
    .eq("provider_activity_id", w.externalActivityId)
    .maybeSingle();
  if (same) return { status: "duplicate", id: same.id };

  const from = new Date(w.startedAt.getTime() - 3_600_000).toISOString();
  const to = new Date(w.startedAt.getTime() + 3_600_000).toISOString();
  const { data: nearby } = await supabase
    .from("wearable_activities")
    .select("id, started_at, duration_seconds")
    .gte("started_at", from)
    .lte("started_at", to);
  const dup = findDuplicate(
    w,
    (nearby ?? []).map((n) => ({ id: n.id, startedAt: new Date(n.started_at), durationSeconds: n.duration_seconds })),
  );
  if (dup) return { status: "duplicate", id: dup.id };

  const { data, error } = await supabase
    .from("wearable_activities")
    .insert({
      user_id: userId,
      provider: w.provider,
      provider_activity_id: w.externalActivityId,
      activity_type: w.activityType.slice(0, 80),
      started_at: w.startedAt.toISOString(),
      duration_seconds: w.durationSeconds,
      calories: w.calories,
      avg_heart_rate: w.avgHeartRate,
      max_heart_rate: w.maxHeartRate,
      training_load: w.trainingLoad,
      recovery_metrics: (w.recoveryMetrics ?? null) as Json,
      device_name: w.deviceName?.slice(0, 120) ?? null,
      device_manufacturer: w.deviceManufacturer?.slice(0, 80) ?? null,
      raw_file_reference: w.rawFileReference,
      dedup_key: computeDedupKey(w),
      raw_metadata: w.rawMetadata as Json,
    })
    .select("id")
    .single();
  if (error || !data) throw new Error("activity_save_failed");
  if (w.heartRateSamples?.length) {
    await supabase.from("wearable_activity_samples").insert({
      activity_id: data.id,
      user_id: userId,
      heart_rate: w.heartRateSamples.map((s) => [s.t, s.bpm]),
    });
  }
  return { status: "inserted", id: data.id };
}
