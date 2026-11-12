/**
 * Where a live boulder session waits for signal: its screen state and the
 * changes not sent yet, kept in the phone's storage (one entry per session),
 * plus the loop that sends them. No React here; storage and the server call
 * are passed in, so this is unit-tested.
 */
import {
  reconcile,
  renameInOps,
  replay,
  type BoulderCtx,
  type BoulderOp,
  type BoulderState,
  type OpResult,
  type SyncResponse,
} from "@/lib/climbing/offline-session";
import type { ActionResult } from "@/lib/validation/common";

export const STORE_PREFIX = "lb-offline-session-";
/** The live session kept on this phone, for the offline page's "resume" link. */
export const LIVE_KEY = "lb-offline-live";
/** Ops sent per request (the server applies them one by one). */
export const BATCH = 20;
/** A change refused this many times for a database error is dropped (and reported). */
export const MAX_FAILURES = 5;

export type Snapshot = { state: BoulderState; outbox: BoulderOp[]; failures: Record<string, number> };

export type StoredSession = Snapshot & {
  v: 1;
  userId: string;
  sessionId: string;
  gymName: string;
  /** When the phone last saved it (compared with when the page was made). */
  savedAt: string;
};

export type LiveEntry = { sessionId: string; gymName: string; userId: string };

type Storage = Pick<globalThis.Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;

const keyOf = (sessionId: string) => STORE_PREFIX + sessionId;

export function readStored(storage: Storage, sessionId: string): StoredSession | null {
  try {
    const raw = storage.getItem(keyOf(sessionId));
    if (!raw) return null;
    const v = JSON.parse(raw) as StoredSession;
    return v && v.v === 1 && v.sessionId === sessionId && Array.isArray(v.outbox) ? v : null;
  } catch {
    return null;
  }
}

/** Saves; false when the phone refuses (private browsing, storage full): the screen still works. */
export function writeStored(storage: Storage, s: StoredSession): boolean {
  try {
    storage.setItem(keyOf(s.sessionId), JSON.stringify(s));
    return true;
  } catch {
    return false;
  }
}

export function clearStored(storage: Storage, sessionId: string) {
  try {
    storage.removeItem(keyOf(sessionId));
    const live = readLive(storage);
    if (live?.sessionId === sessionId) storage.removeItem(LIVE_KEY);
  } catch {
    /* nothing to do */
  }
}

export function readLive(storage: Storage): LiveEntry | null {
  try {
    const v = JSON.parse(storage.getItem(LIVE_KEY) ?? "null") as LiveEntry | null;
    return v && typeof v.sessionId === "string" ? v : null;
  } catch {
    return null;
  }
}

export function writeLive(storage: Storage, entry: LiveEntry) {
  try {
    storage.setItem(LIVE_KEY, JSON.stringify(entry));
  } catch {
    /* nothing to do */
  }
}

/** Every session kept on this phone. */
export function listStored(storage: Storage): StoredSession[] {
  const out: StoredSession[] = [];
  try {
    for (let i = 0; i < storage.length; i++) {
      const k = storage.key(i);
      if (!k?.startsWith(STORE_PREFIX)) continue;
      const s = readStored(storage, k.slice(STORE_PREFIX.length));
      if (s) out.push(s);
    }
  } catch {
    /* nothing to do */
  }
  return out;
}

/**
 * After signing out: forget what is on screen, but keep changes that were never
 * sent (they go out when the same climber signs in again).
 */
export function forgetSentSessions(storage: Storage) {
  for (const s of listStored(storage)) if (!s.outbox.length) clearStored(storage, s.sessionId);
  try {
    storage.removeItem(LIVE_KEY);
  } catch {
    /* nothing to do */
  }
}

/**
 * What to show when the page opens. The page was made by the server at
 * `renderedAt`: when the phone saved something later (the page is the copy
 * kept for use without signal, older than the last taps), the phone's state
 * wins; otherwise the server's data, with the changes not sent yet replayed on top.
 */
export function initialSnapshot(server: BoulderState, stored: StoredSession | null, renderedAt: string, ctx: BoulderCtx): Snapshot {
  if (!stored || stored.userId !== ctx.userId) return { state: server, outbox: [], failures: {} };
  const failures = stored.failures ?? {};
  if (Date.parse(stored.savedAt) > Date.parse(renderedAt)) return { state: stored.state, outbox: stored.outbox, failures };
  return { state: replay(server, stored.outbox, ctx), outbox: stored.outbox, failures };
}

export type SendOutcome = {
  /** done: nothing left; offline: no network (or a new version of the app); error: the server said no; gone: no such session. */
  status: "done" | "offline" | "error" | "gone";
  rejected: Array<Extract<OpResult, { ok: false }> & { kind: BoulderOp["kind"] }>;
  sent: number;
  renamed: boolean;
  ended: boolean;
  /** The error thrown by the request, when there was no answer. */
  thrown?: unknown;
};

/**
 * Sends the queued changes in order, in batches, applying the server's answer
 * to the snapshot after each batch (`set` saves it). Stops when the network
 * fails; a change the server keeps failing on is dropped after MAX_FAILURES.
 */
export async function sendQueued(
  sessionId: string,
  store: { get: () => Snapshot; set: (s: Snapshot) => void },
  send: (input: { sessionId: string; ops: BoulderOp[] }) => Promise<ActionResult<SyncResponse>>,
): Promise<SendOutcome> {
  const outcome: SendOutcome = { status: "done", rejected: [], sent: 0, renamed: false, ended: false };
  while (store.get().outbox.length) {
    const batch = store.get().outbox.slice(0, BATCH);
    let res: ActionResult<SyncResponse>;
    try {
      res = await send({ sessionId, ops: batch });
    } catch (e) {
      return { ...outcome, status: "offline", thrown: e };
    }
    if (!res.ok || !res.data) return { ...outcome, status: !res.ok && res.error === "notFound" ? "gone" : "error" };

    let { state, outbox } = store.get();
    const failures = { ...store.get().failures };
    for (const r of res.data.results) {
      const op = outbox.find((o) => o.opId === r.opId);
      outbox = outbox.filter((o) => o.opId !== r.opId);
      delete failures[r.opId];
      if (!op) continue;
      outcome.sent += 1;
      if (r.ok) {
        state = reconcile(state, r);
        if (r.renamed) {
          outbox = renameInOps(outbox, r.renamed.from, r.renamed.to);
          outcome.renamed = true;
        }
        if (op.kind === "end") outcome.ended = true;
      } else {
        outcome.rejected.push({ ...r, kind: op.kind });
      }
    }
    if (res.data.stopped && outbox.length) {
      const next = outbox[0];
      failures[next.opId] = (failures[next.opId] ?? 0) + 1;
      if (failures[next.opId] >= MAX_FAILURES) {
        outbox = outbox.slice(1);
        delete failures[next.opId];
        outcome.rejected.push({ opId: next.opId, ok: false, error: "unknownError", kind: next.kind });
      }
      store.set({ state, outbox, failures });
      return { ...outcome, status: "error" };
    }
    store.set({ state, outbox, failures });
    if (!res.data.results.length) return { ...outcome, status: "error" };
  }
  return outcome;
}
