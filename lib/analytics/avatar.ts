import { CLEAN_RESULTS, type RouteResult, type RouteStyle } from "@/lib/climbing/routes";
import { isSend } from "@/lib/climbing/types";
import { isReliable, resolveNormalized } from "@/lib/grading/normalization";
import { FONT_SCALE } from "@/lib/grading/systems";
import { FRENCH_ROUTE_GRADES } from "@/lib/grading/route-grades";
import type { MobilityResult } from "@/lib/training/hip-mobility/assessment";
import type { TestId } from "@/lib/training/hip-mobility/content";
import type { BoardAscentFact } from "./boards";
import type { AttemptFact, ProblemFact } from "./types";

/**
 * The climber's avatar: seven levels from White to Black, earned on six
 * pillars (mobility, flexibility, boulders indoor and outdoor, routes indoor
 * and outdoor). The avatar is always the LOWEST pillar, so every pillar must
 * reach a level to unlock it.
 *
 * Indoor is enough up to Green: until then every send (indoor or outdoor)
 * fills the outdoor pillars too. From Violet on, the outdoor pillars count
 * real outdoor sends only (séances at an outdoor site), so outdoor becomes
 * required. Outdoor sends always count for the indoor pillars as well.
 *
 * Climbing pillars are validated, never a single lucky send: a number of
 * different climbs at the threshold grade or harder, over a number of séances
 * (days outdoors) and, for the top outdoor levels, at several sites. Boulders
 * count only grades in Font (Font-graded problems, gym problems with a
 * reliable Font estimate, board climbs logged in Font); V grades and colours
 * without an estimate are never converted. Routes count clean lead ascents in
 * the French scale.
 *
 * Mobility and flexibility come from the hip-mobility assessment: the lowest
 * described level (0-4) across the pillar's tests and both sides, held in the
 * last two assessments. That beginner protocol cannot validate more than
 * Violet; Blue and Black wait for advanced tests.
 *
 * Thresholds are LEBLOND's own reference points, not a measurement of ability.
 */

export const AVATAR_LEVELS = ["WHITE", "YELLOW", "ORANGE", "GREEN", "VIOLET", "BLUE", "BLACK"] as const;
export type AvatarColour = (typeof AVATAR_LEVELS)[number];
export const MAX_LEVEL = AVATAR_LEVELS.length - 1;

export const PILLARS = ["mobility", "flexibility", "boulderIndoor", "boulderOutdoor", "routeIndoor", "routeOutdoor"] as const;
export type Pillar = (typeof PILLARS)[number];
export type ClimbPillarId = Exclude<Pillar, "mobility" | "flexibility">;

/** First level where the outdoor pillars need outdoor sends (Violet). */
export const OUTDOOR_FROM_LEVEL = 4;

/** What a climbing level asks: grade or harder, different climbs, séances (days), sites. */
export type ClimbRule = { grade: string; climbs: number; sessions: number; sites: number };
const rule = (grade: string, climbs: number, sessions: number, sites = 1): ClimbRule => ({ grade, climbs, sessions, sites });

/** Rules per level (index = level; White needs nothing). */
export const BOULDER_INDOOR_RULES: readonly (ClimbRule | null)[] = [
  null, rule("5a", 3, 2), rule("5b", 3, 2), rule("5c", 3, 2), rule("6A+", 4, 3), rule("6B+", 5, 3), rule("6C+", 5, 4),
];
export const ROUTE_INDOOR_RULES: readonly (ClimbRule | null)[] = [
  null, rule("5a", 3, 2), rule("5c", 3, 2), rule("6a", 3, 2), rule("6b", 4, 3), rule("6c", 5, 3), rule("7a", 5, 4),
];
/** Below OUTDOOR_FROM_LEVEL the outdoor pillars use the indoor rule on every send. */
export const BOULDER_OUTDOOR_RULES: readonly (ClimbRule | null)[] = [
  ...BOULDER_INDOOR_RULES.slice(0, OUTDOOR_FROM_LEVEL), rule("6A", 3, 2), rule("6B+", 3, 2, 2), rule("7A", 3, 3, 2),
];
export const ROUTE_OUTDOOR_RULES: readonly (ClimbRule | null)[] = [
  ...ROUTE_INDOOR_RULES.slice(0, OUTDOOR_FROM_LEVEL), rule("6a+", 3, 2), rule("6b+", 3, 2, 2), rule("7a", 3, 3, 2),
];

/** Tests behind each body pillar. D is optional: missing, it is ignored. */
export const PILLAR_TESTS: Record<"mobility" | "flexibility", { required: readonly TestId[]; optional: readonly TestId[] }> = {
  flexibility: { required: ["A", "B"], optional: [] },
  mobility: { required: ["C"], optional: ["D"] },
};
/** The hip protocol's top level (4) maps to Violet. */
export const BODY_MAX_LEVEL = 4;
export const BODY_RULE = { assessments: 2 } as const;

/**
 * One send, for a climbing pillar. key identifies the climb, so repeats count
 * once; site is the gym, crag or board; outdoor when logged at an outdoor site.
 */
export type ClimbSend = { key: string; sessionId: string; grade: string; outdoor: boolean; site: string };

export type ClimbCriterion = "climbs" | "sessions" | "sites";
export type ClimbCount = Record<ClimbCriterion, number>;
export type ClimbNext = {
  level: number;
  rule: ClimbRule;
  /** True when only outdoor sends count for this level. */
  outdoorOnly: boolean;
  have: ClimbCount;
  /** Criteria still short, in display order (never empty: the level would be validated). */
  missing: ClimbCriterion[];
};
export type ClimbPillar = { kind: "climb"; level: number; next: ClimbNext | null };

export type BodyNext = {
  level: number; latest: number | null; assessments: number; weakest: TestId[];
  /** Assessments in a row at `level` still to do: 1 when the latest one already holds it, else 2. */
  needed: number;
};
export type BodyPillar = { kind: "body"; level: number; next: BodyNext | null; capped: boolean };

export type PillarState = ClimbPillar | BodyPillar;

export type AvatarProgress = {
  level: number;
  colour: AvatarColour;
  pillars: Record<Pillar, PillarState>;
  /** Pillars at the avatar's level: they decide the next unlock. */
  blocking: Pillar[];
  /** Next colour, or null at Black or when the body pillars' cap is reached. */
  nextLevel: number | null;
};

function fontIndex(grade: string): number {
  const g = grade.trim().toLowerCase();
  return FONT_SCALE.findIndex((x) => x.toLowerCase() === g);
}
function routeIndex(grade: string): number {
  return (FRENCH_ROUTE_GRADES as readonly string[]).indexOf(grade.trim().toLowerCase());
}

/** Different climbs, séances and sites with a send at `grade` or harder. */
export function climbCount(sends: readonly ClimbSend[], grade: string, index: (g: string) => number): ClimbCount {
  const min = index(grade);
  const climbs = new Set<string>();
  const sessions = new Set<string>();
  const sites = new Set<string>();
  for (const s of sends) {
    const i = index(s.grade);
    if (i < 0 || i < min) continue;
    climbs.add(s.key);
    sessions.add(s.sessionId);
    sites.add(s.site);
  }
  return { climbs: climbs.size, sessions: sessions.size, sites: sites.size };
}

function missingCriteria(have: ClimbCount, r: ClimbRule): ClimbCriterion[] {
  return (["climbs", "sessions", "sites"] as const).filter((c) => have[c] < r[c]);
}

/**
 * A climbing pillar: levels are earned in order, the first rule not met stops
 * the pillar. Levels from `outdoorFrom` on count outdoor sends only.
 */
function climbPillar(sends: readonly ClimbSend[], rules: readonly (ClimbRule | null)[], index: (g: string) => number, outdoorFrom: number): ClimbPillar {
  const outdoor = sends.filter((s) => s.outdoor);
  for (let l = 1; l <= MAX_LEVEL; l++) {
    const r = rules[l]!;
    const outdoorOnly = l >= outdoorFrom;
    const have = climbCount(outdoorOnly ? outdoor : sends, r.grade, index);
    const missing = missingCriteria(have, r);
    if (missing.length) return { kind: "climb", level: l - 1, next: { level: l, rule: r, outdoorOnly, have, missing } };
  }
  return { kind: "climb", level: MAX_LEVEL, next: null };
}

const NEVER = MAX_LEVEL + 1;
export const boulderIndoorPillar = (sends: readonly ClimbSend[]) => climbPillar(sends, BOULDER_INDOOR_RULES, fontIndex, NEVER);
export const boulderOutdoorPillar = (sends: readonly ClimbSend[]) => climbPillar(sends, BOULDER_OUTDOOR_RULES, fontIndex, OUTDOOR_FROM_LEVEL);
export const routeIndoorPillar = (sends: readonly ClimbSend[]) => climbPillar(sends, ROUTE_INDOOR_RULES, routeIndex, NEVER);
export const routeOutdoorPillar = (sends: readonly ClimbSend[]) => climbPillar(sends, ROUTE_OUTDOOR_RULES, routeIndex, OUTDOOR_FROM_LEVEL);

/** One assessment's level on a pillar's tests, with the tests at that level; null when a required test is missing. */
export function assessmentLevel(results: readonly MobilityResult[], pillar: "mobility" | "flexibility"): { level: number; weakest: TestId[] } | null {
  const { required, optional } = PILLAR_TESTS[pillar];
  const perTest = new Map<TestId, number>();
  for (const test of [...required, ...optional]) {
    let min: number | null = null;
    let sides = 0;
    for (const side of ["LEFT", "RIGHT"] as const) {
      const r = results.find((x) => x.test === test && x.side === side);
      const level = !r ? null : r.done ? r.level : r.skipReason === "PAIN" ? 0 : null;
      if (level === null) continue;
      sides++;
      min = min === null ? level : Math.min(min, level);
    }
    if (sides < 2 || min === null) {
      if (required.includes(test)) return null;
      continue;
    }
    perTest.set(test, min);
  }
  const level = Math.min(...perTest.values());
  return { level, weakest: [...perTest].filter(([, l]) => l === level).map(([t]) => t) };
}

/** A body pillar from the assessments, newest first. */
export function bodyPillar(assessments: readonly { results: readonly MobilityResult[] }[], pillar: "mobility" | "flexibility"): BodyPillar {
  const recent = assessments.slice(0, BODY_RULE.assessments).map((a) => assessmentLevel(a.results, pillar));
  const counted = recent.filter((x) => x !== null);
  const latest = recent[0] ?? null;
  const level = counted.length === BODY_RULE.assessments ? Math.min(...counted.map((x) => x.level)) : 0;
  if (level >= BODY_MAX_LEVEL) return { kind: "body", level: BODY_MAX_LEVEL, next: null, capped: true };
  return {
    kind: "body", level, capped: false,
    next: {
      level: level + 1, latest: latest?.level ?? null, assessments: counted.length, weakest: latest?.weakest ?? [],
      needed: latest && latest.level >= level + 1 ? 1 : BODY_RULE.assessments,
    },
  };
}

export function avatarProgress(input: {
  boulderSends: readonly ClimbSend[];
  routeSends: readonly ClimbSend[];
  /** Hip-mobility assessments, newest first. */
  assessments: readonly { results: readonly MobilityResult[] }[];
}): AvatarProgress {
  const pillars: Record<Pillar, PillarState> = {
    mobility: bodyPillar(input.assessments, "mobility"),
    flexibility: bodyPillar(input.assessments, "flexibility"),
    boulderIndoor: boulderIndoorPillar(input.boulderSends),
    boulderOutdoor: boulderOutdoorPillar(input.boulderSends),
    routeIndoor: routeIndoorPillar(input.routeSends),
    routeOutdoor: routeOutdoorPillar(input.routeSends),
  };
  const level = Math.min(...PILLARS.map((p) => pillars[p].level));
  const blocking = PILLARS.filter((p) => pillars[p].level === level);
  const stuck = level === MAX_LEVEL || blocking.some((p) => pillars[p].kind === "body" && (pillars[p] as BodyPillar).capped);
  return { level, colour: AVATAR_LEVELS[level], pillars, blocking, nextLevel: stuck ? null : level + 1 };
}

/** Where each gym is: outdoor sites (brand OUTDOOR) against gyms. */
export type GymPlace = { id: string; brand: string };
const outdoorGyms = (gyms: readonly GymPlace[]) => new Set(gyms.filter((g) => g.brand === "OUTDOOR").map((g) => g.id));

/**
 * Boulder sends in Font: Font problems, reliable estimates on other systems,
 * Font board climbs (indoors). A problem at an outdoor site is an outdoor send.
 */
export function boulderSendsFrom(
  problems: readonly ProblemFact[], attempts: readonly AttemptFact[], board: readonly BoardAscentFact[], gyms: readonly GymPlace[] = [],
): ClimbSend[] {
  const outside = outdoorGyms(gyms);
  const font = new Map<string, { grade: string; gymId: string }>();
  for (const p of problems) {
    const estimate = resolveNormalized(p);
    if (isReliable(estimate)) font.set(p.id, { grade: estimate.grade, gymId: p.gymId });
  }
  const out: ClimbSend[] = [];
  for (const a of attempts) {
    const p = font.get(a.problemId);
    if (p && isSend(a.result)) out.push({ key: "p:" + a.problemId, sessionId: a.sessionId, grade: p.grade, outdoor: outside.has(p.gymId), site: p.gymId });
  }
  for (const b of board) {
    if (b.gradeScale === "FONT" && b.result !== "ATTEMPT") {
      out.push({ key: `b:${b.board}:${b.climbKey}:${b.angle}`, sessionId: b.sessionId, grade: b.grade, outdoor: false, site: "board:" + b.board });
    }
  }
  return out;
}

export type RouteSendRow = { id: string; sessionId: string; gymId: string; grade: string; style: RouteStyle; result: RouteResult; routeName: string };

/** Clean lead ascents. A named route counts once (per site); an unnamed ascent counts on its own. */
export function routeSendsFrom(rows: readonly RouteSendRow[], gyms: readonly GymPlace[] = []): ClimbSend[] {
  const outside = outdoorGyms(gyms);
  return rows.filter((r) => r.style === "LEAD" && CLEAN_RESULTS.includes(r.result)).map((r) => {
    const name = r.routeName.trim().toLowerCase();
    return { key: name ? `n:${r.gymId}:${name}` : "a:" + r.id, sessionId: r.sessionId, grade: r.grade, outdoor: outside.has(r.gymId), site: r.gymId };
  });
}
