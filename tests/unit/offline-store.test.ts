import { describe, expect, it } from "vitest";
import { applyBoulderOp, type BoulderOp, type BoulderState, type SyncResponse } from "@/lib/climbing/offline-session";
import {
  MAX_FAILURES,
  clearStored,
  forgetSentSessions,
  initialSnapshot,
  listStored,
  readLive,
  readStored,
  sendQueued,
  writeLive,
  writeStored,
  type Snapshot,
  type StoredSession,
} from "@/lib/offline/session-store";
import type { ActionResult } from "@/lib/validation/common";

const S = "00000000-0000-4000-8000-000000000001";
const U = "00000000-0000-4000-8000-0000000000aa";
const ctx = { sessionId: S, userId: U };
const P1 = "10000000-0000-4000-8000-000000000001";
const P2 = "10000000-0000-4000-8000-000000000002";
const at = "2026-11-12T10:00:00.000Z";
let n = 0;
const uid = () => `30000000-0000-4000-8000-${String(++n).padStart(12, "0")}`;
const op = <T extends Omit<BoulderOp, "opId" | "at">>(o: T) => ({ opId: uid(), at, ...o }) as unknown as BoulderOp;
const empty = (): BoulderState => ({ problems: [], attempts: [], projectIds: [], openedHere: [], scale: "FONT", endedAt: null, known: {} });

class MemoryStorage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  getItem(k: string) { return this.m.get(k) ?? null; }
  setItem(k: string, v: string) { this.m.set(k, v); }
  removeItem(k: string) { this.m.delete(k); }
}

function stored(outbox: BoulderOp[], state = empty(), savedAt = at): StoredSession {
  return { v: 1, userId: U, sessionId: S, gymName: "Maincourt", state, outbox, failures: {}, savedAt };
}

function memoryStore(s: Snapshot) {
  let cur = s;
  return { get: () => cur, set: (next: Snapshot) => { cur = next; } };
}

describe("phone storage", () => {
  it("saves, lists and forgets sessions, keeping unsent changes", () => {
    const storage = new MemoryStorage();
    const create = op({ kind: "createProblem", problemId: P1, grade: "6a", system: "FONT" });
    writeStored(storage, stored([create]));
    writeStored(storage, { ...stored([]), sessionId: "00000000-0000-4000-8000-000000000009" });
    writeLive(storage, { sessionId: S, gymName: "Maincourt", userId: U });
    expect(readStored(storage, S)?.outbox).toHaveLength(1);
    expect(listStored(storage)).toHaveLength(2);
    forgetSentSessions(storage);
    expect(listStored(storage).map((s) => s.sessionId)).toEqual([S]);
    expect(readLive(storage)).toBeNull();
    clearStored(storage, S);
    expect(readStored(storage, S)).toBeNull();
  });

  it("ignores unreadable entries", () => {
    const storage = new MemoryStorage();
    storage.setItem("lb-offline-session-" + S, "{not json");
    expect(readStored(storage, S)).toBeNull();
  });
});

describe("opening the page", () => {
  const create = op({ kind: "createProblem", problemId: P1, grade: "6a", system: "FONT" });
  const local = applyBoulderOp(empty(), create, ctx);

  it("replays unsent changes on top of fresh server data", () => {
    const snap = initialSnapshot(empty(), stored([create], local), "2026-11-12T10:05:00.000Z", ctx);
    expect(snap.state.problems.map((p) => p.id)).toEqual([P1]);
    expect(snap.outbox).toEqual([create]);
  });

  it("uses the phone's state when the page is an older copy kept for offline use", () => {
    // Taps already sent are no longer queued, and the kept copy predates them.
    const later = { ...local, scale: "ARKOSE_COLOR" as const };
    const snap = initialSnapshot(empty(), stored([], later, "2026-11-12T10:30:00.000Z"), "2026-11-12T10:00:00.000Z", ctx);
    expect(snap.state.scale).toBe("ARKOSE_COLOR");
    expect(snap.state.problems.map((p) => p.id)).toEqual([P1]);
  });

  it("never shows another climber's data", () => {
    const snap = initialSnapshot(empty(), { ...stored([create], local), userId: "someone-else" }, at, ctx);
    expect(snap).toEqual({ state: empty(), outbox: [], failures: {} });
  });
});

describe("sending queued changes", () => {
  it("sends in batches and empties the queue", async () => {
    const ops = Array.from({ length: 25 }, (_, i) => op({ kind: "updateProblem", problemId: P1, notes: String(i) }));
    const store = memoryStore({ state: empty(), outbox: ops, failures: {} });
    const sizes: number[] = [];
    const send = async ({ ops: batch }: { ops: BoulderOp[] }): Promise<ActionResult<SyncResponse>> => {
      sizes.push(batch.length);
      return { ok: true, data: { results: batch.map((o) => ({ opId: o.opId, ok: true as const })), stopped: false } };
    };
    const out = await sendQueued(S, store, send);
    expect(out.status).toBe("done");
    expect(out.sent).toBe(25);
    expect(sizes).toEqual([20, 5]);
    expect(store.get().outbox).toEqual([]);
  });

  it("keeps everything when the network fails", async () => {
    const ops = [op({ kind: "project", problemId: P1 })];
    const store = memoryStore({ state: empty(), outbox: ops, failures: {} });
    const out = await sendQueued(S, store, async () => { throw new TypeError("Failed to fetch"); });
    expect(out.status).toBe("offline");
    expect(store.get().outbox).toEqual(ops);
  });

  it("follows a boulder renamed by the server and reports refusals", async () => {
    const pick = op({ kind: "pickTopo", problemId: P1, outdoorProblemId: 3, name: "X", grade: "5a" });
    const tries = op({ kind: "attempts", problemId: P1, items: [{ id: uid(), result: "FLASH" }] });
    const store = memoryStore({ state: applyBoulderOp(empty(), pick, ctx), outbox: [pick, tries], failures: {} });
    let call = 0;
    const out = await sendQueued(S, store, async ({ ops: batch }) => {
      call += 1;
      if (call === 1) {
        // Only the pick answered this time.
        return { ok: true, data: { results: [{ opId: batch[0].opId, ok: true, renamed: { from: P1, to: P2 } }], stopped: false } };
      }
      expect(batch[0]).toMatchObject({ problemId: P2 });
      return { ok: true, data: { results: [{ opId: batch[0].opId, ok: false, error: "flashOnlyFirst" }], stopped: false } };
    });
    expect(out.renamed).toBe(true);
    expect(out.rejected).toEqual([{ opId: tries.opId, ok: false, error: "flashOnlyFirst", kind: "attempts" }]);
    expect(store.get().state.problems[0].id).toBe(P2);
    expect(store.get().outbox).toEqual([]);
  });

  it("drops a change the server keeps failing on", async () => {
    const stuck = op({ kind: "project", problemId: P1 });
    const store = memoryStore({ state: empty(), outbox: [stuck], failures: {} });
    const send = async (): Promise<ActionResult<SyncResponse>> => ({ ok: true, data: { results: [], stopped: true } });
    for (let i = 1; i < MAX_FAILURES; i++) {
      expect((await sendQueued(S, store, send)).status).toBe("error");
      expect(store.get().failures[stuck.opId]).toBe(i);
    }
    const last = await sendQueued(S, store, send);
    expect(last.rejected.map((r) => r.opId)).toEqual([stuck.opId]);
    expect(store.get().outbox).toEqual([]);
  });

  it("says when the session no longer exists", async () => {
    const store = memoryStore({ state: empty(), outbox: [op({ kind: "end" })], failures: {} });
    const out = await sendQueued(S, store, async () => ({ ok: false, error: "notFound" }));
    expect(out.status).toBe("gone");
  });

  it("notices the end of the session", async () => {
    const end = op({ kind: "end" });
    const store = memoryStore({ state: empty(), outbox: [end], failures: {} });
    const out = await sendQueued(S, store, async () => ({ ok: true, data: { results: [{ opId: end.opId, ok: true }], stopped: false } }));
    expect(out.ended).toBe(true);
  });
});
