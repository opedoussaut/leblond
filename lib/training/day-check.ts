import { z } from "zod";
import type { Discipline, DayOutcome, ScheduledSession } from "./programme";
import { INTENSE_METHODS, OFF_WALL_METHODS, sessionTitle, weekdayOf } from "./programme";
import { injuriesSchema, methodVerdict, type BodyArea, type Health } from "./health";
import type { PlanSession } from "./plans";

/**
 * Daily check-in ("bilan du jour", about 30 s): how the climber is today, how
 * much time they have and where. It never changes the programme: it adapts
 * TODAY's session from it (as planned, lighter, swapped to technique or
 * mobility, or rest). Pure functions only.
 */
export const DAY_PLACES = ["BOULDER_GYM", "ROUTE_GYM", "CRAG", "HOME", "NONE"] as const;
export type DayPlace = (typeof DAY_PLACES)[number];
export const MINUTE_CHOICES = [0, 20, 30, 45, 60, 90, 120, 180] as const;

export const dayCheckInputSchema = z.object({
  /** 1 = poor night, 2 = average, 3 = good. */
  sleep: z.number().int().min(1).max(3),
  /** 1 = fresh, 2 = a bit tired, 3 = very tired. */
  fatigue: z.number().int().min(1).max(3),
  /** 0 = none, 1 = light, 2 = strong. */
  soreness: z.number().int().min(0).max(2),
  pain: injuriesSchema,
  minutes: z.number().int().min(0).max(300),
  place: z.enum(DAY_PLACES),
}).strict();
export type DayCheckInput = z.infer<typeof dayCheckInputSchema>;

/** Reason codes stored with the check-in (`pain:shoulder`, `tired`…); the UI translates them. */
export type DayReason =
  | `acute:${BodyArea}` | `pain:${BodyArea}` | `painAdapt:${BodyArea}`
  | "veryTired" | "tired" | "noClimbing" | "shortTime" | "lessTime"
  | "scheduled" | "today" | "pulledForward" | "noProgramme" | "noSessionHere";

export type DayRecommendation = {
  outcome: DayOutcome;
  /** Method of the session to do today; null for mobility or rest. */
  methodId: string | null;
  minutes: number;
  place: DayPlace;
  /** The programme session this was adapted from, if any. */
  planned: { title: string; methodId: string | null; minutes: number; sessionId: string | null } | null;
  reasons: DayReason[];
};

export type DayContext = {
  today: string;
  discipline: Discipline;
  /** Weekly template of the programme in progress (null without programme). */
  plan: readonly PlanSession[] | null;
  /** A training session already scheduled for today, if any. */
  scheduledToday: ScheduledSession | null;
};

const RANK: Record<DayOutcome, number> = { AS_PLANNED: 0, REDUCED: 1, TECHNIQUE: 2, MOBILITY: 3, REST: 4 };
const WALL_DEFAULT: Record<Exclude<DayPlace, "HOME" | "NONE">, string> = {
  BOULDER_GYM: "technique", ROUTE_GYM: "easy-volume", CRAG: "technique",
};

type Candidate = { title: string; methodId: string | null; minutes: number; sessionId: string | null; reason: DayReason };

function fitsPlace(s: PlanSession, place: DayPlace): boolean {
  if (place === "HOME") return s.place === "HOME" || (!s.place && (s.methodId === null || OFF_WALL_METHODS.has(s.methodId)));
  return s.place !== "HOME" && s.methodId !== null;
}

/** Today's planned session for this place: today's template day, else the next one of the week. */
function candidateFor(input: DayCheckInput, ctx: DayContext): Candidate | null {
  if (ctx.scheduledToday && input.place !== "NONE") {
    const s = ctx.scheduledToday;
    return { title: s.title, methodId: s.methodId, minutes: s.minutes ?? 60, sessionId: s.id, reason: "scheduled" };
  }
  if (!ctx.plan) return null;
  const fitting = ctx.plan.filter((s) => fitsPlace(s, input.place));
  if (!fitting.length) return null;
  const weekday = weekdayOf(ctx.today);
  const byDistance = [...fitting].sort((a, b) => ((a.day - weekday + 7) % 7) - ((b.day - weekday + 7) % 7));
  const s = byDistance[0];
  return { title: sessionTitle(s), methodId: s.methodId, minutes: s.minutes, sessionId: null, reason: s.day === weekday ? "today" : "pulledForward" };
}

const round5 = (n: number) => Math.max(10, Math.round(n / 5) * 5);

/**
 * Today's ideal session. Rules, most protective first:
 *  1. acute or worsening pain → rest (and see a professional);
 *  2. not climbing today, or under 20 min → short mobility or rest;
 *  3. very tired (poor night + very tired, or very tired + strong soreness) → mobility;
 *  4. pain in an area the planned method loads → swapped (technique / mobility) or lighter;
 *  5. a bit run-down → intense work swapped for technique, the rest lighter;
 *  6. less time than planned → same session, shorter.
 */
export function recommendToday(input: DayCheckInput, ctx: DayContext): DayRecommendation {
  const reasons: DayReason[] = [];
  const atWall = input.place !== "HOME" && input.place !== "NONE";
  const health: Health = { injuries: input.pain, unspecifiedPain: false };
  const done = (outcome: DayOutcome, methodId: string | null, minutes: number, planned: Candidate | null): DayRecommendation => ({
    outcome, methodId: outcome === "MOBILITY" || outcome === "REST" ? null : methodId,
    minutes: outcome === "REST" ? 0 : minutes, place: input.place,
    planned: planned ? { title: planned.title, methodId: planned.methodId, minutes: planned.minutes, sessionId: planned.sessionId } : null,
    reasons,
  });

  const acute = input.pain.filter((p) => p.level === "ACUTE");
  if (acute.length) {
    reasons.push(...acute.map((p) => `acute:${p.area}` as const));
    return done("REST", null, 0, null);
  }
  const veryTired = (input.sleep === 1 && input.fatigue === 3) || (input.fatigue === 3 && input.soreness === 2);
  const mobilityMinutes = Math.min(30, input.minutes);
  if (input.place === "NONE") {
    reasons.push("noClimbing");
    return input.minutes >= 15 && !veryTired ? done("MOBILITY", null, Math.min(20, input.minutes), null) : done("REST", null, 0, null);
  }
  if (input.minutes < 20) {
    reasons.push("shortTime");
    return input.minutes >= 10 ? done("MOBILITY", null, input.minutes, null) : done("REST", null, 0, null);
  }

  const found = candidateFor(input, ctx);
  const planned = found;
  const candidate: Candidate = found ?? (input.place === "HOME"
    ? { title: "", methodId: null, minutes: 30, sessionId: null, reason: ctx.plan ? "noSessionHere" : "noProgramme" }
    : { title: "", methodId: WALL_DEFAULT[input.place], minutes: 60, sessionId: null, reason: ctx.plan ? "noSessionHere" : "noProgramme" });
  reasons.push(candidate.reason);

  if (veryTired) {
    reasons.push("veryTired");
    return done("MOBILITY", null, mobilityMinutes, planned);
  }

  // Mutable decision, updated by the rules below (an object so helpers can change it).
  const d: { outcome: DayOutcome; methodId: string | null } = {
    outcome: candidate.methodId === null ? "MOBILITY" : "AS_PLANNED", methodId: candidate.methodId,
  };
  const bump = (o: DayOutcome) => { if (RANK[o] > RANK[d.outcome]) d.outcome = o; };
  const swapAway = () => {
    if (atWall && methodVerdict("technique", health).status !== "avoid") { d.outcome = "TECHNIQUE"; d.methodId = "technique"; }
    else { d.outcome = "MOBILITY"; d.methodId = null; }
  };

  const verdict = methodVerdict(d.methodId, health);
  if (verdict.status === "avoid") {
    reasons.push(...verdict.because.map((b) => `pain:${b.area}` as const));
    swapAway();
  } else if (verdict.status === "adapt") {
    reasons.push(...verdict.because.map((b) => `painAdapt:${b.area}` as const));
    bump("REDUCED");
  }

  const runDown = input.sleep === 1 || input.fatigue === 3 || input.soreness === 2;
  if (runDown && d.outcome !== "MOBILITY") {
    reasons.push("tired");
    if (d.outcome !== "TECHNIQUE" && d.methodId && INTENSE_METHODS.has(d.methodId)) swapAway();
    else bump("REDUCED");
  }

  const lighter = reasons.some((r) => r === "tired" || r.startsWith("painAdapt"));
  const minutes = d.outcome === "MOBILITY" ? mobilityMinutes
    : d.outcome === "TECHNIQUE" ? Math.min(input.minutes, 60)
    : Math.min(input.minutes, lighter ? round5(candidate.minutes * 0.75) : candidate.minutes);
  if (input.minutes < candidate.minutes && (d.outcome === "AS_PLANNED" || d.outcome === "REDUCED")) {
    reasons.push("lessTime");
    bump("REDUCED");
  }
  return done(d.outcome, d.methodId, minutes, planned);
}

/** Pain to pre-fill today's check-in with: the areas declared in the programme's last full assessment. */
export function painDefaults(health: Health): DayCheckInput["pain"] {
  return health.injuries.filter((i) => i.level !== "ACUTE");
}

