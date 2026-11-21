import { createClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/database.types";
import { publicSupabaseEnv } from "@/lib/supabase/public-env";
import { BATTERY_PROTOCOL_VERSION } from "@/lib/training/mobility-battery/cards";
import { bilanImportSchema, buildImportRows } from "@/lib/training/mobility-battery/import";

export const runtime = "nodejs";

/**
 * A mobility bilan done outside the app (for example the baseline recorded with Claude),
 * imported with the climber's coach key like /api/coach-sessions. It is written to the
 * key's owner and no one else, through the coach_key_import_battery database function
 * (no user session, no service-role key). Each card goes through the same rules as in the
 * app; the values stay self-reported.
 *
 *   POST {bilan}   import it (idempotent: one bilan per day, a re-run returns the existing one)
 */

function json(status: number, body: unknown) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function keyOf(request: Request): string | null {
  const m = /^Bearer (lbk_[0-9a-f]{48})$/.exec(request.headers.get("authorization") ?? "");
  return m ? m[1] : null;
}

function failure(error: { message?: string } | null) {
  const message = error?.message ?? "";
  if (message.includes("invalid_key")) return json(401, { error: "invalid_key" });
  if (message.includes("rate_limited")) return json(429, { error: "rate_limited" });
  if (message.includes("future_date")) return json(409, { error: "future_date" });
  if (message.includes("bilan_open")) return json(409, { error: "bilan_open" });
  if (message.includes("invalid_bilan")) return json(400, { error: "invalid_bilan" });
  if (message.includes("clinical review") || message.includes("knee pain") || message.includes("clinician")) return json(400, { error: "card_rules" });
  return json(500, { error: "unknown" });
}

export async function POST(request: Request) {
  const key = keyOf(request);
  if (!key) return json(401, { error: "invalid_key" });
  const env = publicSupabaseEnv();
  if (!env) return json(503, { error: "not_configured" });
  const raw = await request.text();
  if (raw.length > 200_000) return json(413, { error: "too_large" });
  let body: unknown = null;
  try { body = JSON.parse(raw); } catch { /* reported below */ }
  const parsed = bilanImportSchema.safeParse(body);
  if (!parsed.success) {
    // Paths and messages only (never the submitted values).
    return json(400, { error: "invalid_bilan", issues: parsed.error.issues.slice(0, 30).map((i) => ({ path: i.path.join("."), message: i.message })) });
  }
  const bilan = parsed.data;
  const built = buildImportRows(bilan);
  if (!built.ok) return json(400, { error: "invalid_bilan", card: built.cardId ?? null, reason: built.error });
  const db = createClient<Database>(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await db.rpc("coach_key_import_battery", {
    p_key: key, p_protocol: BATTERY_PROTOCOL_VERSION, p_started_on: bilan.startedOn, p_status: bilan.status,
    p_stop_reason: bilan.stopReason, p_knee_pain: bilan.kneePainToday, p_conditions: bilan.conditions as unknown as Json,
    p_notes: bilan.notes, p_rows: built.rows as unknown as Json,
  });
  if (error) return failure(error);
  return json(200, data);
}
