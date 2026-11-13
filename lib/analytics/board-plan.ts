import type { BoardAscentFact } from "@/lib/analytics/boards";
import type { Board } from "@/lib/climbing/boards";
import { boardGrades } from "@/lib/climbing/boards";

/**
 * A board séance built for the climber: a list of climbs, each with a grade,
 * fitted into the time they have. Grades are on the board's Font scale, where
 * the avatar's boulder thresholds live; nothing is converted. The plan is a
 * suggestion: LEBLOND has no board climb database, so a slot names a climb
 * only when the climber's own log has one that fits (a project, a climb tried
 * and not sent yet, or an easy climb already sent for the warm-up).
 */

export const PLAN_FORMATS = ["progress", "limit", "fourByFour", "volume"] as const;
export type PlanFormat = (typeof PLAN_FORMATS)[number];

export const PLAN_BLOCKS = ["warmup", "main", "reach", "volume", "round"] as const;
export type PlanBlock = (typeof PLAN_BLOCKS)[number];

/** Minutes per climb in each block, rest between goes included. */
export const MINUTES_PER_CLIMB: Record<PlanBlock, number> = { warmup: 3, main: 6, reach: 8, volume: 4, round: 2 };
/** Cool-down kept at the end of every plan. */
export const COOL_DOWN_MINUTES = 5;
/** Rest between two 4×4 rounds. */
export const ROUND_REST_MINUTES = 4;
export const PLAN_MINUTES = { min: 30, max: 180, step: 15 } as const;

export type Suggestion = { name: string; why: "project" | "tried" | "sent" };
export type PlanSlot = { block: PlanBlock; grade: string; minutes: number; round?: number; suggestion?: Suggestion };
export type BoardPlan = {
  format: PlanFormat; minutes: number; target: string;
  slots: PlanSlot[];
  /** Planned minutes, cool-down included (never more than asked). */
  planned: number;
};

/** The programme method a format follows, when today's séance is one of them. */
export function formatForMethod(methodId: string | null | undefined): PlanFormat {
  if (methodId === "limit-bouldering") return "limit";
  if (methodId === "four-by-four") return "fourByFour";
  if (methodId === "easy-volume") return "volume";
  return "progress";
}

const FONT = boardGrades("FONT");
/** The grade `steps` away on the board's Font scale, kept inside the scale. */
export function gradeStep(grade: string, steps: number): string {
  const i = FONT.indexOf(grade);
  const at = i < 0 ? FONT.indexOf("5a") : i;
  return FONT[Math.max(0, Math.min(FONT.length - 1, at + steps))]!;
}

type Climb = { name: string; key: string; grade: string; sent: boolean; tries: number; sends: number; last: number };

/** The climber's climbs on this board and angle, Font grades only, latest grade kept. */
function climbsAt(facts: readonly BoardAscentFact[], board: Board, angle: number): Map<string, Climb> {
  const out = new Map<string, Climb>();
  for (const f of facts) {
    if (f.board !== board || f.angle !== angle || f.gradeScale !== "FONT") continue;
    const sent = f.result !== "ATTEMPT";
    const c = out.get(f.climbKey) ?? { name: f.climbName, key: f.climbKey, grade: f.grade, sent: false, tries: 0, sends: 0, last: 0 };
    const t = f.climbedAt.getTime();
    if (t >= c.last) { c.last = t; c.grade = f.grade; c.name = f.climbName; }
    c.sent ||= sent; c.tries += f.tries; c.sends += sent ? 1 : 0;
    out.set(f.climbKey, c);
  }
  return out;
}

export type PlanInput = {
  board: Board; angle: number; minutes: number; format: PlanFormat;
  /** The boulder grade that unlocks the next avatar colour (Font, as stored: "5b", "6A+"). */
  target: string;
  history: readonly BoardAscentFact[];
  /** Active board projects (any board/angle; filtered here). */
  projects: readonly { board: string; angle: number; climbName: string; climbKey: string; grade: string; gradeScale: string }[];
};

/** Block sizes for a format and a time budget: [block, grade offset from target, count]. */
function layout(format: PlanFormat, minutes: number): Array<[PlanBlock, number, number]> {
  const warmCount = minutes < 45 ? 3 : format === "limit" ? 5 : 4;
  const warm: Array<[PlanBlock, number, number]> = Array.from({ length: warmCount }, (_, i) => ["warmup", i - warmCount, 1]);
  let left = minutes - COOL_DOWN_MINUTES - warmCount * MINUTES_PER_CLIMB.warmup;
  const take = (block: PlanBlock, share: number, cap: number) => {
    const n = Math.max(0, Math.min(cap, Math.floor((left * share) / MINUTES_PER_CLIMB[block])));
    left -= n * MINUTES_PER_CLIMB[block];
    return n;
  };
  if (format === "limit") {
    const reach = take("reach", 0.75, 6);
    const hard = Math.min(2, Math.floor(reach / 3));
    const main = take("main", 1, 4);
    return [...warm, ["reach", 1, reach - hard], ["reach", 2, hard], ["main", 0, main]];
  }
  if (format === "fourByFour") {
    const roundMinutes = 4 * MINUTES_PER_CLIMB.round + ROUND_REST_MINUTES;
    const rounds = Math.max(1, Math.min(4, Math.floor((left * 0.7) / roundMinutes)));
    left -= rounds * roundMinutes;
    const main = take("main", 1, 4);
    return [...warm, ["round", -2, rounds * 4], ["main", 0, main]];
  }
  if (format === "volume") {
    const easy = take("volume", 0.55, 10);
    const mid = take("volume", 0.7, 8);
    const main = take("main", 1, 3);
    return [...warm, ["volume", -2, easy], ["volume", -1, mid], ["main", 0, main]];
  }
  const main = take("main", 0.5, 6);
  const reach = take("reach", 0.5, 3);
  const volume = take("volume", 1, 6);
  return [...warm, ["main", 0, main], ["reach", 1, reach], ["volume", -1, volume]];
}

/** Builds the séance. Pure: same input, same plan. */
export function buildBoardPlan(input: PlanInput): BoardPlan {
  const minutes = Math.max(PLAN_MINUTES.min, Math.min(PLAN_MINUTES.max, Math.round(input.minutes)));
  const target = FONT.includes(input.target) ? input.target : "5a";
  const climbs = climbsAt(input.history, input.board, input.angle);
  const used = new Set<string>();

  const projects = input.projects
    .filter((p) => p.board === input.board && p.angle === input.angle && p.gradeScale === "FONT")
    .map((p) => ({ name: p.climbName, key: p.climbKey, grade: p.grade }));
  const byRecent = [...climbs.values()].sort((a, b) => b.last - a.last);
  const pick = (block: PlanBlock, grade: string): Suggestion | undefined => {
    const free = (key: string) => !used.has(key);
    let found: Suggestion | undefined;
    if (block === "main" || block === "reach") {
      const project = projects.find((p) => p.grade === grade && free(p.key) && !climbs.get(p.key)?.sent);
      const tried = byRecent.find((c) => c.grade === grade && !c.sent && free(c.key));
      const key = project?.key ?? tried?.key;
      if (project) found = { name: project.name, why: "project" };
      else if (tried) found = { name: tried.name, why: "tried" };
      if (key) used.add(key);
    } else {
      // Warm-up, volume and 4×4 rounds: climbs already sent at that grade, the most repeated first.
      const sent = [...climbs.values()].filter((c) => c.sent && c.grade === grade && free(c.key)).sort((a, b) => b.sends - a.sends || b.last - a.last)[0];
      if (sent) { found = { name: sent.name, why: "sent" }; used.add(sent.key); }
    }
    return found;
  };

  const slots: PlanSlot[] = [];
  for (const [block, offset, count] of layout(input.format, minutes)) {
    const grade = gradeStep(target, offset);
    for (let i = 0; i < count; i++) {
      const slot: PlanSlot = { block, grade, minutes: MINUTES_PER_CLIMB[block] };
      if (block === "round") slot.round = Math.floor(i / 4) + 1;
      const s = pick(block, grade);
      if (s) slot.suggestion = s;
      slots.push(slot);
    }
  }
  const rounds = new Set(slots.filter((s) => s.block === "round").map((s) => s.round)).size;
  const planned = slots.reduce((n, s) => n + s.minutes, 0) + rounds * ROUND_REST_MINUTES + COOL_DOWN_MINUTES;
  return { format: input.format, minutes, target, slots, planned };
}

/**
 * Which slots the climbs logged in the séance fill: each logged Font climb
 * ticks the first open slot of the same grade (a send or a go both count:
 * the plan is about what was climbed). Returns the indexes of filled slots.
 */
export function filledSlots(slots: readonly Pick<PlanSlot, "grade">[], logged: readonly { grade: string; gradeScale: string }[]): Set<number> {
  const done = new Set<number>();
  for (const l of logged) {
    if (l.gradeScale !== "FONT") continue;
    const i = slots.findIndex((s, n) => !done.has(n) && s.grade === l.grade);
    if (i >= 0) done.add(i);
  }
  return done;
}

/** A compact, URL-safe form of a plan for the live séance (grades and names only). */
export function encodePlan(plan: BoardPlan): string {
  const data = { f: plan.format, t: plan.target, s: plan.slots.map((s) => [s.block, s.grade, s.suggestion?.name ?? "", s.suggestion?.why ?? "", s.round ?? 0]) };
  const bytes = new TextEncoder().encode(JSON.stringify(data));
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Reads a plan written by encodePlan; null when it is not one. */
export function decodePlan(text: string | null | undefined): Pick<BoardPlan, "format" | "target" | "slots"> | null {
  if (!text || text.length > 4000) return null;
  try {
    const bin = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
    const data = JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)))) as { f: unknown; t: unknown; s: unknown };
    if (!PLAN_FORMATS.includes(data.f as PlanFormat) || typeof data.t !== "string" || !FONT.includes(data.t) || !Array.isArray(data.s) || data.s.length > 60) return null;
    const slots: PlanSlot[] = [];
    for (const row of data.s) {
      if (!Array.isArray(row)) return null;
      const [block, grade, name, why, round] = row as unknown[];
      if (!PLAN_BLOCKS.includes(block as PlanBlock) || typeof grade !== "string" || !FONT.includes(grade)) return null;
      const slot: PlanSlot = { block: block as PlanBlock, grade, minutes: MINUTES_PER_CLIMB[block as PlanBlock] };
      if (typeof round === "number" && round > 0) slot.round = round;
      if (typeof name === "string" && name && name.length <= 120 && (why === "project" || why === "tried" || why === "sent")) slot.suggestion = { name, why };
      slots.push(slot);
    }
    return { format: data.f as PlanFormat, target: data.t, slots };
  } catch { return null; }
}
