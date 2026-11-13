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
 * The climber's avatar: seven levels from White to Black, earned on four
 * pillars (mobility, flexibility, boulders, routes). The avatar is always the
 * LOWEST validated pillar, so every pillar must reach a level to unlock it.
 *
 * Climbing pillars are validated, never a single lucky send: at least
 * CLIMB_RULE.minClimbs different climbs sent at the threshold grade or harder,
 * over at least CLIMB_RULE.minSessions séances. Boulders count only grades in
 * Font (Font-graded problems, gym problems with a reliable Font estimate,
 * board climbs logged in Font); V grades and colours without an estimate are
 * never converted. Routes count clean lead ascents in the French scale.
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

export const PILLARS = ["mobility", "flexibility", "boulder", "route"] as const;
export type Pillar = (typeof PILLARS)[number];

/** Grade to validate for each level (index = level; White needs nothing). */
export const BOULDER_THRESHOLDS = [null, "5a", "5b", "5c", "6A+", "6B+", "6C+"] as const;
export const ROUTE_THRESHOLDS = [null, "5a", "5c", "6a", "6b", "6c", "7a"] as const;
export const CLIMB_RULE = { minClimbs: 3, minSessions: 2 } as const;

/** Tests behind each body pillar. D is optional: missing, it is ignored. */
export const PILLAR_TESTS: Record<"mobility" | "flexibility", { required: readonly TestId[]; optional: readonly TestId[] }> = {
  flexibility: { required: ["A", "B"], optional: [] },
  mobility: { required: ["C"], optional: ["D"] },
};
/** The hip protocol's top level (4) maps to Violet. */
export const BODY_MAX_LEVEL = 4;
export const BODY_RULE = { assessments: 2 } as const;

/** One send, for a climbing pillar. key identifies the climb, so repeats count once. */
export type ClimbSend = { key: string; sessionId: string; grade: string };

export type ClimbNext = { level: number; grade: string; climbs: number; sessions: number };
export type ClimbPillar = { kind: "climb"; level: number; next: ClimbNext | null };

export type BodyNext = { level: number; latest: number | null; assessments: number; weakest: TestId[] };
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

/** Different climbs and séances with a send at `grade` or harder. */
export function climbCount(sends: readonly ClimbSend[], grade: string, index: (g: string) => number) {
  const min = index(grade);
  const climbs = new Set<string>();
  const sessions = new Set<string>();
  for (const s of sends) {
    const i = index(s.grade);
    if (i < 0 || i < min) continue;
    climbs.add(s.key);
    sessions.add(s.sessionId);
  }
  return { climbs: climbs.size, sessions: sessions.size };
}

function climbPillar(sends: readonly ClimbSend[], thresholds: readonly (string | null)[], index: (g: string) => number): ClimbPillar {
  let level = 0;
  for (let l = MAX_LEVEL; l >= 1; l--) {
    const c = climbCount(sends, thresholds[l]!, index);
    if (c.climbs >= CLIMB_RULE.minClimbs && c.sessions >= CLIMB_RULE.minSessions) { level = l; break; }
  }
  if (level === MAX_LEVEL) return { kind: "climb", level, next: null };
  const grade = thresholds[level + 1]!;
  return { kind: "climb", level, next: { level: level + 1, grade, ...climbCount(sends, grade, index) } };
}

export const boulderPillar = (sends: readonly ClimbSend[]) => climbPillar(sends, BOULDER_THRESHOLDS, fontIndex);
export const routePillar = (sends: readonly ClimbSend[]) => climbPillar(sends, ROUTE_THRESHOLDS, routeIndex);

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
    next: { level: level + 1, latest: latest?.level ?? null, assessments: counted.length, weakest: latest?.weakest ?? [] },
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
    boulder: boulderPillar(input.boulderSends),
    route: routePillar(input.routeSends),
  };
  const level = Math.min(...PILLARS.map((p) => pillars[p].level));
  const blocking = PILLARS.filter((p) => pillars[p].level === level);
  const stuck = level === MAX_LEVEL || blocking.some((p) => pillars[p].kind === "body" && (pillars[p] as BodyPillar).capped);
  return { level, colour: AVATAR_LEVELS[level], pillars, blocking, nextLevel: stuck ? null : level + 1 };
}

/** Boulder sends in Font: Font problems, reliable estimates on other systems, Font board climbs. */
export function boulderSendsFrom(problems: readonly ProblemFact[], attempts: readonly AttemptFact[], board: readonly BoardAscentFact[]): ClimbSend[] {
  const font = new Map<string, string>();
  for (const p of problems) {
    const estimate = resolveNormalized(p);
    if (isReliable(estimate)) font.set(p.id, estimate.grade);
  }
  const out: ClimbSend[] = [];
  for (const a of attempts) {
    const grade = font.get(a.problemId);
    if (grade && isSend(a.result)) out.push({ key: "p:" + a.problemId, sessionId: a.sessionId, grade });
  }
  for (const b of board) {
    if (b.gradeScale === "FONT" && b.result !== "ATTEMPT") {
      out.push({ key: `b:${b.board}:${b.climbKey}:${b.angle}`, sessionId: b.sessionId, grade: b.grade });
    }
  }
  return out;
}

export type RouteSendRow = { id: string; sessionId: string; grade: string; style: RouteStyle; result: RouteResult; routeName: string };

/** Clean lead ascents. A named route counts once; an unnamed ascent counts on its own. */
export function routeSendsFrom(rows: readonly RouteSendRow[]): ClimbSend[] {
  return rows.filter((r) => r.style === "LEAD" && CLEAN_RESULTS.includes(r.result)).map((r) => {
    const name = r.routeName.trim().toLowerCase();
    return { key: name ? "n:" + name : "a:" + r.id, sessionId: r.sessionId, grade: r.grade };
  });
}
