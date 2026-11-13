"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer, type Viewer } from "@/lib/auth/viewer";
import { importBoardLogbookSchema, type BoardLibRow } from "@/lib/climbing/boardlib-csv";
import {
  boardAngles, boardProjectSchema, climbKey, isBoardSend, logBoardAscentSchema, startBoardSessionSchema, updateBoardAscentSchema,
  BOARD_PROJECT_STATUSES, type Board,
} from "@/lib/climbing/boards";
import { BOARD_ASCENT_COLUMNS, homeBoardGymId, type BoardAscentRow } from "@/lib/data/boards";
import { zonedToUtc } from "@/lib/time";
import type { ActionResult } from "@/lib/validation/common";

const id = z.guid();

/**
 * Board séances (Kilter, Tension, MoonBoard). Every query runs as the climber:
 * RLS keeps each climb and project private, and only lets a climb be logged in
 * the climber's own board séance on the same board.
 */

/** Starts a live board séance, or records one that already happened. */
export async function startBoardSession(input: unknown): Promise<ActionResult<{ sessionId: string }>> {
  const viewer = await requireViewer();
  const parsed = startBoardSessionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const gymId = v.gymId ?? (await homeBoardGymId(viewer.supabase));
  if (!gymId) return { ok: false, error: "unknownError" };
  const base = { gym_id: gymId, user_id: viewer.userId, source: "MANUAL" as const, discipline: "BOARD" as const, board: v.board,
    board_layout: v.layout || null, board_angle: v.angle };

  if (v.past) {
    const startedAt = zonedToUtc(v.past.date, v.past.time);
    if (Number.isNaN(startedAt.getTime()) || startedAt.getTime() > Date.now() || startedAt.getFullYear() < 2000) {
      return { ok: false, error: "invalidDate" };
    }
    const endedAt = new Date(Math.min(startedAt.getTime() + v.past.minutes * 60_000, Date.now()));
    const { data, error } = await viewer.supabase.from("sessions").insert({
      ...base, started_at: startedAt.toISOString(), ended_at: endedAt.toISOString(),
      duration_minutes: Math.max(1, Math.round((endedAt.getTime() - startedAt.getTime()) / 60_000)),
    }).select("id").single();
    if (error || !data) return { ok: false, error: "unknownError" };
    revalidatePath("/", "layout");
    return { ok: true, data: { sessionId: data.id } };
  }

  const { data, error } = await viewer.supabase.from("sessions").insert(base).select("id").single();
  if (error) {
    // One live séance per climber: resume it instead.
    if (error.code === "23505") {
      const { data: live } = await viewer.supabase.from("sessions").select("id").is("ended_at", null).maybeSingle();
      if (live) return { ok: true, data: { sessionId: live.id } };
    }
    return { ok: false, error: "unknownError" };
  }
  if (v.gymId) await viewer.supabase.from("favourite_gyms").upsert({ user_id: viewer.userId, gym_id: v.gymId });
  revalidatePath("/", "layout");
  return { ok: true, data: { sessionId: data.id } };
}

async function boardSession(viewer: Viewer, sessionId: string) {
  const { data } = await viewer.supabase.from("sessions").select("id, discipline, board, started_at, ended_at")
    .eq("id", sessionId).maybeSingle();
  return data && data.discipline === "BOARD" && data.board ? { ...data, board: data.board as Board } : null;
}

/** The angle the board is set at for the next climbs (each climb keeps its own). */
export async function setBoardAngle(sessionId: string, angle: number): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!id.safeParse(sessionId).success) return { ok: false, error: "invalid" };
  const session = await boardSession(viewer, sessionId);
  if (!session || !boardAngles(session.board).includes(angle)) return { ok: false, error: "invalid" };
  const { error } = await viewer.supabase.from("sessions").update({ board_angle: angle }).eq("id", sessionId);
  return error ? { ok: false, error: "unknownError" } : { ok: true };
}

/**
 * Logs one climb. Sending the same tap again (same clientId, e.g. after a lost
 * connection) returns the climb already stored. A sent climb closes its open
 * project; a climb not sent yet can be kept as a project.
 */
export async function logBoardAscent(input: unknown): Promise<ActionResult<{ ascent: BoardAscentRow }>> {
  const viewer = await requireViewer();
  const parsed = logBoardAscentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const session = await boardSession(viewer, v.sessionId);
  if (!session) return { ok: false, error: "notFound" };
  const key = climbKey(v.climbName);
  if (!key) return { ok: false, error: "invalid" };

  // A climb of a finished séance is dated inside it.
  const now = Date.now();
  const end = session.ended_at ? new Date(session.ended_at).getTime() : now;
  const climbedAt = new Date(Math.max(new Date(session.started_at).getTime(), Math.min(now, end))).toISOString();

  const { data, error } = await viewer.supabase.from("board_ascents").insert({
    session_id: v.sessionId, client_id: v.clientId, board: session.board, climb_name: v.climbName, climb_key: key,
    angle: v.angle, grade: v.grade, grade_scale: v.gradeScale, tries: v.tries, result: v.result,
    is_benchmark: v.isBenchmark, is_mirror: v.isMirror, notes: v.notes, climbed_at: climbedAt, source: "MANUAL",
  }).select(BOARD_ASCENT_COLUMNS).single();
  const ascent = data as BoardAscentRow | null;
  if (error) {
    if (error.code !== "23505") return { ok: false, error: "unknownError" };
    const { data: existing } = await viewer.supabase.from("board_ascents").select(BOARD_ASCENT_COLUMNS)
      .eq("client_id", v.clientId).maybeSingle();
    if (!existing) return { ok: false, error: "unknownError" };
    return { ok: true, data: { ascent: existing as BoardAscentRow } };
  }
  if (!ascent) return { ok: false, error: "unknownError" };

  if (isBoardSend(v.result)) {
    await viewer.supabase.from("board_projects").update({ status: "SENT", sent_at: climbedAt })
      .eq("board", session.board).eq("climb_key", key).eq("angle", v.angle).eq("status", "ACTIVE");
  } else if (v.asProject) {
    await viewer.supabase.from("board_projects").upsert({
      user_id: viewer.userId, board: session.board, climb_name: v.climbName, climb_key: key, angle: v.angle,
      grade: v.grade, grade_scale: v.gradeScale,
    }, { onConflict: "user_id,board,climb_key,angle", ignoreDuplicates: true });
  }
  revalidatePath("/projects");
  return { ok: true, data: { ascent } };
}

export async function updateBoardAscent(input: unknown): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = updateBoardAscentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { id: ascentId, ...patch } = parsed.data;
  const { data: row } = await viewer.supabase.from("board_ascents").select("tries, result").eq("id", ascentId).maybeSingle();
  if (!row) return { ok: false, error: "notFound" };
  const tries = patch.tries ?? row.tries, result = patch.result ?? row.result;
  if (result === "FLASH" && tries !== 1) return { ok: false, error: "invalid" };
  const { error } = await viewer.supabase.from("board_ascents").update(patch).eq("id", ascentId);
  return error ? { ok: false, error: "unknownError" } : { ok: true };
}

export async function deleteBoardAscent(ascentId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!id.safeParse(ascentId).success) return { ok: false, error: "invalid" };
  const { error } = await viewer.supabase.from("board_ascents").delete().eq("id", ascentId);
  return error ? { ok: false, error: "unknownError" } : { ok: true };
}

/* ───────────── Board projects ───────────── */

export async function createBoardProject(input: unknown): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = boardProjectSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const v = parsed.data;
  const key = climbKey(v.climbName);
  if (!key) return { ok: false, error: "invalid" };
  const { error } = await viewer.supabase.from("board_projects").insert({
    user_id: viewer.userId, board: v.board, climb_name: v.climbName, climb_key: key, angle: v.angle, grade: v.grade, grade_scale: v.gradeScale,
  });
  if (error) return { ok: false, error: error.code === "23505" ? "duplicate" : "unknownError" };
  revalidatePath("/projects");
  return { ok: true };
}

export async function setBoardProjectStatus(projectId: string, status: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!id.safeParse(projectId).success || !(BOARD_PROJECT_STATUSES as readonly string[]).includes(status)) return { ok: false, error: "invalid" };
  const { error } = await viewer.supabase.from("board_projects")
    .update({ status: status as (typeof BOARD_PROJECT_STATUSES)[number], sent_at: status === "SENT" ? new Date().toISOString() : null }).eq("id", projectId);
  if (error) return { ok: false, error: "unknownError" };
  revalidatePath("/projects");
  return { ok: true };
}

export async function deleteBoardProject(projectId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!id.safeParse(projectId).success) return { ok: false, error: "invalid" };
  const { error } = await viewer.supabase.from("board_projects").delete().eq("id", projectId);
  if (error) return { ok: false, error: "unknownError" };
  revalidatePath("/projects");
  return { ok: true };
}

/* ───────────── BoardLib import ───────────── */

export type ImportResult = { added: number; skipped: number; sessions: number };

/**
 * Imports lines read from a BoardLib logbook file. Each day and board becomes
 * one finished board séance at home (found again on the next import), and a
 * line already imported is skipped, so importing the same file twice adds nothing.
 */
export async function importBoardLogbook(input: unknown): Promise<ActionResult<ImportResult>> {
  const viewer = await requireViewer();
  const parsed = importBoardLogbookSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const rows = parsed.data.rows as BoardLibRow[];
  const home = await homeBoardGymId(viewer.supabase);
  if (!home) return { ok: false, error: "unknownError" };

  // Lines already stored are skipped.
  const known = new Set<string>();
  const refs = rows.map((r) => r.ref);
  for (let i = 0; i < refs.length; i += 100) {
    const { data, error } = await viewer.supabase.from("board_ascents").select("external_ref").in("external_ref", refs.slice(i, i + 100));
    if (error) return { ok: false, error: "unknownError" };
    for (const d of data ?? []) if (d.external_ref) known.add(d.external_ref);
  }
  const fresh = rows.filter((r) => !known.has(r.ref));

  const groups = new Map<string, BoardLibRow[]>();
  for (const r of fresh) groups.set(`${r.date}|${r.board}`, [...(groups.get(`${r.date}|${r.board}`) ?? []), r]);

  let added = 0, sessions = 0;
  for (const [, day] of groups) {
    const { date, board } = day[0];
    const times = day.map((r) => zonedToUtc(r.date, r.time).getTime()).filter((t) => !Number.isNaN(t));
    if (!times.length) continue;
    const first = Math.min(...times), last = Math.max(...times);
    const dayStart = zonedToUtc(date, "00:00").toISOString(), dayEnd = new Date(zonedToUtc(date, "00:00").getTime() + 86_400_000).toISOString();
    // The séance of that day on that board, if one exists already (imported or logged).
    const { data: existing } = await viewer.supabase.from("sessions").select("id, started_at, ended_at")
      .eq("discipline", "BOARD").eq("board", board).not("ended_at", "is", null)
      .gte("started_at", dayStart).lt("started_at", dayEnd).order("started_at").limit(1).maybeSingle();
    let sessionId = existing?.id ?? null;
    if (!sessionId) {
      const angles = day.map((r) => r.angle);
      const angle = angles.sort((a, b) => angles.filter((x) => x === b).length - angles.filter((x) => x === a).length)[0];
      const endedAt = Math.min(Math.max(last, first + 60_000), Date.now());
      const { data, error } = await viewer.supabase.from("sessions").insert({
        gym_id: home, user_id: viewer.userId, source: "IMPORT", discipline: "BOARD", board, board_angle: angle,
        started_at: new Date(first).toISOString(), ended_at: new Date(endedAt).toISOString(),
        duration_minutes: Math.max(1, Math.round((endedAt - first) / 60_000)),
      }).select("id").single();
      if (error || !data) return { ok: false, error: "unknownError" };
      sessionId = data.id;
      sessions += 1;
    }
    const { data: inserted, error } = await viewer.supabase.from("board_ascents").insert(day.map((r) => ({
      session_id: sessionId!, client_id: crypto.randomUUID(), board: r.board, climb_name: r.name, climb_key: climbKey(r.name),
      angle: r.angle, grade: r.grade, grade_scale: r.gradeScale, tries: r.tries, result: r.result,
      is_benchmark: r.isBenchmark, is_mirror: r.isMirror, notes: r.notes,
      climbed_at: zonedToUtc(r.date, r.time).toISOString(), source: "BOARDLIB", external_ref: r.ref,
    }))).select("id");
    if (error) return { ok: false, error: "unknownError" };
    added += inserted?.length ?? 0;
  }
  revalidatePath("/", "layout");
  return { ok: true, data: { added, skipped: rows.length - fresh.length, sessions } };
}
