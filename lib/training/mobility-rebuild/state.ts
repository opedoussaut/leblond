import {
  adherence, followUpOpen, rebuildStatus, slotInfo, usualLevels,
  type DoneSession, type Overall, type Phase, type RebuildStatus, type StopReason, type Usual, type Verdict,
} from "./engine";

/**
 * Reads a climber's Mobility Rebuild séances and check-ins into what the pages
 * and the rules need. Pure: the loader passes the rows, nothing is fetched here.
 */

export type RebuildRow = {
  id: string; title: string; status: string; slot: number; phase: Phase; plannedMinutes: number | null;
  scheduledDate: string | null; originalDate: string | null; pain: number | null; completedAt: string | null;
};
export type CheckRow = {
  sessionId: string; moment: "BEFORE" | "AFTER" | "D1";
  backPain: number | null; legRadiation: number | null; verdict: Verdict | null; phaseUsed: number | null;
  stopReason: StopReason | null; overall: Overall | null; updatedAt: string;
};

export type RebuildSessionView = RebuildRow & {
  letter: "A" | "B" | "C"; week: number;
  view: RebuildStatus; adapted: boolean; phaseUsed: Phase | null;
  before: CheckRow | null; after: CheckRow | null; nextDay: CheckRow | null;
  /** The local day it was done (completed or interrupted), if it was. */
  doneOn: string | null;
  followUpOpen: boolean;
};

export type RebuildView = {
  sessions: RebuildSessionView[];
  history: DoneSession[];
  usual: Usual;
  adherence: { done: number; due: number };
  next: RebuildSessionView | null;
  followUps: RebuildSessionView[];
};

const PHASES = new Set([1, 2, 3, 4, 5, 6]);

export function buildView(rows: readonly RebuildRow[], checks: readonly CheckRow[], declared: Usual, today: string,
  localDay: (iso: string) => string): RebuildView {
  const by = new Map<string, Partial<Record<CheckRow["moment"], CheckRow>>>();
  for (const c of checks) by.set(c.sessionId, { ...by.get(c.sessionId), [c.moment]: c });
  const sessions = [...rows].sort((a, b) => a.slot - b.slot).map((r): RebuildSessionView => {
    const c = by.get(r.id) ?? {};
    const phaseUsed = c.BEFORE?.phaseUsed && PHASES.has(c.BEFORE.phaseUsed) ? c.BEFORE.phaseUsed as Phase : null;
    const adapted = phaseUsed !== null && phaseUsed < r.phase;
    const finished = r.status === "COMPLETED" || r.status === "INTERRUPTED";
    const doneOn = finished ? (r.completedAt ? localDay(r.completedAt) : c.AFTER ? localDay(c.AFTER.updatedAt) : r.scheduledDate) : null;
    const info = slotInfo(r.slot);
    return {
      ...r, letter: info.letter, week: info.week, view: rebuildStatus(r, today, adapted), adapted, phaseUsed,
      before: c.BEFORE ?? null, after: c.AFTER ?? null, nextDay: c.D1 ?? null, doneOn,
      followUpOpen: doneOn !== null && followUpOpen(doneOn, today, !!c.D1),
    };
  });
  const finished = sessions.filter((s) => s.status === "COMPLETED" || s.status === "INTERRUPTED")
    .sort((a, b) => (a.doneOn ?? "").localeCompare(b.doneOn ?? "") || a.slot - b.slot);
  const history: DoneSession[] = finished.map((s) => ({
    slot: s.slot, status: s.status as "COMPLETED" | "INTERRUPTED", phaseUsed: s.phaseUsed ?? s.phase,
    verdict: s.before?.verdict ?? null, painBefore: s.before?.backPain ?? null, painAfter: s.pain,
    stopReason: s.after?.stopReason ?? null, nextDay: s.nextDay?.overall ?? null,
  }));
  const checkHistory = finished.flatMap((s) => (s.before && s.before.verdict
    ? [{ verdict: s.before.verdict, backPain: s.before.backPain, legRadiation: s.before.legRadiation }] : []));
  const open = sessions.filter((s) => s.status === "IN_PROGRESS" || s.status === "INTERRUPTED" || s.status === "PLANNED");
  const next = open.find((s) => s.status === "IN_PROGRESS" || s.status === "INTERRUPTED")
    ?? [...open].sort((a, b) => (a.scheduledDate ?? "").localeCompare(b.scheduledDate ?? "") || a.slot - b.slot)[0] ?? null;
  return {
    sessions, history, usual: usualLevels(declared, checkHistory),
    adherence: adherence(sessions, today), next, followUps: sessions.filter((s) => s.followUpOpen),
  };
}

/** The phase whose A / B / C séances the programme page shows: the next séance's, else the last one used. */
export function currentPhase(view: RebuildView): Phase {
  if (view.next) return view.next.phase;
  return view.history.at(-1)?.phaseUsed ?? 1;
}
