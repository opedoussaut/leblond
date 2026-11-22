import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import { publicSupabaseEnv } from "@/lib/supabase/public-env";
import { TOTAL_SESSIONS } from "@/lib/training/mobility-rebuild/engine";
import { contentOf, plannedSessions, rebuildProgrammeSchema } from "@/lib/training/mobility-rebuild/templates";
import { localDate_ } from "@/lib/training/sessions";

export const runtime = "nodejs";

/**
 * Personal programmes written outside the app (by Claude, working with the
 * climber), authenticated by the climber's coach key like /api/coach-sessions.
 * The programme is assigned to the key's owner and no one else; every write
 * goes through the coach_key_* database functions. No user session, no
 * service-role key.
 *
 *   GET                  the programme's state: enrolment id, start, counts by status
 *   POST {programme}     assign Mobility Rebuild | 12 Weeks (idempotent: a re-run refreshes the
 *                        content and the titles of séances not started, and only adds the séances
 *                        still missing, never in the past)
 */

type Status = { enrollment_id: string; started_on: string; days: number[] | null; slots: number } | null;

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
  if (message.includes("backdated")) return json(409, { error: "backdated" });
  if (message.includes("invalid_programme")) return json(400, { error: "invalid_programme" });
  return json(500, { error: "unknown" });
}

async function prepare(request: Request) {
  const key = keyOf(request);
  if (!key) return { response: json(401, { error: "invalid_key" }) } as const;
  const env = publicSupabaseEnv();
  if (!env) return { response: json(503, { error: "not_configured" }) } as const;
  const db = createClient<Database>(env.url, env.anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  return { key, db } as const;
}

export async function GET(request: Request) {
  const p = await prepare(request);
  if ("response" in p) return p.response;
  const { data, error } = await p.db.rpc("coach_key_rebuild_status", { p_key: p.key });
  if (error) return failure(error);
  return json(200, { programme: data ?? null });
}

export async function POST(request: Request) {
  const p = await prepare(request);
  if ("response" in p) return p.response;
  const raw = await request.text();
  if (raw.length > 500_000) return json(413, { error: "too_large" });
  let body: unknown = null;
  try { body = JSON.parse(raw); } catch { /* reported below */ }
  const parsed = rebuildProgrammeSchema.safeParse(body);
  if (!parsed.success) {
    // Paths and messages only (never the submitted values).
    return json(400, { error: "invalid_programme", issues: parsed.error.issues.slice(0, 30).map((i) => ({ path: i.path.join("."), message: i.message })) });
  }
  const programme = parsed.data;
  const { data: current, error: statusError } = await p.db.rpc("coach_key_rebuild_status", { p_key: p.key });
  if (statusError) return failure(statusError);
  const status = current as Status;
  const today = localDate_(new Date());
  let sessions: ReturnType<typeof plannedSessions> = [];
  // Already started: same days and start, so missing slots get the dates they always had. The séances
  // that exist keep their date and entries; the database only refreshes the title of those not started.
  const days = status?.days ?? programme.days;
  try {
    sessions = plannedSessions({ days, templates: programme.templates }, today, status?.started_on);
  } catch {
    // All slots there: the content is still refreshed. Some missing: their dates can't be rebuilt.
    if (!status || status.slots < TOTAL_SESSIONS) return json(409, { error: "schedule_changed" });
  }
  const { data, error } = await p.db.rpc("coach_key_assign_rebuild", {
    p_key: p.key, p_days: status?.days ?? programme.days, p_content: contentOf(programme),
    p_sessions: sessions.map((s) => ({ slot: s.slot, date: s.date, phase: s.phase, minutes: s.minutes, title: s.title, exercises: s.exercises })),
  });
  if (error) return failure(error);
  return json(200, data);
}
