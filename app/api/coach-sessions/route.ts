import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { publicSupabaseEnv } from "@/lib/supabase/public-env";
import { coachContent, coachSessionSchema } from "@/lib/training/coach-sessions";

export const runtime = "nodejs";

/**
 * Coach sessions written outside the app (by Claude, working with the climber).
 * Authenticated by a personal coach key (`Authorization: Bearer lbk_…`) created
 * in Settings. The key's only power is this list: every call goes through the
 * coach_key_* database functions, which check the key (hash, not revoked,
 * climber still on the active whitelist, daily limit). No user session, no
 * service-role key.
 *
 *   GET                 list the climber's coach sessions (slug, title, minutes)
 *   POST  {session}     add, or replace the one with the same slug
 *   DELETE ?slug=…      remove one
 */

function json(status: number, body: unknown) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

function keyOf(request: Request): string | null {
  const m = /^Bearer (lbk_[0-9a-f]{48})$/.exec(request.headers.get("authorization") ?? "");
  return m ? m[1] : null;
}

function database() {
  const env = publicSupabaseEnv();
  if (!env) return null;
  return createClient<Database>(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

function failure(error: { message?: string } | null) {
  const message = error?.message ?? "";
  if (message.includes("invalid_key")) return json(401, { error: "invalid_key" });
  if (message.includes("rate_limited")) return json(429, { error: "rate_limited" });
  if (message.includes("too_many_sessions")) return json(409, { error: "too_many_sessions" });
  return json(500, { error: "unknown" });
}

async function prepare(request: Request) {
  const key = keyOf(request);
  if (!key) return { response: json(401, { error: "invalid_key" }) } as const;
  const db = database();
  if (!db) return { response: json(503, { error: "not_configured" }) } as const;
  return { key, db } as const;
}

export async function GET(request: Request) {
  const p = await prepare(request);
  if ("response" in p) return p.response;
  const { data, error } = await p.db.rpc("coach_key_list_sessions", { p_key: p.key });
  if (error) return failure(error);
  return json(200, { sessions: data ?? [] });
}

export async function POST(request: Request) {
  const p = await prepare(request);
  if ("response" in p) return p.response;
  const raw = await request.text();
  if (raw.length > 100_000) return json(413, { error: "too_large" });
  let body: unknown = null;
  try { body = JSON.parse(raw); } catch { /* reported below */ }
  const parsed = coachSessionSchema.safeParse(body);
  if (!parsed.success) {
    // Paths and messages only (never the submitted values), so the coach can fix the session.
    return json(400, { error: "invalid_session", issues: parsed.error.issues.slice(0, 20).map((i) => ({ path: i.path.join("."), message: i.message })) });
  }
  const s = parsed.data;
  const { data, error } = await p.db.rpc("coach_key_put_session", {
    p_key: p.key, p_slug: s.slug, p_title: s.title, p_objective: s.objective, p_minutes: s.minutes,
    p_place: s.place, p_content: coachContent(s),
  });
  if (error) return failure(error);
  return json(200, { id: data, slug: s.slug });
}

export async function DELETE(request: Request) {
  const p = await prepare(request);
  if ("response" in p) return p.response;
  const slug = new URL(request.url).searchParams.get("slug") ?? "";
  if (!/^[a-z0-9][a-z0-9-]{0,59}$/.test(slug)) return json(400, { error: "invalid_slug" });
  const { data, error } = await p.db.rpc("coach_key_delete_session", { p_key: p.key, p_slug: slug });
  if (error) return failure(error);
  return data ? json(200, { removed: slug }) : json(404, { error: "not_found" });
}
