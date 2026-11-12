import "server-only";
import type { Viewer } from "@/lib/auth/viewer";
import {
  clampTime,
  numberAttempts,
  type Attempt,
  type BoulderOp,
  type LiveProblemItem,
  type OpResult,
} from "@/lib/climbing/offline-session";
import { isSend, type GradeSystem, type StyleTag, type WallAngle } from "@/lib/climbing/types";
import { acceptsBoulderSystem, gymScales, isValidGrade } from "@/lib/grading";
import type { Tables } from "@/lib/supabase/database.types";
import type { ActionResult } from "@/lib/validation/common";

/*
 * Server side of the logging actions, shared by the one-tap actions
 * (lib/actions/sessions.ts) and the offline queue (lib/actions/session-sync.ts).
 * Every function here runs as the climber: RLS applies.
 */

/* ───────────── Shared cores ───────────── */

export type ProblemPatch = {
  problemId: string;
  name?: string | null;
  wallAngle?: WallAngle;
  wallZone?: string | null;
  setter?: string | null;
  notes?: string | null;
  beta?: string | null;
  topoRef?: string | null;
  topoUrl?: string | null;
  nativeGrade?: string;
  tags?: StyleTag[];
  estimate?: { grade: string; confidence: number } | null;
};

/** Edits a boulder (validated input). Returns notFound / invalidGrade / invalid / unknownError. */
export async function patchProblem(viewer: Viewer, v: ProblemPatch): Promise<ActionResult> {
  const { data: problem } = await viewer.supabase
    .from("problems").select("native_grade_system, outdoor_problem_id").eq("id", v.problemId).maybeSingle();
  if (!problem) return { ok: false, error: "notFound" };

  const patch: Partial<Tables<"problems">> = {};
  if (v.name !== undefined) patch.name = v.name || null;
  if (v.wallAngle !== undefined) patch.wall_angle = v.wallAngle;
  if (v.wallZone !== undefined) patch.wall_zone = v.wallZone || null;
  if (v.setter !== undefined) patch.setter = v.setter || null;
  if (v.notes !== undefined) patch.notes = v.notes?.trim() || null;
  if (v.beta !== undefined) patch.beta = v.beta?.trim() || null;
  if (v.topoRef !== undefined) patch.topo_ref = v.topoRef || null;
  if (v.topoUrl !== undefined) patch.topo_url = v.topoUrl || null;
  if (v.nativeGrade !== undefined) {
    // Topo boulders too: the climber may disagree with the topo's grade.
    if (!isValidGrade(problem.native_grade_system as GradeSystem, v.nativeGrade)) return { ok: false, error: "invalidGrade" };
    patch.native_grade = v.nativeGrade;
  }
  if (v.estimate !== undefined) {
    if (problem.native_grade_system === "FONT") return { ok: false, error: "invalid" };
    if (v.estimate === null) {
      Object.assign(patch, {
        normalized_grade: null,
        normalized_grade_system: null,
        normalization_confidence: null,
        normalization_source: null,
      });
    } else {
      if (!isValidGrade("FONT", v.estimate.grade)) return { ok: false, error: "invalidGrade" };
      Object.assign(patch, {
        normalized_grade: v.estimate.grade,
        normalized_grade_system: "FONT",
        normalization_confidence: Math.round(v.estimate.confidence * 100) / 100,
        normalization_source: "USER_ESTIMATE",
      });
    }
  }
  if (Object.keys(patch).length) {
    const { error } = await viewer.supabase.from("problems").update(patch).eq("id", v.problemId);
    if (error) return { ok: false, error: "unknownError" };
  }
  if (v.tags) {
    const { data: tagRows } = await viewer.supabase.from("tags").select("id, slug").in("slug", v.tags);
    await viewer.supabase.from("problem_tags").delete().eq("problem_id", v.problemId);
    if (tagRows?.length) {
      const { error } = await viewer.supabase
        .from("problem_tags")
        .insert(tagRows.map((t) => ({ problem_id: v.problemId, tag_id: t.id })));
      if (error) return { ok: false, error: "unknownError" };
    }
  }
  return { ok: true };
}

/**
 * Takes boulders out of a session in one transaction, then removes the stored
 * photos and videos of the boulders that were deleted with it.
 */
export async function removeProblemsCore(
  viewer: Viewer,
  sessionId: string,
  problemIds: string[],
): Promise<ActionResult<{ removed: number; problemsDeleted: string[]; projectsDeleted: string[] }>> {
  // Read first: the media rows go with the boulder (on delete cascade), the stored files do not.
  const { data: media } = await viewer.supabase.from("media").select("problem_id, storage_path, thumbnail_path").in("problem_id", problemIds);
  const { data, error } = await viewer.supabase.rpc("remove_problems_from_session", { p_session_id: sessionId, p_problem_ids: problemIds });
  if (error) return { ok: false, error: error.code === "P0002" ? "notFound" : "unknownError" };
  const r = (data ?? {}) as { removed?: number; problems_deleted?: string[]; projects_deleted?: string[] };
  const problemsDeleted = r.problems_deleted ?? [];
  const gone = new Set(problemsDeleted);
  const paths = (media ?? []).filter((m) => m.problem_id && gone.has(m.problem_id))
    .flatMap((m) => [m.storage_path, m.thumbnail_path]).filter((p): p is string => Boolean(p));
  if (paths.length) await viewer.supabase.storage.from("media").remove(paths);
  return { ok: true, data: { removed: r.removed ?? 0, problemsDeleted, projectsDeleted: r.projects_deleted ?? [] } };
}

/**
 * Ends a session, at `at` when given (ended on the phone without signal, sent
 * later), otherwise now. The watch's times win when an activity is linked.
 */
export async function endSessionCore(viewer: Viewer, sessionId: string, at?: string): Promise<ActionResult> {
  const { data: s } = await viewer.supabase
    .from("sessions").select("started_at, ended_at, wearable_activity_id").eq("id", sessionId).maybeSingle();
  if (!s) return { ok: false, error: "notFound" };
  if (s.ended_at) return { ok: true };
  const now = Date.now();
  const end = new Date(at ? clampTime(at, s.started_at, null, now) : new Date(now).toISOString());
  const minutes = Math.max(0, Math.round((end.getTime() - new Date(s.started_at).getTime()) / 60_000));
  const { error } = await viewer.supabase
    .from("sessions")
    .update({ ended_at: end.toISOString(), duration_minutes: Math.min(minutes, 1440) })
    .eq("id", sessionId);
  if (error) return { ok: false, error: "unknownError" };
  // Without usable watch timing, the clock times above stay (the call fails quietly).
  if (s.wearable_activity_id) await viewer.supabase.rpc("apply_activity_timing", { p_session_id: sessionId });
  return { ok: true };
}

/* ───────────── Queued operations ───────────── */

export type SyncSession = {
  id: string;
  gym_id: string;
  discipline: string;
  started_at: string;
  ended_at: string | null;
  gyms: { grading_system: string; former_grading_systems: string[] | null; grading_system_since: string | null; has_bouldering: boolean } | null;
};

export const SYNC_SESSION_COLUMNS =
  "id, gym_id, discipline, started_at, ended_at, gyms(grading_system, former_grading_systems, grading_system_since, has_bouldering)";

/** A database error worth trying again later (the queue stops there). */
export const RETRY = "retry" as const;

const PROBLEM_COLUMNS = "id, native_grade, native_grade_system, notes, wall_angle, created_at, name, outdoor_problem_id";

function asItem(p: Pick<Tables<"problems">, "id" | "native_grade" | "native_grade_system" | "notes" | "wall_angle" | "created_at" | "name" | "outdoor_problem_id">): LiveProblemItem {
  return {
    id: p.id, native_grade: p.native_grade, native_grade_system: p.native_grade_system as GradeSystem, notes: p.notes,
    wall_angle: p.wall_angle as WallAngle, tags: [], created_at: p.created_at, name: p.name, outdoor_problem_id: p.outdoor_problem_id,
  };
}

function plusMs(iso: string, ms: number) {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}

const isPkeyClash = (e: { code?: string; message?: string; details?: string } | null) =>
  e?.code === "23505" && /_pkey/.test(`${e.message ?? ""} ${e.details ?? ""}`);

/**
 * Applies one queued operation. Safe to run twice: whatever is already stored
 * (same ids) is returned as it is. `RETRY` means a database error: stop and
 * send the rest later.
 */
export async function applyQueuedOp(
  viewer: Viewer,
  session: SyncSession,
  op: BoulderOp,
): Promise<OpResult | typeof RETRY> {
  const sb = viewer.supabase;
  const ok = (extra: Omit<Extract<OpResult, { ok: true }>, "opId" | "ok"> = {}): OpResult => ({ opId: op.opId, ok: true, ...extra });
  const no = (error: string): OpResult => ({ opId: op.opId, ok: false, error });
  const at = (iso: string) => clampTime(iso, session.started_at, session.ended_at, Date.now());

  switch (op.kind) {
    case "createProblem": {
      const { data: found } = await sb.from("problems").select(PROBLEM_COLUMNS).eq("id", op.problemId).maybeSingle();
      if (found) return ok({ problem: asItem(found) });
      if (!session.gyms?.has_bouldering) return no("invalid");
      if (!acceptsBoulderSystem(gymScales(session.gyms), op.system as GradeSystem)) return no("invalid");
      if (!isValidGrade(op.system as GradeSystem, op.grade)) return no("invalidGrade");
      const { data, error } = await sb.from("problems").insert({
        id: op.problemId, gym_id: session.gym_id, created_by: viewer.userId,
        native_grade: op.grade, native_grade_system: op.system, wall_angle: "UNKNOWN",
        name: op.name || null, wall_zone: op.sector || null, notes: op.notes?.trim() || null, created_at: at(op.at),
      }).select(PROBLEM_COLUMNS).single();
      if (isPkeyClash(error)) {
        const { data: again } = await sb.from("problems").select(PROBLEM_COLUMNS).eq("id", op.problemId).maybeSingle();
        return again ? ok({ problem: asItem(again) }) : no("invalid");
      }
      if (error?.code === "23514" || error?.code === "P0001") return no("invalid");
      if (error || !data) return RETRY;
      return ok({ problem: asItem(data) });
    }

    case "pickTopo": {
      const { data: topo } = await sb.from("outdoor_problems")
        .select("id, name, grade, wall_angle, outdoor_areas!inner(gym_id)").eq("id", op.outdoorProblemId).maybeSingle();
      if (!topo) return no("notFound");
      if (topo.outdoor_areas.gym_id !== session.gym_id) return no("invalid");
      const existing = async () => (await sb.from("problems").select(PROBLEM_COLUMNS)
        .eq("created_by", viewer.userId).eq("outdoor_problem_id", op.outdoorProblemId).maybeSingle()).data;
      const answer = (p: NonNullable<Awaited<ReturnType<typeof existing>>>) =>
        ok({ problem: asItem(p), ...(p.id !== op.problemId ? { renamed: { from: op.problemId, to: p.id } } : {}) });
      const found = await existing();
      if (found) return answer(found);
      const { data, error } = await sb.from("problems").insert({
        id: op.problemId, gym_id: session.gym_id, created_by: viewer.userId, name: topo.name.slice(0, 120),
        native_grade: topo.grade, native_grade_system: "FONT", wall_angle: topo.wall_angle,
        outdoor_problem_id: op.outdoorProblemId, created_at: at(op.at),
      }).select(PROBLEM_COLUMNS).single();
      if (error?.code === "23505") {
        // Picked at the same moment elsewhere, or this very operation already stored.
        const again = await existing();
        return again ? answer(again) : RETRY;
      }
      if (error || !data) return RETRY;
      return ok({ problem: asItem(data) });
    }

    case "attempts": {
      if (session.discipline !== "BOULDER") return no("invalid");
      const { data: problem } = await sb.from("problems").select("id, gym_id").eq("id", op.problemId).maybeSingle();
      if (!problem) return no("notFound");
      if (problem.gym_id !== session.gym_id) return no("invalid");
      const ids = op.items.map((i) => i.id);
      const { data: stored } = await sb.from("attempts").select("*").in("id", ids);
      const have = new Set((stored ?? []).map((a) => a.id));
      const fresh = op.items.filter((i) => !have.has(i.id));
      // Live: the time of the tap. Filling in a finished session afterwards: one second apart
      // from its start, inside it (as log_attempt() does).
      let when = (i: number) => at(plusMs(op.at, i));
      if (session.ended_at && Date.parse(op.at) > Date.parse(session.ended_at)) {
        const { count } = await sb.from("attempts").select("id", { count: "exact", head: true }).eq("session_id", session.id);
        const end = Date.parse(session.ended_at);
        const start = Date.parse(session.started_at);
        when = (i: number) => new Date(Math.min(end, start + ((count ?? 0) + i + 1) * 1000)).toISOString();
      }
      let inserted: Attempt[] = [];
      for (let round = 0; fresh.length && round < 3; round++) {
        const { data: last } = await sb.from("attempts").select("attempt_number")
          .eq("problem_id", op.problemId).eq("user_id", viewer.userId)
          .order("attempt_number", { ascending: false }).limit(1).maybeSingle();
        const numbers = numberAttempts(last?.attempt_number ?? 0, fresh.map((i) => i.result));
        if (numbers === "flashOnlyFirst") return no("flashOnlyFirst");
        const rows = fresh.map((item, i) => ({
          id: item.id, session_id: session.id, problem_id: op.problemId, user_id: viewer.userId,
          attempt_number: numbers[i], result: item.result, created_at: when(i),
        }));
        const { data, error } = await sb.from("attempts").insert(rows).select("*");
        if (!error && data) { inserted = data; break; }
        if (isPkeyClash(error)) {
          // The same operation stored by a request that did not answer: take what is there.
          const { data: again } = await sb.from("attempts").select("*").in("id", ids);
          return ok({ attempts: again ?? [] });
        }
        if (error?.code === "23505") continue; // another try got this number first: number again
        if (error?.code === "23514") return no("flashOnlyFirst");
        return RETRY;
      }
      if (fresh.length && !inserted.length) return RETRY;
      // A send closes an active project on that boulder.
      const send = inserted.filter((a) => isSend(a.result)).at(-1);
      if (send) {
        await sb.from("projects").update({ status: "SENT", completed_at: send.created_at })
          .eq("problem_id", op.problemId).eq("status", "ACTIVE");
      }
      return ok({ attempts: [...(stored ?? []), ...inserted].sort((a, b) => a.attempt_number - b.attempt_number) });
    }

    case "project": {
      const { data: problem } = await sb.from("problems").select("id").eq("id", op.problemId).maybeSingle();
      if (!problem) return no("notFound");
      const { data: existing } = await sb.from("projects").select("id").eq("problem_id", op.problemId).maybeSingle();
      if (existing) return ok();
      const { error } = await sb.from("projects").insert({ problem_id: op.problemId, user_id: viewer.userId, session_id: session.id });
      if (error && error.code !== "23505") return RETRY;
      return ok();
    }

    case "updateProblem": {
      const res = await patchProblem(viewer, {
        problemId: op.problemId, notes: op.notes, wallAngle: op.wallAngle, tags: op.tags, nativeGrade: op.nativeGrade,
      });
      if (!res.ok) return res.error === "unknownError" ? RETRY : no(res.error);
      if (op.nativeGrade === undefined) return ok();
      const { data } = await sb.from("problems").select(PROBLEM_COLUMNS).eq("id", op.problemId).maybeSingle();
      return ok(data ? { problem: asItem(data) } : {});
    }

    case "correctAttempt": {
      const { data, error } = await sb.from("attempts").update({ result: op.result }).eq("id", op.attemptId).select("*").maybeSingle();
      if (error) return error.code === "23514" ? no("flashOnlyFirst") : RETRY;
      if (!data) return no("notFound");
      if (isSend(data.result)) {
        await sb.from("projects").update({ status: "SENT", completed_at: data.created_at })
          .eq("problem_id", data.problem_id).eq("status", "ACTIVE");
      }
      return ok({ attempts: [data] });
    }

    case "deleteAttempt": {
      const { data: a } = await sb.from("attempts").select("problem_id, attempt_number").eq("id", op.attemptId).maybeSingle();
      if (!a) return ok(); // already gone
      const { data: latest } = await sb.from("attempts").select("id").eq("problem_id", a.problem_id)
        .order("attempt_number", { ascending: false }).limit(1).maybeSingle();
      if (latest?.id !== op.attemptId) return no("notLatest");
      const { error } = await sb.from("attempts").delete().eq("id", op.attemptId);
      return error ? RETRY : ok();
    }

    case "remove": {
      // Boulders already gone (an earlier send of this operation) are skipped.
      const { data: still } = await sb.from("problems").select("id").in("id", op.problemIds);
      const ids = (still ?? []).map((p) => p.id);
      if (!ids.length) return ok();
      const res = await removeProblemsCore(viewer, session.id, ids);
      if (!res.ok) return res.error === "notFound" ? no("notFound") : RETRY;
      return ok();
    }

    case "scale": {
      if (session.discipline !== "BOULDER" || !session.gyms || !acceptsBoulderSystem(gymScales(session.gyms), op.system as GradeSystem)) {
        return no("invalid");
      }
      const { error } = await sb.from("sessions").update({ grade_system: op.system }).eq("id", session.id);
      return error ? RETRY : ok();
    }

    case "end": {
      const res = await endSessionCore(viewer, session.id, op.at);
      if (!res.ok) return res.error === "notFound" ? no("notFound") : RETRY;
      return ok();
    }
  }
}
