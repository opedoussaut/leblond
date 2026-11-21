import { safetyScreen } from "@/lib/training/mobility-battery/safety";

/**
 * Mobility Rebuild | 12 Weeks — the programme engine. Pure functions (no I/O):
 * the server actions, the coach-key route and the pages all read the same rules.
 *
 *  - 12 weeks, 3 séances a week (A hips, B functional strength and ankles,
 *    C usable mobility for climbing): 36 dated séances.
 *  - Six phases of two weeks; the planned length of a séance (rests included)
 *    is 60, 65, 70, 75, 80 then 90 minutes. A length is a target, never an
 *    obligation to carry on through pain.
 *  - Séances fall on three weekdays, never two days in a row, and the first one
 *    is the next valid day AFTER activation: nothing is ever backdated.
 *  - Before each séance, a symptom check decides GO / ADAPT / STOP / EMERGENCY.
 *  - A harder phase is only used after several tolerated séances with a good
 *    next-day follow-up; otherwise the earlier phase is kept. The two last
 *    phases also wait for a clinical review the climber has documented
 *    (self-reported: the app never gives a medical green light).
 *
 * Thresholds are editorial coaching rules, not clinical criteria.
 */

export const REBUILD_PROGRAMME = "REBUILD_12W" as const;
/** method_id of every séance of the programme. */
export const REBUILD_METHOD_ID = "mobility-rebuild";

export const WEEKS = 12;
export const SESSIONS_PER_WEEK = 3;
export const TOTAL_SESSIONS = WEEKS * SESSIONS_PER_WEEK;

export const LETTERS = ["A", "B", "C"] as const;
export type Letter = (typeof LETTERS)[number];

export const PHASES = [1, 2, 3, 4, 5, 6] as const;
export type Phase = (typeof PHASES)[number];

/** Planned length of each séance of a phase, warm-up and rests included. */
export const PHASE_MINUTES: Record<Phase, number> = { 1: 60, 2: 65, 3: 70, 4: 75, 5: 80, 6: 90 };

/** Highest phase used while no clinical review has been documented. */
export const PHASE_WITHOUT_REVIEW: Phase = 4;

export const RULES = {
  /** Tolerated séances in a row, at the phase in use, before the next phase opens. */
  toleratedToStep: 3,
  /** Pain after may exceed pain before by this much and still count as tolerated. */
  toleratedPainRise: 1,
  /** Pain after at or above pain before + this is a bad séance (the phase steps back). */
  badPainRise: 3,
  /** Back or leg pain at or above this stops the séance before it starts. */
  stopPain: 7,
  /** Above the usual level by this much or more: stop. */
  stopAboveUsual: 3,
  /** Without a usual level: back pain at or above this adapts the séance. */
  adaptBackPain: 5,
  /** Without a usual level: leg radiation at or above this adapts the séance. */
  adaptLegRadiation: 3,
} as const;

// ── Slots and dates ──────────────────────────────────────────────────────

export type Slot = { slot: number; week: number; letter: Letter; phase: Phase; minutes: number };

export function slotInfo(slot: number): Slot {
  if (!Number.isInteger(slot) || slot < 1 || slot > TOTAL_SESSIONS) throw new RangeError("slot");
  const week = Math.ceil(slot / SESSIONS_PER_WEEK);
  const phase = Math.ceil(week / 2) as Phase;
  return { slot, week, letter: LETTERS[(slot - 1) % SESSIONS_PER_WEEK]!, phase, minutes: PHASE_MINUTES[phase] };
}

export const SLOTS: readonly Slot[] = Array.from({ length: TOTAL_SESSIONS }, (_, i) => slotInfo(i + 1));

/** ISO weekdays, 1 = Monday … 7 = Sunday. */
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
/** Tuesday, Thursday, Sunday. */
export const DEFAULT_DAYS: readonly Weekday[] = [2, 4, 7];

/** Three distinct weekdays, none the day after another (Sunday → Monday included). */
export function validDays(days: readonly number[]): boolean {
  if (days.length !== SESSIONS_PER_WEEK) return false;
  if (new Set(days).size !== days.length) return false;
  if (!days.every((d) => Number.isInteger(d) && d >= 1 && d <= 7)) return false;
  const set = new Set(days);
  return days.every((d) => !set.has(d === 7 ? 1 : d + 1));
}

function parse(date: string): Date {
  return new Date(date + "T12:00:00Z");
}
function format(d: Date): string {
  return d.toISOString().slice(0, 10);
}
export function addDays(date: string, n: number): string {
  const d = parse(date);
  d.setUTCDate(d.getUTCDate() + n);
  return format(d);
}
export function isoWeekday(date: string): Weekday {
  const w = parse(date).getUTCDay();
  return (w === 0 ? 7 : w) as Weekday;
}
export function daysBetween(from: string, to: string): number {
  return Math.round((parse(to).getTime() - parse(from).getTime()) / 86_400_000);
}

/** The next date strictly after `after` that falls on one of `days`. */
export function nextDay(after: string, days: readonly number[]): string {
  for (let i = 1; i <= 7; i++) {
    const d = addDays(after, i);
    if (days.includes(isoWeekday(d))) return d;
  }
  throw new RangeError("days");
}

export type DatedSlot = Slot & { date: string };

/**
 * The 36 dated séances. The first is the next valid day strictly after `today`
 * (or `startOn`, when the programme already started on that day): never in the
 * past, and the same inputs always give the same dates, so assigning twice
 * plans the same séances.
 */
export function schedule(days: readonly number[], today: string, startOn?: string): DatedSlot[] {
  if (!validDays(days)) throw new RangeError("days");
  let date = startOn ?? nextDay(today, days);
  if (!days.includes(isoWeekday(date))) throw new RangeError("startOn");
  return SLOTS.map((s, i) => {
    if (i > 0) date = nextDay(date, days);
    return { ...s, date };
  });
}

/** Reassessments with the mobility bilan: S4, S8 and S12, from the end of those weeks. Offered, never forced. */
export function reassessments(startedOn: string): { key: "S4" | "S8" | "S12"; from: string }[] {
  return ([["S4", 4], ["S8", 8], ["S12", 12]] as const).map(([key, w]) => ({ key, from: addDays(startedOn, w * 7 - 1) }));
}

/**
 * The next free programme day after both `from` and `today`, skipping the dates
 * already taken by another séance of the programme (to postpone a séance).
 */
export function postponeDate(from: string, today: string, days: readonly number[], taken: ReadonlySet<string>): string {
  let d = from > today ? from : today;
  for (let i = 0; i < 60; i++) {
    d = nextDay(d, days);
    if (!taken.has(d)) return d;
  }
  throw new RangeError("no free day");
}

/** New dates for the séances still planned, when the climber changes the weekdays. Order kept; nothing before tomorrow. */
export function redate(planned: readonly { slot: number; date: string }[], today: string, days: readonly number[]): Map<number, string> {
  if (!validDays(days)) throw new RangeError("days");
  const out = new Map<number, string>();
  let d = today;
  for (const p of [...planned].sort((a, b) => a.slot - b.slot)) {
    d = nextDay(d, days);
    out.set(p.slot, d);
  }
  return out;
}

// ── Before the séance: symptom check ─────────────────────────────────────

export type BeforeCheck = {
  /** Lower back pain now, 0–10. */
  backPain: number;
  /** Pain radiating down the leg now, 0–10. */
  legRadiation: number;
  /** The radiation reaches further down than usual. */
  radiationSpreading: boolean;
  /** Pain that is unusual in kind or place. */
  unusualPain: boolean;
  /** Emergency signs (never stored, only the verdict is). */
  newNeuro: boolean;
  bladderBowel: boolean;
  saddleNumbness: boolean;
  recentFallSpinalPain: boolean;
};

export type Verdict = "GO" | "ADAPT" | "STOP" | "EMERGENCY";
export type VerdictReason =
  | "emergency" | "spreading" | "unusual" | "highPain" | "aboveUsualStop" | "aboveUsual" | "highWithoutUsual" | "clear";

/** The climber's usual levels (from their own S0 or earlier check-ins), if known. */
export type Usual = { backPain: number; legRadiation: number } | null;

export function beforeVerdict(c: BeforeCheck, usual: Usual): { verdict: Verdict; reason: VerdictReason } {
  if (safetyScreen(c) !== "CLEAR") return { verdict: "EMERGENCY", reason: "emergency" };
  if (c.radiationSpreading) return { verdict: "STOP", reason: "spreading" };
  if (c.unusualPain) return { verdict: "STOP", reason: "unusual" };
  if (c.backPain >= RULES.stopPain || c.legRadiation >= RULES.stopPain) return { verdict: "STOP", reason: "highPain" };
  if (usual) {
    if (c.backPain - usual.backPain >= RULES.stopAboveUsual || c.legRadiation - usual.legRadiation >= RULES.stopAboveUsual) {
      return { verdict: "STOP", reason: "aboveUsualStop" };
    }
    if (c.backPain > usual.backPain || c.legRadiation > usual.legRadiation) return { verdict: "ADAPT", reason: "aboveUsual" };
    return { verdict: "GO", reason: "clear" };
  }
  if (c.backPain >= RULES.adaptBackPain || c.legRadiation >= RULES.adaptLegRadiation) return { verdict: "ADAPT", reason: "highWithoutUsual" };
  return { verdict: "GO", reason: "clear" };
}

/**
 * The usual levels: the ones written with the programme, else the median of the
 * last (up to five) check-ins that were GO. Null when nothing is known yet.
 */
export function usualLevels(declared: Usual, history: readonly { verdict: Verdict; backPain: number | null; legRadiation: number | null }[]): Usual {
  if (declared) return declared;
  const go = history.filter((h) => h.verdict === "GO" && h.backPain !== null && h.legRadiation !== null).slice(-5);
  if (go.length === 0) return null;
  const median = (xs: number[]) => { const s = [...xs].sort((a, b) => a - b); return s[Math.floor((s.length - 1) / 2)]!; };
  return { backPain: median(go.map((h) => h.backPain!)), legRadiation: median(go.map((h) => h.legRadiation!)) };
}

// ── During the séance: stop rules ────────────────────────────────────────

export const STOP_REASONS = ["RADIATION_WORSE", "PAINFUL_BLOCK", "BALANCE_UNSAFE", "UNUSUAL_PAIN", "NEURO"] as const;
export type StopReason = (typeof STOP_REASONS)[number];
/** A stop reason that calls for urgent medical advice, not only rest. */
export function stopIsEmergency(r: StopReason): boolean {
  return r === "NEURO";
}

// ── The day after ────────────────────────────────────────────────────────

export const OVERALL = ["BETTER", "SAME", "WORSE"] as const;
export type Overall = (typeof OVERALL)[number];

/** A next-day follow-up is open from the day after the séance, for a week. */
export function followUpOpen(doneOn: string, today: string, hasFollowUp: boolean): boolean {
  if (hasFollowUp) return false;
  const d = daysBetween(doneOn, today);
  return d >= 1 && d <= 7;
}

// ── Progression ──────────────────────────────────────────────────────────

/** One finished séance of the programme, oldest first. */
export type DoneSession = {
  slot: number;
  status: "COMPLETED" | "INTERRUPTED";
  phaseUsed: Phase;
  verdict: Verdict | null;
  painBefore: number | null;
  painAfter: number | null;
  stopReason: StopReason | null;
  nextDay: Overall | null;
};

export type Tolerance = "TOLERATED" | "BAD" | "NEUTRAL";

export function tolerance(s: DoneSession): Tolerance {
  const rise = s.painBefore !== null && s.painAfter !== null ? s.painAfter - s.painBefore : null;
  if (s.stopReason || s.nextDay === "WORSE" || (rise !== null && rise >= RULES.badPainRise)) return "BAD";
  if (s.status === "COMPLETED" && s.verdict === "GO" && s.nextDay !== null && (rise === null || rise <= RULES.toleratedPainRise)) {
    return "TOLERATED";
  }
  return "NEUTRAL";
}

/** The highest phase the climber's own record allows, before the date and the clinical review are considered. */
export function allowedPhase(history: readonly DoneSession[]): Phase {
  let allowed = 1;
  let streak = 0;
  for (const s of history) {
    const t = tolerance(s);
    if (t === "BAD") { allowed = Math.max(1, allowed - 1); streak = 0; continue; }
    if (t === "TOLERATED" && s.phaseUsed >= allowed) {
      streak++;
      if (streak >= RULES.toleratedToStep && allowed < 6) { allowed++; streak = 0; }
    }
  }
  return allowed as Phase;
}

export type PhaseReason = "planned" | "tolerance" | "clinical" | "symptoms";

/**
 * The phase a séance uses: the phase planned for its date, unless the climber's
 * record, a missing clinical review or today's symptoms hold it lower.
 */
export function phaseFor(planned: Phase, history: readonly DoneSession[], clinicalReviewOn: string | null, today: Verdict = "GO"):
  { phase: Phase; reason: PhaseReason; adapted: boolean } {
  let phase: number = planned;
  let reason: PhaseReason = "planned";
  const allowed = allowedPhase(history);
  if (allowed < phase) { phase = allowed; reason = "tolerance"; }
  if (!clinicalReviewOn && phase > PHASE_WITHOUT_REVIEW) { phase = PHASE_WITHOUT_REVIEW; reason = "clinical"; }
  if (today === "ADAPT") { phase = Math.max(1, phase - 1); reason = "symptoms"; }
  return { phase: phase as Phase, reason, adapted: phase < planned };
}

/** Whether the programme still waits for a documented clinical review before its harder phases. */
export function clinicalPending(clinicalReviewOn: string | null): boolean {
  return !clinicalReviewOn;
}

// ── Status and adherence ─────────────────────────────────────────────────

export type RebuildStatus = "TODO" | "IN_PROGRESS" | "DONE" | "POSTPONED" | "ADAPTED" | "INTERRUPTED" | "SKIPPED";

export function rebuildStatus(
  s: { status: string; scheduledDate: string | null; originalDate: string | null },
  today: string, adapted: boolean,
): RebuildStatus {
  switch (s.status) {
    case "IN_PROGRESS": return "IN_PROGRESS";
    case "INTERRUPTED": return "INTERRUPTED";
    case "COMPLETED": return adapted ? "ADAPTED" : "DONE";
    case "SKIPPED": case "CANCELED": return "SKIPPED";
    default:
      if (s.scheduledDate && s.originalDate && s.scheduledDate !== s.originalDate) return "POSTPONED";
      if (s.scheduledDate && s.scheduledDate < today) return "POSTPONED";
      return "TODO";
  }
}

/** Séances done out of those already due: first planned date passed (today included), or done early. */
export function adherence(rows: readonly { status: string; originalDate: string | null }[], today: string): { done: number; due: number } {
  const done = rows.filter((r) => r.status === "COMPLETED");
  const due = rows.filter((r) => r.status === "COMPLETED" || (r.originalDate !== null && r.originalDate <= today));
  return { done: done.length, due: due.length };
}
