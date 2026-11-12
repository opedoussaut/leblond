"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { syncBoulderSession } from "@/lib/actions/session-sync";
import { forgetOfflinePage } from "@/lib/offline/service-worker";
import { clearStored, listStored, sendQueued, writeStored, type Snapshot } from "@/lib/offline/session-store";

/** Sessions kept on the phone with nothing left to send are forgotten after this long. */
const KEEP_SENT_MS = 3 * 24 * 3600 * 1000;

/**
 * Sends, in the background, the changes of sessions whose page is not open:
 * a session ended in the forest and the app reopened at home, or the last taps
 * still on their way when the climber moved to another page. The open session
 * page sends its own. Once something is sent, the page shown is refreshed.
 */
export function PendingSync({ userId }: { userId: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const busy = useRef(false);
  useEffect(() => {
    const run = async () => {
      if (busy.current) return;
      busy.current = true;
      let sent = 0;
      try {
        const storage = window.localStorage;
        for (const kept of listStored(storage)) {
          if (kept.userId !== userId) continue;
          if ((window as Window & { __lbLogging?: string }).__lbLogging === kept.sessionId) continue;
          if (!kept.outbox.length) {
            if (Date.now() - Date.parse(kept.savedAt) > KEEP_SENT_MS) clearStored(storage, kept.sessionId);
            continue;
          }
          let current: Snapshot = { state: kept.state, outbox: kept.outbox, failures: kept.failures ?? {} };
          const out = await sendQueued(kept.sessionId, {
            get: () => current,
            set: (next) => {
              current = next;
              writeStored(storage, { ...kept, ...next, savedAt: new Date().toISOString() });
            },
          }, syncBoulderSession);
          sent += out.sent;
          if (out.status === "gone" || (out.ended && !current.outbox.length)) {
            clearStored(storage, kept.sessionId);
            forgetOfflinePage(`/session/${kept.sessionId}`);
          }
          if (out.status === "offline") break;
        }
      } catch {
        /* storage unavailable: nothing kept on this phone */
      } finally {
        busy.current = false;
        if (sent) router.refresh();
      }
    };
    // On opening the app, on every page change and when the signal comes back.
    void run();
    window.addEventListener("online", run);
    return () => window.removeEventListener("online", run);
  }, [userId, pathname, router]);
  return null;
}
