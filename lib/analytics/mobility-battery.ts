import { CARD_BY_ID, CARDS, cardSides, type Card, type CardId, type Side, type Unit } from "@/lib/training/mobility-battery/cards";
import type { NotDoneReason } from "@/lib/training/mobility-battery/results";

/**
 * Trends of the mobility battery, one test at a time. There is no global score.
 *
 * For each card, side and item: the raw values of each finished bilan, the checkpoints
 * S0 / S4 / S8 / S12 (the bilan nearest to 0, 4, 8 and 12 weeks after the first one), and
 * the change since S0. A change is only worded as "in the usual direction" when it is
 * larger than the published minimal detectable change (when there is one) and pain or
 * radiation did not increase. "Not done" is never a zero: it is shown with its reason and
 * never enters a change.
 */

export type BatterySession = { id: string; startedOn: string; status: "IN_PROGRESS" | "COMPLETED" | "STOPPED" };
export type BatteryResult = {
  sessionId: string;
  cardId: CardId;
  side: Side;
  item: number;
  trial: number;
  status: "DONE" | "NOT_DONE";
  value: number | null;
  category: string | null;
  unit: Unit;
  notDoneReason: NotDoneReason | null;
  painBefore: number | null;
  painAfter: number | null;
  radiation: "NONE" | "SAME" | "LOWER_OR_STRONGER" | null;
};

export type TrendPoint = {
  sessionId: string;
  date: string;
  kind: "VALUE" | "CATEGORY" | "NOT_DONE";
  /** The best of the scored trials, in the card's usual direction. */
  value: number | null;
  /** Every scored trial, raw. */
  trials: number[];
  unit: Unit;
  category: string | null;
  notDoneReason: NotDoneReason | null;
  /** Highest pain after the movement across trials. */
  painAfter: number | null;
  radiationWorse: boolean;
};

export type Checkpoint = { label: "S0" | "S4" | "S8" | "S12"; weeks: 0 | 4 | 8 | 12; point: TrendPoint | null };

export type Change = {
  delta: number;
  unit: Unit;
  /** |delta| is below the minimal detectable change: interpret with caution. */
  withinMdc: boolean;
  /** Pain after the movement or radiation increased: never read as favourable. */
  painIncreased: boolean;
  /** Only set when the change is beyond the MDC (if any) and pain did not increase. */
  direction: "USUAL" | "OTHER" | null;
};

export type CardTrend = {
  cardId: CardId;
  side: Side;
  item: number;
  points: TrendPoint[];
  checkpoints: Checkpoint[];
  /** Latest valued checkpoint (or latest point beyond S12) compared with S0. */
  latest: { label: string; point: TrendPoint; change: Change | null } | null;
};

const CHECKPOINTS = [0, 4, 8, 12] as const;
/** A bilan counts for a checkpoint when it is within two weeks of it. */
export const CHECKPOINT_WINDOW_DAYS = 14;

const dayNumber = (d: string) => { const [y, m, dd] = d.split("-").map(Number); return Date.UTC(y, m - 1, dd) / 86_400_000; };

export function pointFor(card: Card, session: BatterySession, rows: readonly BatteryResult[]): TrendPoint | null {
  if (!rows.length) return null;
  const done = rows.filter((r) => r.status === "DONE");
  const painAfter = rows.reduce<number | null>((m, r) => (r.painAfter === null ? m : Math.max(m ?? 0, r.painAfter)), null);
  const radiationWorse = rows.some((r) => r.radiation === "LOWER_OR_STRONGER");
  const base = { sessionId: session.id, date: session.startedOn, painAfter, radiationWorse };
  const valued = done.filter((r) => r.value !== null).sort((a, b) => a.trial - b.trial);
  if (valued.length) {
    const values = valued.map((r) => Number(r.value));
    const more = card.measure?.higherIsMore ?? true;
    return { ...base, kind: "VALUE", value: more ? Math.max(...values) : Math.min(...values), trials: values, unit: valued[0].unit, category: null, notDoneReason: null };
  }
  const cat = done.find((r) => r.category !== null);
  if (cat) return { ...base, kind: "CATEGORY", value: null, trials: [], unit: "CATEGORY", category: cat.category, notDoneReason: null };
  const nd = rows.find((r) => r.status === "NOT_DONE")!;
  return { ...base, kind: "NOT_DONE", value: null, trials: [], unit: nd.unit, category: null, notDoneReason: nd.notDoneReason };
}

export function changeBetween(card: Card, from: TrendPoint, to: TrendPoint): Change | null {
  if (from.kind !== "VALUE" || to.kind !== "VALUE" || from.unit !== to.unit || from.value === null || to.value === null) return null;
  const delta = Math.round((to.value - from.value) * 10) / 10;
  const withinMdc = card.mdc ? Math.abs(delta) < card.mdc.value : false;
  const painIncreased = to.radiationWorse || (to.painAfter !== null && to.painAfter > (from.painAfter ?? 0));
  const more = card.measure?.higherIsMore ?? true;
  // Symptoms at rest (M01) are reported as they are, never worded as a direction of capacity.
  const direction = card.id === "M01" || withinMdc || painIncreased || delta === 0 ? null : (delta > 0) === more ? "USUAL" : "OTHER";
  return { delta, unit: to.unit, withinMdc, painIncreased, direction };
}

/** Finished bilans only (an open one is still being filled in), oldest first. */
export function finishedSessions(sessions: readonly BatterySession[]): BatterySession[] {
  return sessions.filter((s) => s.status !== "IN_PROGRESS").sort((a, b) => a.startedOn.localeCompare(b.startedOn) || a.id.localeCompare(b.id));
}

export function cardTrend(card: Card, side: Side, item: number, sessions: readonly BatterySession[], results: readonly BatteryResult[]): CardTrend {
  const finished = finishedSessions(sessions);
  const points: TrendPoint[] = [];
  for (const s of finished) {
    const p = pointFor(card, s, results.filter((r) => r.sessionId === s.id && r.cardId === card.id && r.side === side && r.item === item));
    if (p) points.push(p);
  }
  const used = new Set<string>();
  const start = points.length ? dayNumber(points[0].date) : 0;
  const checkpoints: Checkpoint[] = CHECKPOINTS.map((weeks) => {
    const target = start + weeks * 7;
    let best: TrendPoint | null = null;
    for (const p of points) {
      const gap = Math.abs(dayNumber(p.date) - target);
      if (gap > CHECKPOINT_WINDOW_DAYS || used.has(p.sessionId)) continue;
      if (!best || gap < Math.abs(dayNumber(best.date) - target)) best = p;
    }
    if (best) used.add(best.sessionId);
    return { label: `S${weeks}` as Checkpoint["label"], weeks, point: best };
  });

  const s0 = checkpoints[0].point;
  let latest: CardTrend["latest"] = null;
  const last = points.at(-1);
  // A change needs a later day than S0 (two bilans on the same day are not a trend).
  if (last && s0 && last.sessionId !== s0.sessionId && dayNumber(last.date) > dayNumber(s0.date)) {
    const cp = checkpoints.find((c) => c.point?.sessionId === last.sessionId);
    const label = cp ? cp.label : `S${Math.round((dayNumber(last.date) - start) / 7)}`;
    latest = { label, point: last, change: changeBetween(card, s0, last) };
  }
  return { cardId: card.id, side, item, points, checkpoints, latest };
}

/** Every tracked series of the battery (clinician cards are reports, not trends). */
export function batteryTrends(sessions: readonly BatterySession[], results: readonly BatteryResult[]): CardTrend[] {
  const trends: CardTrend[] = [];
  for (const card of CARDS) {
    if (card.access === "clinician_only") continue;
    for (const side of cardSides(card)) for (const { item } of card.items) {
      const t = cardTrend(card, side, item, sessions, results);
      if (t.points.length) trends.push(t);
    }
  }
  return trends;
}

/** Left / right difference on the same bilan, raw (no judgement). */
export function sideGap(a: TrendPoint | null, b: TrendPoint | null): number | null {
  if (!a || !b || a.kind !== "VALUE" || b.kind !== "VALUE" || a.unit !== b.unit) return null;
  return Math.round(((a.value ?? 0) - (b.value ?? 0)) * 10) / 10;
}

export type SessionProgress = { done: number; notDone: number; untouched: number; clinicianReports: number };

/** How much of a bilan is filled in: a card counts once, whatever its sides. */
export function sessionProgress(results: readonly Pick<BatteryResult, "cardId" | "status" | "unit">[]): SessionProgress {
  let done = 0, notDone = 0, clinicianReports = 0;
  for (const card of CARDS) {
    const rows = results.filter((r) => r.cardId === card.id);
    if (card.access === "clinician_only") { if (rows.length) clinicianReports++; continue; }
    if (!rows.length) continue;
    if (rows.some((r) => r.status === "DONE")) done++; else notDone++;
  }
  const home = CARDS.filter((c) => c.access !== "clinician_only").length;
  return { done, notDone, untouched: home - done - notDone, clinicianReports };
}

/** The next bilan is due four weeks after the last finished one. */
export function nextDue(sessions: readonly BatterySession[], intervalDays = 28): string | null {
  const last = finishedSessions(sessions).at(-1);
  if (!last) return null;
  const [y, m, d] = last.startedOn.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + intervalDays)).toISOString().slice(0, 10);
}

/** The D+1 symptom check opens the day after a finished bilan. */
export function d1Open(session: BatterySession, today: string): boolean {
  return session.status !== "IN_PROGRESS" && dayNumber(today) >= dayNumber(session.startedOn) + 1;
}

export function cardOf(id: CardId): Card { return CARD_BY_ID.get(id)!; }

/** What a card shows in the bilan list: done, not done, stopped by a stop sign, or untouched (null). */
export function cardStatus(rows: readonly Pick<BatteryResult, "status" | "notDoneReason">[]): "DONE" | "NOT_DONE" | "STOPPED" | null {
  if (!rows.length) return null;
  if (rows.some((r) => r.status === "DONE")) return "DONE";
  if (rows.some((r) => r.notDoneReason === "STOPPED_SYMPTOM")) return "STOPPED";
  return "NOT_DONE";
}
