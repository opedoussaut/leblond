import { describe, expect, it } from "vitest";
import {
  applyBoulderOp,
  boulderOpSchema,
  canFlash,
  checkBoulderOp,
  clampTime,
  nextAttemptNumber,
  numberAttempts,
  reconcile,
  removeProblems,
  renameInOps,
  replay,
  syncInputSchema,
  type Attempt,
  type BoulderOp,
  type BoulderState,
} from "@/lib/climbing/offline-session";

const S = "00000000-0000-4000-8000-000000000001"; // this session
const OTHER = "00000000-0000-4000-8000-000000000002";
const U = "00000000-0000-4000-8000-0000000000aa";
const ctx = { sessionId: S, userId: U };
const P1 = "10000000-0000-4000-8000-000000000001";
const P2 = "10000000-0000-4000-8000-000000000002";
const K = "10000000-0000-4000-8000-0000000000kk".replace("kk", "99");
const at = "2026-11-12T10:00:00.000Z";
let n = 0;
const uid = () => `20000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const op = <T extends Omit<BoulderOp, "opId" | "at">>(o: T) => ({ opId: uid(), at, ...o }) as unknown as BoulderOp;

function attempt(problemId: string, number: number, result: Attempt["result"], sessionId = S): Attempt {
  return {
    id: uid(), session_id: sessionId, problem_id: problemId, user_id: U, attempt_number: number, result,
    created_at: at, notes: null, perceived_difficulty: null, started_at: null,
  };
}

function empty(): BoulderState {
  return { problems: [], attempts: [], projectIds: [], openedHere: [], scale: "FONT", endedAt: null, known: {} };
}

function withProblem(s: BoulderState, id = P1): BoulderState {
  return applyBoulderOp(s, op({ kind: "createProblem", problemId: id, grade: "6a", system: "FONT" }), ctx);
}

describe("offline boulder operations", () => {
  it("validates the operations sent to the server", () => {
    const good = op({ kind: "attempts", problemId: P1, items: [{ id: uid(), result: "TOP" }] });
    expect(boulderOpSchema.safeParse(good).success).toBe(true);
    expect(boulderOpSchema.safeParse({ ...good, extra: 1 }).success).toBe(false);
    expect(boulderOpSchema.safeParse({ ...good, at: "yesterday" }).success).toBe(false);
    expect(syncInputSchema.safeParse({ sessionId: S, ops: [] }).success).toBe(false);
  });

  it("numbers tries after the ones already there and refuses a late flash", () => {
    let s = withProblem(empty());
    expect(canFlash(s, P1)).toBe(true);
    s = applyBoulderOp(s, op({ kind: "attempts", problemId: P1, items: [{ id: uid(), result: "ATTEMPT" }, { id: uid(), result: "TOP" }] }), ctx);
    expect(s.attempts.map((a) => a.attempt_number)).toEqual([1, 2]);
    expect(nextAttemptNumber(s, P1)).toBe(3);
    expect(checkBoulderOp(s, op({ kind: "attempts", problemId: P1, items: [{ id: uid(), result: "FLASH" }] }))).toBe("flashOnlyFirst");
    expect(checkBoulderOp(s, op({ kind: "attempts", problemId: P2, items: [{ id: uid(), result: "TOP" }] }))).toBe("notFound");
  });

  it("counts a topo boulder's tries from other sessions", () => {
    const s0 = { ...empty(), known: { "42": { id: K, grade: "6b", name: "Le Toit", tries: 3, lastNumber: 3 } } };
    let s = applyBoulderOp(s0, op({ kind: "pickTopo", problemId: K, outdoorProblemId: 42, name: "Le Toit", grade: "6a+" }), ctx);
    expect(s.problems[0]).toMatchObject({ id: K, native_grade: "6b", outdoor_problem_id: 42 });
    expect(canFlash(s, K)).toBe(false);
    s = applyBoulderOp(s, op({ kind: "attempts", problemId: K, items: [{ id: uid(), result: "TOP" }] }), ctx);
    expect(s.attempts[0].attempt_number).toBe(4);
    // Taken out of the session: the older tries keep it.
    const r = removeProblems(s, [K], ctx);
    expect(r.problemsDeleted).toEqual([]);
    expect(r.state.attempts).toEqual([]);
  });

  it("is idempotent: replaying operations already applied changes nothing", () => {
    const ops = [
      op({ kind: "createProblem", problemId: P1, grade: "6a", system: "FONT" }),
      op({ kind: "attempts", problemId: P1, items: [{ id: uid(), result: "ATTEMPT" }] }),
      op({ kind: "project", problemId: P1 }),
    ];
    const once = replay(empty(), ops, ctx);
    const twice = replay(once, ops, ctx);
    expect(twice).toEqual(once);
    expect(once.projectIds).toEqual([P1]);
    expect(once.openedHere).toEqual([P1]);
  });

  it("closes an active project on a send", () => {
    let s = withProblem(empty());
    s = applyBoulderOp(s, op({ kind: "project", problemId: P1 }), ctx);
    s = applyBoulderOp(s, op({ kind: "attempts", problemId: P1, items: [{ id: uid(), result: "TOP" }] }), ctx);
    expect(s.projectIds).toEqual([]);
    expect(s.openedHere).toEqual([P1]);
  });

  it("only undoes the latest try", () => {
    let s = withProblem(empty());
    const [a1, a2] = [uid(), uid()];
    s = applyBoulderOp(s, op({ kind: "attempts", problemId: P1, items: [{ id: a1, result: "ATTEMPT" }, { id: a2, result: "ATTEMPT" }] }), ctx);
    expect(checkBoulderOp(s, op({ kind: "deleteAttempt", attemptId: a1 }))).toBe("notLatest");
    expect(checkBoulderOp(s, op({ kind: "deleteAttempt", attemptId: a2 }))).toBeNull();
    s = applyBoulderOp(s, op({ kind: "deleteAttempt", attemptId: a2 }), ctx);
    expect(s.attempts.map((a) => a.id)).toEqual([a1]);
  });

  it("removes boulders like the database: deleted when nothing is left, renumbered otherwise", () => {
    const s0 = withProblem(withProblem(empty(), P1), P2);
    const older = attempt(P2, 1, "ATTEMPT", OTHER);
    const s1: BoulderState = {
      ...s0,
      attempts: [older, attempt(P2, 2, "TOP"), attempt(P1, 1, "FLASH")],
      projectIds: [P1], openedHere: [P1],
    };
    const r = removeProblems(s1, [P1, P2], ctx);
    // P1: no try left, its project was opened here → both go.
    expect(r.projectsDeleted).toEqual([P1]);
    expect(r.problemsDeleted).toEqual([P1]);
    // P2: tried in another session → kept, its remaining try is #1.
    expect(r.state.problems.map((p) => p.id)).toEqual([]);
    expect(r.state.attempts).toEqual([{ ...older, attempt_number: 1 }]);
  });

  it("keeps a boulder whose project was opened in another session", () => {
    const s: BoulderState = { ...withProblem(empty()), projectIds: [P1], openedHere: [] };
    const r = removeProblems({ ...s, attempts: [attempt(P1, 1, "ATTEMPT")] }, [P1], ctx);
    expect(r.problemsDeleted).toEqual([]);
    expect(r.state.problems.map((p) => p.id)).toEqual([P1]);
    expect(r.state.projectIds).toEqual([P1]);
  });

  it("refuses changes after the session was ended on the phone", () => {
    const s = applyBoulderOp(withProblem(empty()), op({ kind: "end" }), ctx);
    expect(s.endedAt).toBe(at);
    expect(checkBoulderOp(s, op({ kind: "attempts", problemId: P1, items: [{ id: uid(), result: "TOP" }] }))).toBe("ended");
  });

  it("takes the server's id and numbers", () => {
    let s = applyBoulderOp(empty(), op({ kind: "pickTopo", problemId: P1, outdoorProblemId: 7, name: "X", grade: "5a" }), ctx);
    const aid = uid();
    s = applyBoulderOp(s, op({ kind: "attempts", problemId: P1, items: [{ id: aid, result: "ATTEMPT" }] }), ctx);
    s = reconcile(s, { opId: uid(), ok: true, renamed: { from: P1, to: P2 } });
    expect(s.problems[0].id).toBe(P2);
    expect(s.attempts[0].problem_id).toBe(P2);
    const stored = { ...s.attempts[0], attempt_number: 5, created_at: "2026-11-12T10:00:05.000Z" };
    s = reconcile(s, { opId: uid(), ok: true, attempts: [stored] });
    expect(s.attempts[0]).toEqual(stored);

    const queued = [op({ kind: "attempts", problemId: P1, items: [{ id: uid(), result: "TOP" }] }), op({ kind: "remove", problemIds: [P1] })];
    const renamed = renameInOps(queued, P1, P2);
    expect(renamed[0]).toMatchObject({ problemId: P2 });
    expect(renamed[1]).toMatchObject({ problemIds: [P2] });
  });
});

describe("server-side helpers", () => {
  it("numbers new tries and keeps a flash on try 1", () => {
    expect(numberAttempts(0, ["ATTEMPT", "TOP"])).toEqual([1, 2]);
    expect(numberAttempts(0, ["FLASH"])).toEqual([1]);
    expect(numberAttempts(2, ["FLASH"])).toBe("flashOnlyFirst");
  });

  it("keeps a phone time inside the session and never in the future", () => {
    const start = "2026-11-12T09:00:00.000Z";
    const now = Date.parse("2026-11-12T12:00:00.000Z");
    expect(clampTime("2026-11-12T08:00:00.000Z", start, null, now)).toBe(start);
    expect(clampTime("2026-11-12T13:00:00.000Z", start, null, now)).toBe("2026-11-12T12:00:00.000Z");
    expect(clampTime("2026-11-12T11:30:00.000Z", start, "2026-11-12T11:00:00.000Z", now)).toBe("2026-11-12T11:00:00.000Z");
    expect(clampTime("2026-11-12T10:15:00.000Z", start, null, now)).toBe("2026-11-12T10:15:00.000Z");
  });
});
