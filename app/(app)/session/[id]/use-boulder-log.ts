"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { syncBoulderSession } from "@/lib/actions/session-sync";
import {
  applyBoulderOp,
  checkBoulderOp,
  createdProblemId,
  replay,
  type BoulderOp,
  type BoulderState,
  type NewBoulderOp,
} from "@/lib/climbing/offline-session";
import {
  clearStored,
  initialSnapshot,
  readStored,
  sendQueued,
  writeLive,
  writeStored,
  type SendOutcome,
  type Snapshot,
} from "@/lib/offline/session-store";
import { forgetOfflinePage, keepPageForOffline } from "@/lib/offline/service-worker";

export type Rejection = SendOutcome["rejected"][number];

function storage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

const isOnline = () => typeof navigator === "undefined" || navigator.onLine !== false;

/**
 * The live boulder session on this phone. Every change is applied on screen at
 * once, saved on the phone, then sent to the server in order — right away with
 * signal, or as soon as it comes back. Nothing is lost when the app is closed.
 */
export function useBoulderLog({
  sessionId,
  userId,
  gymName,
  renderedAt,
  server,
  live,
}: {
  sessionId: string;
  userId: string;
  gymName: string;
  /** False when filling in a finished session. */
  live: boolean;
  /** When the server made the page: tells fresh data from the copy kept for use without signal. */
  renderedAt: string;
  server: BoulderState;
}) {
  const router = useRouter();
  const ctx = useMemo(() => ({ sessionId, userId }), [sessionId, userId]);
  // The state is what the screen shows; the ref is what the sender reads between renders.
  const [view, setView] = useState<Snapshot>(() => ({ state: server, outbox: [], failures: {} }));
  const snap = useRef<Snapshot>(view);
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [rejections, setRejections] = useState<Rejection[]>([]);
  const [gone, setGone] = useState(false);
  const flushing = useRef(false);
  const again = useRef(false);
  const lastRender = useRef<string | null>(null);

  const save = useCallback((next: Snapshot) => {
    snap.current = next;
    const s = storage();
    if (s) {
      writeStored(s, {
        v: 1, userId, sessionId, gymName, savedAt: new Date().toISOString(), ...next,
      });
    }
    setView(next);
  }, [userId, sessionId, gymName]);

  /** Sends what is queued; a call made while sending runs once more at the end. */
  const flush = useCallback(async () => {
    if (flushing.current) { again.current = true; return; }
    flushing.current = true;
    try {
      do {
        again.current = false;
        if (!snap.current.outbox.length) return;
        setSyncing(true);
        const out: SendOutcome = await sendQueued(sessionId, { get: () => snap.current, set: save }, syncBoulderSession);
        setSyncing(false);
        if (out.status === "offline") {
          setOnline(false);
          // A new version of the app was released while this page was open: reload it (nothing is lost).
          const message = out.thrown instanceof Error ? out.thrown.message : "";
          if (isOnline() && /server action/i.test(message)) {
            try {
              const key = "lb-reloaded-for-version";
              if (Date.now() - Number(window.sessionStorage.getItem(key) ?? 0) > 600_000) {
                window.sessionStorage.setItem(key, String(Date.now()));
                window.location.reload();
              }
            } catch { /* nothing to do */ }
          }
          return;
        }
        setOnline(true);
        if (out.rejected.length) setRejections((list) => [...list, ...out.rejected]);
        if (out.status === "gone") {
          const s = storage();
          if (s) clearStored(s, sessionId);
          snap.current = { ...snap.current, outbox: [] };
          setView(snap.current);
          setGone(true);
          return;
        }
        if (out.ended && !snap.current.outbox.length) {
          // Finished and stored: the page becomes the session summary.
          const s = storage();
          if (s) clearStored(s, sessionId);
          forgetOfflinePage(`/session/${sessionId}`);
          router.refresh();
          return;
        }
        // The server corrected something: show what it stored.
        if (out.rejected.length || out.renamed) router.refresh();
        if (out.status === "error") return; // tried again on the next change, on reconnect or in 30 s
      } while (again.current);
    } finally {
      flushing.current = false;
      setSyncing(false);
    }
  }, [sessionId, save, router]);

  // Opening the page, and every fresh render (after a refresh): the server's data, plus what is not sent yet.
  useEffect(() => {
    if (lastRender.current === renderedAt) return;
    const first = lastRender.current === null;
    lastRender.current = renderedAt;
    const s = storage();
    const stored = first && s ? readStored(s, sessionId) : null;
    // After a refresh the data is fresh (it only happens with signal): replay what is not sent yet.
    const next = first
      ? initialSnapshot(server, stored, renderedAt, ctx)
      : { ...snap.current, state: replay(server, snap.current.outbox, ctx) };
    save(next);
    if (first) {
      // Only a live session is kept for reopening without signal (not a finished one being edited).
      if (live) {
        if (s) writeLive(s, { sessionId, gymName, userId });
        keepPageForOffline(`/session/${sessionId}`);
      }
      setOnline(isOnline());
    }
    void flush();
  }, [renderedAt, server, ctx, sessionId, gymName, userId, live, save, flush]);

  // The background sender (PendingSync) leaves this session to this page.
  useEffect(() => {
    const w = window as Window & { __lbLogging?: string };
    w.__lbLogging = sessionId;
    return () => { if (w.__lbLogging === sessionId) delete w.__lbLogging; };
  }, [sessionId]);

  // Send again when the signal comes back, when the app comes to the front, and every 30 s while waiting.
  useEffect(() => {
    const up = () => { setOnline(true); void flush(); };
    const down = () => setOnline(false);
    const visible = () => { if (document.visibilityState === "visible") void flush(); };
    window.addEventListener("online", up);
    window.addEventListener("offline", down);
    document.addEventListener("visibilitychange", visible);
    const timer = window.setInterval(() => { if (snap.current.outbox.length) void flush(); }, 30_000);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", down);
      document.removeEventListener("visibilitychange", visible);
      window.clearInterval(timer);
    };
  }, [flush]);

  /**
   * Applies changes on screen and queues them, all or nothing. Returns why it
   * was refused (e.g. "flashOnlyFirst"), or null.
   */
  const enqueue = useCallback((ops: NewBoulderOp[]): string | null => {
    const at = new Date().toISOString();
    let state = snap.current.state;
    const full: BoulderOp[] = [];
    for (const o of ops) {
      const op = { ...o, opId: crypto.randomUUID(), at } as BoulderOp;
      const error = checkBoulderOp(state, op);
      if (error) return error;
      state = applyBoulderOp(state, op, ctx);
      full.push(op);
    }
    save({ ...snap.current, state, outbox: [...snap.current.outbox, ...full] });
    void flush();
    return null;
  }, [ctx, save, flush]);

  const outbox = view.outbox;
  const unsentProblems = useMemo(
    () => new Set(outbox.map(createdProblemId).filter((id): id is string => id !== null)),
    [outbox],
  );

  return {
    state: view.state,
    enqueue,
    /** Changes not sent yet. */
    pending: outbox.length,
    /** Boulders created on the phone and not on the server yet (no photo, no link). */
    unsentProblems,
    online,
    syncing,
    rejections,
    dismissRejections: () => setRejections([]),
    gone,
    retry: () => void flush(),
  };
}
