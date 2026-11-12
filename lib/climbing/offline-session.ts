/**
 * Offline boulder logging.
 *
 * Every change made in a live boulder session is an operation. It is applied
 * to the screen at once (this reducer, which mirrors the server's rules), kept
 * on the phone, and sent to the server in order whenever there is signal
 * (lib/actions/session-sync.ts). Ids are made on the phone, so an operation
 * sent twice never logs anything twice.
 *
 * Pure: no React, no storage, no network. Unit-tested in tests/unit.
 */
import { z } from "zod";
import type { Tables } from "@/lib/supabase/database.types";
import {
  ATTEMPT_RESULTS,
  GRADE_SYSTEMS,
  STYLE_TAGS,
  WALL_ANGLES,
  isSend,
  type AttemptResult,
  type GradeSystem,
  type StyleTag,
  type WallAngle,
} from "./types";

export type Attempt = Tables<"attempts">;

export type LiveProblemItem = {
  id: string;
  native_grade: string;
  /** The scale the problem was logged with (may predate a change of the gym's scale). */
  native_grade_system?: GradeSystem;
  notes?: string | null;
  wall_angle: WallAngle;
  tags: StyleTag[];
  created_at: string;
  name: string | null;
  outdoor_problem_id: number | null;
};

/** One of the climber's own topo boulders at this site, tried before and not in the lists. */
export type KnownBoulder = { id: string; grade: string; name: string | null; tries: number; lastNumber: number };

export type BoulderState = {
  problems: LiveProblemItem[];
  /** Every try on the boulders shown (this session's and older ones). */
  attempts: Attempt[];
  /** Active projects. */
  projectIds: string[];
  /** Projects opened in this session (any status). */
  openedHere: string[];
  /** The scale new boulders are logged in. */
  scale: GradeSystem;
  /** Set when the session was ended on this phone. */
  endedAt: string | null;
  /** Topo id → the climber's boulder for it, when tried in another session. */
  known: Record<string, KnownBoulder>;
};

export type BoulderCtx = { sessionId: string; userId: string };

/* ───────────── Operations ───────────── */

const base = { opId: z.guid(), at: z.iso.datetime() };
const notes = z.string().max(2000).nullable();

export const boulderOpSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("createProblem"), ...base, problemId: z.guid(),
    grade: z.string().min(1).max(10), system: z.enum(GRADE_SYSTEMS),
    name: z.string().trim().max(120).optional(), sector: z.string().trim().max(80).optional(), notes: notes.optional(),
  }).strict(),
  z.object({
    // Find or create the climber's boulder for a topo boulder. Name and grade are for the screen;
    // the server takes them from the topo.
    kind: z.literal("pickTopo"), ...base, problemId: z.guid(), outdoorProblemId: z.number().int().positive(),
    name: z.string().max(200), grade: z.string().min(1).max(10), wallAngle: z.enum(WALL_ANGLES).optional(),
  }).strict(),
  z.object({
    kind: z.literal("attempts"), ...base, problemId: z.guid(),
    items: z.array(z.object({ id: z.guid(), result: z.enum(ATTEMPT_RESULTS) }).strict()).min(1).max(50),
  }).strict(),
  z.object({ kind: z.literal("project"), ...base, problemId: z.guid() }).strict(),
  z.object({
    kind: z.literal("updateProblem"), ...base, problemId: z.guid(),
    notes: notes.optional(), wallAngle: z.enum(WALL_ANGLES).optional(),
    tags: z.array(z.enum(STYLE_TAGS)).max(12).optional(), nativeGrade: z.string().min(1).max(10).optional(),
  }).strict(),
  z.object({ kind: z.literal("correctAttempt"), ...base, attemptId: z.guid(), result: z.enum(ATTEMPT_RESULTS) }).strict(),
  z.object({ kind: z.literal("deleteAttempt"), ...base, attemptId: z.guid() }).strict(),
  z.object({ kind: z.literal("remove"), ...base, problemIds: z.array(z.guid()).min(1).max(200) }).strict(),
  z.object({ kind: z.literal("scale"), ...base, system: z.enum(GRADE_SYSTEMS) }).strict(),
  z.object({ kind: z.literal("end"), ...base }).strict(),
]);

export type BoulderOp = z.infer<typeof boulderOpSchema>;
export type BoulderOpKind = BoulderOp["kind"];
/** An operation without its id and time (filled in when it is queued). */
export type NewBoulderOp = BoulderOp extends infer O ? (O extends BoulderOp ? Omit<O, "opId" | "at"> : never) : never;

export const syncInputSchema = z.object({ sessionId: z.guid(), ops: z.array(boulderOpSchema).min(1).max(50) }).strict();

/** What the server says about one operation. */
export type OpResult =
  | {
      opId: string;
      ok: true;
      /** The rows as stored (attempt numbers and times are the server's). */
      attempts?: Attempt[];
      problem?: LiveProblemItem;
      /** A topo boulder the climber already had on the server under another id. */
      renamed?: { from: string; to: string };
    }
  | { opId: string; ok: false; error: string };

export type SyncResponse = {
  results: OpResult[];
  /** True when the server stopped early (a database error): the rest is sent again later. */
  stopped: boolean;
};

/* ───────────── Helpers ───────────── */

export function knownFor(state: BoulderState, problemId: string): KnownBoulder | undefined {
  for (const k of Object.values(state.known)) if (k.id === problemId) return k;
  return undefined;
}

/** The number the next try on a boulder gets (tries count across sessions). */
export function nextAttemptNumber(state: BoulderState, problemId: string): number {
  let last = knownFor(state, problemId)?.lastNumber ?? 0;
  for (const a of state.attempts) if (a.problem_id === problemId && a.attempt_number > last) last = a.attempt_number;
  return last + 1;
}

export function canFlash(state: BoulderState, problemId: string): boolean {
  return nextAttemptNumber(state, problemId) === 1;
}

/** Tries on a boulder outside this session (shown ones, plus older ones not loaded). */
export function triesElsewhere(state: BoulderState, problemId: string, ctx: BoulderCtx): number {
  const shown = state.attempts.filter((a) => a.problem_id === problemId && a.session_id !== ctx.sessionId).length;
  return shown + (knownFor(state, problemId)?.tries ?? 0);
}

/** The problem ids an operation creates or depends on (to hide links to boulders not sent yet). */
export function createdProblemId(op: BoulderOp): string | null {
  return op.kind === "createProblem" || op.kind === "pickTopo" ? op.problemId : null;
}

function plusMs(iso: string, ms: number) {
  return new Date(new Date(iso).getTime() + ms).toISOString();
}

/* ───────────── Rules ───────────── */

/**
 * Whether an operation can be applied now. Mirrors what the server refuses, so
 * the screen never shows something that will be rejected later.
 */
export function checkBoulderOp(state: BoulderState, op: BoulderOp): "ended" | "notFound" | "flashOnlyFirst" | "notLatest" | null {
  if (state.endedAt && op.kind !== "end") return "ended";
  const hasProblem = (id: string) => state.problems.some((p) => p.id === id);
  switch (op.kind) {
    case "attempts": {
      if (!hasProblem(op.problemId)) return "notFound";
      const known = new Set(state.attempts.map((a) => a.id));
      let n = nextAttemptNumber(state, op.problemId);
      for (const item of op.items) {
        if (known.has(item.id)) continue;
        if (item.result === "FLASH" && n !== 1) return "flashOnlyFirst";
        n += 1;
      }
      return null;
    }
    case "project":
    case "updateProblem":
      return hasProblem(op.problemId) ? null : "notFound";
    case "correctAttempt": {
      const a = state.attempts.find((x) => x.id === op.attemptId);
      if (!a) return "notFound";
      return op.result === "FLASH" && a.attempt_number !== 1 ? "flashOnlyFirst" : null;
    }
    case "deleteAttempt": {
      const a = state.attempts.find((x) => x.id === op.attemptId);
      if (!a) return null; // already gone: nothing to do
      const latest = Math.max(...state.attempts.filter((x) => x.problem_id === a.problem_id).map((x) => x.attempt_number));
      return a.attempt_number === latest ? null : "notLatest";
    }
    default:
      return null;
  }
}

/**
 * Applies an operation to the screen state. Idempotent: applying an operation
 * that is already reflected (e.g. queued again on top of the server's data)
 * changes nothing.
 */
export function applyBoulderOp(state: BoulderState, op: BoulderOp, ctx: BoulderCtx): BoulderState {
  switch (op.kind) {
    case "createProblem": {
      if (state.problems.some((p) => p.id === op.problemId)) return state;
      return {
        ...state,
        problems: [...state.problems, {
          id: op.problemId, native_grade: op.grade, native_grade_system: op.system, notes: op.notes?.trim() || null,
          wall_angle: "UNKNOWN", tags: [], created_at: op.at, name: op.name || null, outdoor_problem_id: null,
        }],
      };
    }
    case "pickTopo": {
      if (state.problems.some((p) => p.id === op.problemId || p.outdoor_problem_id === op.outdoorProblemId)) return state;
      const known = state.known[String(op.outdoorProblemId)];
      return {
        ...state,
        problems: [...state.problems, {
          id: op.problemId, native_grade: known?.grade ?? op.grade, native_grade_system: "FONT", notes: null,
          wall_angle: op.wallAngle ?? "UNKNOWN", tags: [], created_at: op.at, name: op.name.slice(0, 120),
          outdoor_problem_id: op.outdoorProblemId,
        }],
      };
    }
    case "attempts": {
      const have = new Set(state.attempts.map((a) => a.id));
      const fresh = op.items.filter((item) => !have.has(item.id));
      if (!fresh.length) return state;
      let n = nextAttemptNumber(state, op.problemId);
      const rows: Attempt[] = fresh.map((item, i) => ({
        id: item.id, session_id: ctx.sessionId, problem_id: op.problemId, user_id: ctx.userId,
        attempt_number: n++, result: item.result, created_at: plusMs(op.at, i),
        notes: null, perceived_difficulty: null, started_at: null,
      }));
      // A send closes an active project on that boulder (as on the server).
      const sent = rows.some((r) => isSend(r.result));
      return {
        ...state,
        attempts: [...state.attempts, ...rows],
        projectIds: sent ? state.projectIds.filter((id) => id !== op.problemId) : state.projectIds,
      };
    }
    case "project": {
      if (state.projectIds.includes(op.problemId)) return state;
      return {
        ...state,
        projectIds: [...state.projectIds, op.problemId],
        openedHere: state.openedHere.includes(op.problemId) ? state.openedHere : [...state.openedHere, op.problemId],
      };
    }
    case "updateProblem": {
      return {
        ...state,
        problems: state.problems.map((p) => p.id !== op.problemId ? p : {
          ...p,
          ...(op.notes !== undefined ? { notes: op.notes?.trim() || null } : {}),
          ...(op.wallAngle !== undefined ? { wall_angle: op.wallAngle } : {}),
          ...(op.tags !== undefined ? { tags: op.tags } : {}),
          ...(op.nativeGrade !== undefined ? { native_grade: op.nativeGrade } : {}),
        }),
      };
    }
    case "correctAttempt":
      return { ...state, attempts: state.attempts.map((a) => (a.id === op.attemptId ? { ...a, result: op.result } : a)) };
    case "deleteAttempt":
      return state.attempts.some((a) => a.id === op.attemptId)
        ? { ...state, attempts: state.attempts.filter((a) => a.id !== op.attemptId) }
        : state;
    case "remove":
      return removeProblems(state, op.problemIds, ctx).state;
    case "scale":
      return { ...state, scale: op.system };
    case "end":
      return state.endedAt ? state : { ...state, endedAt: op.at };
  }
}

/**
 * Takes boulders out of the session, as remove_problem_from_session() does:
 * this session's tries go; a boulder with no try left anywhere goes too, with a
 * project opened in this session; the remaining tries are numbered 1..n again.
 */
export function removeProblems(state: BoulderState, problemIds: string[], ctx: BoulderCtx) {
  const out = new Set(problemIds.filter((id) => state.problems.some((p) => p.id === id)));
  const problemsDeleted: string[] = [];
  const projectsDeleted: string[] = [];
  let attempts = state.attempts.filter((a) => !(out.has(a.problem_id) && a.session_id === ctx.sessionId));
  for (const pid of out) {
    const left = triesElsewhere({ ...state, attempts }, pid, ctx);
    const projectGone = left === 0 && state.openedHere.includes(pid);
    if (projectGone) projectsDeleted.push(pid);
    const activeProject = state.projectIds.includes(pid) && !projectGone;
    if (left === 0 && !activeProject) problemsDeleted.push(pid);
    // Same renumbering as the database (a flash is always try 1).
    const rest = attempts.filter((a) => a.problem_id === pid).sort((a, b) => a.attempt_number - b.attempt_number);
    const offset = knownFor(state, pid)?.lastNumber ?? 0;
    const numbers = new Map(rest.map((a, i) => [a.id, offset + i + 1]));
    attempts = attempts.map((a) => (numbers.has(a.id) ? { ...a, attempt_number: numbers.get(a.id)! } : a));
  }
  const goneProjects = new Set(projectsDeleted);
  const stillProject = (pid: string) => state.projectIds.includes(pid) && !goneProjects.has(pid);
  return {
    state: {
      ...state,
      attempts,
      problems: state.problems.filter((p) => !problemsDeleted.includes(p.id) && !(out.has(p.id) && !stillProject(p.id))),
      projectIds: state.projectIds.filter((pid) => !goneProjects.has(pid) && !problemsDeleted.includes(pid)),
      openedHere: state.openedHere.filter((pid) => !goneProjects.has(pid) && !problemsDeleted.includes(pid)),
    },
    problemsDeleted,
    projectsDeleted,
  };
}

/** Replays queued operations on top of a state (e.g. fresh server data after a reload). */
export function replay(state: BoulderState, ops: BoulderOp[], ctx: BoulderCtx): BoulderState {
  return ops.reduce((s, op) => (checkBoulderOp(s, op) === null ? applyBoulderOp(s, op, ctx) : s), state);
}

/* ───────────── Server answers ───────────── */

/** A boulder the server already had under another id: use the server's id everywhere. */
export function renameProblem(state: BoulderState, from: string, to: string): BoulderState {
  if (from === to) return state;
  const swap = (id: string) => (id === from ? to : id);
  const already = state.problems.some((p) => p.id === to);
  return {
    ...state,
    problems: already
      ? state.problems.filter((p) => p.id !== from)
      : state.problems.map((p) => (p.id === from ? { ...p, id: to } : p)),
    attempts: state.attempts.map((a) => (a.problem_id === from ? { ...a, problem_id: to } : a)),
    projectIds: [...new Set(state.projectIds.map(swap))],
    openedHere: [...new Set(state.openedHere.map(swap))],
  };
}

export function renameInOps(ops: BoulderOp[], from: string, to: string): BoulderOp[] {
  return ops.map((op) => {
    if ("problemId" in op && op.problemId === from) return { ...op, problemId: to };
    if (op.kind === "remove" && op.problemIds.includes(from)) return { ...op, problemIds: op.problemIds.map((id) => (id === from ? to : id)) };
    return op;
  });
}

/** Takes the server's rows (numbers, times, grades) for what was just sent. */
export function reconcile(state: BoulderState, result: OpResult): BoulderState {
  if (!result.ok) return state;
  let next = state;
  if (result.renamed) next = renameProblem(next, result.renamed.from, result.renamed.to);
  if (result.attempts?.length) {
    const byId = new Map(result.attempts.map((a) => [a.id, a]));
    next = { ...next, attempts: next.attempts.map((a) => byId.get(a.id) ?? a) };
  }
  if (result.problem) {
    const p = result.problem;
    next = {
      ...next,
      problems: next.problems.map((x) => (x.id === p.id ? { ...x, native_grade: p.native_grade, native_grade_system: p.native_grade_system } : x)),
    };
  }
  return next;
}

/* ───────────── Server-side numbering ───────────── */

/** Numbers new tries after the last one, refusing a flash that would not be try 1. */
export function numberAttempts(last: number, results: AttemptResult[]): number[] | "flashOnlyFirst" {
  const numbers = results.map((_, i) => last + i + 1);
  return results.some((r, i) => r === "FLASH" && numbers[i] !== 1) ? "flashOnlyFirst" : numbers;
}

/** A time from the phone, kept inside the session (never before its start, never in the future). */
export function clampTime(at: string, startedAt: string, endedAt: string | null, now: number): string {
  const t = new Date(at).getTime();
  const lo = new Date(startedAt).getTime();
  const hi = Math.min(endedAt ? new Date(endedAt).getTime() : now, now);
  return new Date(Math.max(lo, Math.min(Number.isFinite(t) ? t : hi, hi))).toISOString();
}
