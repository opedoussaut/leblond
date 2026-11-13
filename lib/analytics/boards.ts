import { gradeRank, isBoardSend, type Board, type BoardResult, type BoardScale } from "@/lib/climbing/boards";

/**
 * Board progress, as pure functions. A climb is identified by its board, its
 * name key and its angle; each board and angle has its own grade pyramid, and
 * Font and V grades are never converted or mixed.
 */
export type BoardAscentFact = {
  id: string; sessionId: string; board: Board; climbKey: string; climbName: string; angle: number;
  grade: string; gradeScale: BoardScale; tries: number; result: BoardResult; isBenchmark: boolean; climbedAt: Date;
};

const idOf = (f: Pick<BoardAscentFact, "board" | "climbKey" | "angle">) => `${f.board}|${f.angle}|${f.climbKey}`;
const byTime = (a: BoardAscentFact, b: BoardAscentFact) => a.climbedAt.getTime() - b.climbedAt.getTime();

export type BoardSessionSummary = {
  /** Distinct climbs worked in the séance. */
  climbs: number; sends: number; flashes: number; tries: number;
  /** Hardest climb sent, in each scale used (never compared with each other). */
  top: { grade: string; scale: BoardScale }[];
};

export function summarizeBoardSession(facts: readonly BoardAscentFact[]): BoardSessionSummary {
  const sent = facts.filter((f) => isBoardSend(f.result));
  const top: BoardSessionSummary["top"] = [];
  for (const scale of ["FONT", "V"] as const) {
    const best = sent.filter((f) => f.gradeScale === scale)
      .reduce<BoardAscentFact | null>((b, f) => (!b || gradeRank(scale, f.grade) > gradeRank(scale, b.grade) ? f : b), null);
    if (best) top.push({ grade: best.grade, scale });
  }
  return {
    climbs: new Set(facts.map(idOf)).size,
    sends: new Set(sent.map(idOf)).size,
    flashes: sent.filter((f) => f.result === "FLASH").length,
    tries: facts.reduce((n, f) => n + f.tries, 0),
    top,
  };
}

/** Sends of a climb the climber had already sent before: a repeat, not a new send. */
export function repeatIds(facts: readonly BoardAscentFact[]): Set<string> {
  const seen = new Set<string>(), out = new Set<string>();
  for (const f of [...facts].sort(byTime)) {
    if (!isBoardSend(f.result)) continue;
    if (seen.has(idOf(f))) out.add(f.id);
    seen.add(idOf(f));
  }
  return out;
}

export type ClimbHistory = { tries: number; sessions: number; sent: boolean; lastGrade: string | null; lastScale: BoardScale | null };

/** What the climber has already done on one climb, across séances. */
export function climbHistory(facts: readonly BoardAscentFact[], climb: Pick<BoardAscentFact, "board" | "climbKey" | "angle">): ClimbHistory {
  const mine = facts.filter((f) => idOf(f) === idOf(climb)).sort(byTime);
  const last = mine[mine.length - 1];
  return {
    tries: mine.reduce((n, f) => n + f.tries, 0), sessions: new Set(mine.map((f) => f.sessionId)).size,
    sent: mine.some((f) => isBoardSend(f.result)), lastGrade: last?.grade ?? null, lastScale: last?.gradeScale ?? null,
  };
}

export type BoardPyramid = {
  board: Board; angle: number; scale: BoardScale;
  /** Hardest first. `sends` counts distinct climbs sent; `flashes` those sent first go. */
  rows: { grade: string; sends: number; flashes: number }[];
  climbs: number; top: string;
};

/**
 * One pyramid per board, angle and scale: distinct climbs sent, at the grade of
 * their first send. A flash counts only when the very first go on the climb sent it.
 */
export function boardPyramids(facts: readonly BoardAscentFact[]): BoardPyramid[] {
  const ordered = [...facts].sort(byTime);
  const first = new Map<string, BoardAscentFact>();   // first ascent of any kind
  const firstSend = new Map<string, BoardAscentFact>();
  for (const f of ordered) {
    if (!first.has(idOf(f))) first.set(idOf(f), f);
    if (isBoardSend(f.result) && !firstSend.has(idOf(f))) firstSend.set(idOf(f), f);
  }
  const groups = new Map<string, BoardAscentFact[]>();
  for (const f of firstSend.values()) {
    const key = `${f.board}|${f.angle}|${f.gradeScale}`;
    groups.set(key, [...(groups.get(key) ?? []), f]);
  }
  const out: BoardPyramid[] = [];
  for (const sends of groups.values()) {
    const { board, angle, gradeScale: scale } = sends[0];
    const byGrade = new Map<string, { sends: number; flashes: number }>();
    for (const f of sends) {
      const row = byGrade.get(f.grade) ?? { sends: 0, flashes: 0 };
      row.sends += 1;
      if (f.result === "FLASH" && first.get(idOf(f))?.id === f.id) row.flashes += 1;
      byGrade.set(f.grade, row);
    }
    const rows = [...byGrade.entries()].map(([grade, r]) => ({ grade, ...r }))
      .sort((a, b) => gradeRank(scale, b.grade) - gradeRank(scale, a.grade));
    out.push({ board, angle, scale, rows, climbs: sends.length, top: rows[0].grade });
  }
  return out.sort((a, b) => a.board.localeCompare(b.board) || a.angle - b.angle || a.scale.localeCompare(b.scale));
}

/** Bounded facts for Patrick: he reads board work, he never computes it. */
export function boardCoachSummary(facts: readonly BoardAscentFact[], now: Date, days = 60) {
  const since = now.getTime() - days * 86_400_000;
  const recent = facts.filter((f) => f.climbedAt.getTime() >= since);
  return {
    windowDays: days,
    sessions: new Set(recent.map((f) => f.sessionId)).size,
    climbsSent: new Set(recent.filter((f) => isBoardSend(f.result)).map(idOf)).size,
    pyramids: boardPyramids(facts).slice(0, 6).map((p) => ({ board: p.board, angle: p.angle, scale: p.scale, top: p.top, climbs: p.climbs })),
  };
}
