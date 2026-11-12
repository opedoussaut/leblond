"use server";

import { revalidatePath } from "next/cache";
import { requireViewer } from "@/lib/auth/viewer";
import { renameInOps, syncInputSchema, type OpResult, type SyncResponse } from "@/lib/climbing/offline-session";
import { applyQueuedOp, RETRY, SYNC_SESSION_COLUMNS, type SyncSession } from "@/lib/data/session-ops";
import type { ActionResult } from "@/lib/validation/common";

/**
 * Sends a live boulder session's queued changes, in the order they were made
 * on the phone (with or without signal). Each one is applied once: sending the
 * same operations again returns what is already stored. Stops at the first
 * database error so nothing is applied out of order; the rest comes next time.
 */
export async function syncBoulderSession(input: unknown): Promise<ActionResult<SyncResponse>> {
  const viewer = await requireViewer();
  const parsed = syncInputSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { sessionId } = parsed.data;
  let ops = parsed.data.ops;

  const { data: session } = await viewer.supabase.from("sessions").select(SYNC_SESSION_COLUMNS).eq("id", sessionId).maybeSingle();
  if (!session) return { ok: false, error: "notFound" };
  if (session.discipline !== "BOULDER") return { ok: false, error: "invalid" };
  const current = session as unknown as SyncSession;

  const results: OpResult[] = [];
  let stopped = false;
  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    const res = await applyQueuedOp(viewer, current, op);
    if (res === RETRY) { stopped = true; break; }
    results.push(res);
    // A topo boulder already known under another id: later operations use that id.
    if (res.ok && res.renamed) ops = [...ops.slice(0, i + 1), ...renameInOps(ops.slice(i + 1), res.renamed.from, res.renamed.to)];
    if (res.ok && op.kind === "end") {
      const { data: ended } = await viewer.supabase.from("sessions").select("ended_at").eq("id", sessionId).maybeSingle();
      current.ended_at = ended?.ended_at ?? current.ended_at;
    }
  }
  if (results.length) revalidatePath("/", "layout");
  return { ok: true, data: { results, stopped } };
}
